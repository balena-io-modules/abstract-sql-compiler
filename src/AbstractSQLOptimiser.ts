import * as _ from 'lodash';

import { Dictionary } from 'lodash';
import {
	AbstractSqlQuery,
	AbstractSqlType,
	DurationNode,
	ReplaceNode,
} from './AbstractSQLCompiler';
import * as AbstractSQLRules2SQL from './AbstractSQLRules2SQL';

const {
	isAbstractSqlQuery,
	getAbstractSqlQuery,
	checkArgs,
	checkMinArgs,
	isNotNullable,
} = AbstractSQLRules2SQL;

type OptimisationMatchFn = (
	args: AbstractSqlType[],
) => AbstractSqlQuery | false;
type MetaMatchFn = (args: AbstractSqlQuery) => AbstractSqlQuery;
type MatchFn = (args: AbstractSqlType[]) => AbstractSqlQuery;

const deprecated = (() => {
	const deprecationMessages = {
		legacyAlias:
			"Legacy alias format of `[node, alias]` is deprecated, use `['Alias', node, alias]` instead.",
		legacyTable:
			"Legacy table format of `tableName` is deprecated, use `['Table', tableName]` instead.",
		legacyNull:
			"Legacy null format of `null` is deprecated, use `['Null']` instead.",
		legacyNullString:
			"Legacy null format of `'Null'` is deprecated, use `['Null']` instead.",
	};
	const result = {} as Record<keyof typeof deprecationMessages, () => void>;
	for (const key of Object.keys(deprecationMessages) as Array<
		keyof typeof deprecationMessages
	>) {
		result[key] = () => {
			console.warn(
				'@balena/abstract-sql-compiler deprecated:',
				deprecationMessages[key],
			);
			result[key] = _.noop;
		};
	}
	return result;
})();

const escapeForLike = (str: AbstractSqlType): ReplaceNode => [
	'Replace',
	[
		'Replace',
		['Replace', str, ['EmbeddedText', '\\'], ['EmbeddedText', '\\\\']],
		['EmbeddedText', '_'],
		['EmbeddedText', '\\_'],
	],
	['EmbeddedText', '%'],
	['EmbeddedText', '\\%'],
];

let helped = false;
let noBinds = false;
const Helper = <F extends (...args: any[]) => any>(fn: F) => {
	return (...args: Parameters<F>): ReturnType<F> => {
		const result = fn(...args);
		if (result !== false) {
			helped = true;
		}
		return result;
	};
};

const isEmptySelectQuery = (query: AbstractSqlQuery): boolean => {
	const [type, ...rest] = query;
	switch (type) {
		case 'SelectQuery':
			for (const arg of rest) {
				if (arg[0] === 'Where') {
					const maybeBool = arg[1];
					if (maybeBool[0] === 'Boolean') {
						if (maybeBool[1] === false) {
							return true;
						}
					}
				}
			}
	}
	return false;
};

const rewriteMatch =
	(
		name: string,
		matchers: Array<(args: AbstractSqlType) => AbstractSqlType>,
		rewriteFn: MatchFn,
	): MatchFn =>
	(args) => {
		checkArgs(name, args, matchers.length);
		return rewriteFn(
			args.map((arg, index) => {
				// Type cast because of cases where not all nodes are arrays, but we do handle them correctly where they can occur
				return matchers[index](arg as AbstractSqlType);
			}),
		);
	};

const matchArgs = (
	name: string,
	...matchers: Array<(args: AbstractSqlType) => AbstractSqlType>
): MatchFn => rewriteMatch(name, matchers, (args) => [name, ...args]);

const tryMatches = (...matchers: OptimisationMatchFn[]): MatchFn => {
	return (args) => {
		let err;
		for (const matcher of matchers) {
			try {
				const result = matcher(args);
				if (result !== false) {
					return result;
				}
			} catch (e) {
				err = e;
			}
		}
		throw err;
	};
};

const AnyValue: MetaMatchFn = (args) => {
	const [type, ...rest] = args;
	if (type === 'Case') {
		return typeRules[type](rest);
	}

	for (const matcher of [
		isJSONValue,
		isDateValue,
		isTextValue,
		isNumericValue,
		isBooleanValue,
		isDurationValue,
	]) {
		if (matcher(type)) {
			return typeRules[type](rest);
		}
	}

	return UnknownValue(args);
};
const UnknownValue: MetaMatchFn = (args) => {
	if (args === null) {
		helped = true;
		deprecated.legacyNull();
		args = ['Null'];
	}
	if ((args as any) === 'Null') {
		helped = true;
		deprecated.legacyNullString();
		args = ['Null'];
	}
	const [type, ...rest] = args;
	switch (type) {
		case 'Null':
		case 'Field':
		case 'ReferencedField':
		case 'Bind':
		case 'Cast':
		case 'Coalesce':
		case 'ExtractJSONPathAsText':
		case 'ToJSON':
		case 'Any':
			return typeRules[type](rest);
		case 'SelectQuery':
		case 'UnionQuery':
			return typeRules[type](rest);
		default:
			throw new Error(`Invalid "UnknownValue" type: ${type}`);
	}
};
const MatchValue =
	(matcher: (type: string | AbstractSqlQuery) => type is string): MetaMatchFn =>
	(args) => {
		const [type, ...rest] = args;
		if (matcher(type)) {
			return typeRules[type](rest);
		}
		return UnknownValue(args);
	};

const isTextValue = (type: string | AbstractSqlQuery): type is string => {
	return (
		type === 'Concat' ||
		type === 'Tolower' ||
		type === 'ToLower' ||
		type === 'Toupper' ||
		type === 'ToUpper' ||
		AbstractSQLRules2SQL.isTextValue(type)
	);
};
const TextValue = MatchValue(isTextValue);

const isNumericValue = (type: string | AbstractSqlQuery): type is string => {
	return (
		type === 'IndexOf' ||
		type === 'Indexof' ||
		AbstractSQLRules2SQL.isNumericValue(type)
	);
};
const NumericValue = MatchValue(isNumericValue);

const isBooleanValue = (type: string | AbstractSqlQuery): type is string => {
	return (
		type === 'Contains' ||
		type === 'Substringof' ||
		type === 'Startswith' ||
		type === 'Endswith' ||
		AbstractSQLRules2SQL.isBooleanValue(type)
	);
};
const BooleanValue = MatchValue(isBooleanValue);

const isDateValue = (type: string | AbstractSqlQuery): type is string => {
	return type === 'Now' || AbstractSQLRules2SQL.isDateValue(type);
};
const DateValue = MatchValue(isDateValue);

const { isJSONValue } = AbstractSQLRules2SQL;

const { isDurationValue } = AbstractSQLRules2SQL;
const DurationValue = MatchValue(isDurationValue);

const { isArrayValue } = AbstractSQLRules2SQL;
const ArrayValue = MatchValue(isArrayValue);

const { isFieldValue } = AbstractSQLRules2SQL;
const Field: MetaMatchFn = (args) => {
	const [type, ...rest] = args;
	if (isFieldValue(type)) {
		return typeRules[type](rest);
	} else {
		throw new SyntaxError(`Invalid field type: ${type}`);
	}
};

const AnyNotNullValue = (args: any): boolean => {
	return args != null && (args as any) !== 'Null' && args[0] !== 'Null';
};

const FieldOp =
	(type: string): OptimisationMatchFn =>
	(args) => {
		if (
			AnyNotNullValue(args[0]) === false ||
			AnyNotNullValue(args[1]) === false
		) {
			return false;
		}
		if (isFieldValue(args[0][0])) {
			return [type, args[0], args[1]];
		} else if (isFieldValue(args[1][0])) {
			return [type, args[1], args[0]];
		} else {
			return false;
		}
	};
const FieldEquals = FieldOp('Equals');
const FieldNotEquals = FieldOp('NotEquals');

const Comparison = (
	comparison: keyof typeof AbstractSQLRules2SQL.comparisons,
): MatchFn => {
	return matchArgs(comparison, AnyValue, AnyValue);
};
const NumberMatch = (type: string): MatchFn => {
	return matchArgs(type, (arg) => {
		if (typeof arg !== 'number') {
			throw new SyntaxError(`${type} expected number but got ${typeof arg}`);
		}
		return arg;
	});
};
const mathOps = {
	Add: '+',
	Subtract: '-',
	Multiply: '*',
	Divide: '/',
};
const MathOp = (type: keyof typeof mathOps): MatchFn => {
	return matchArgs(type, NumericValue, NumericValue);
};

const ExtractNumericDatePart = (type: string): MatchFn => {
	return matchArgs(type, DateValue);
};

const Concatenate: MatchFn = (args) => {
	checkMinArgs('Concatenate', args, 1);
	return [
		'Concatenate',
		...args.map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return TextValue(arg);
		}),
	];
};

const ConcatenateWithSeparator: MatchFn = (args) => {
	checkMinArgs('ConcatenateWithSeparator', args, 2);
	return [
		'ConcatenateWithSeparator',
		...args.map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return TextValue(arg);
		}),
	];
};

const Text: MatchFn = matchArgs('Text', _.identity);

const Value = (arg: any): AbstractSqlQuery => {
	switch (arg) {
		case true:
		case false:
		case 'Default':
			return arg;
		default:
			const [type, ...rest] = arg;
			switch (type) {
				case 'Null':
				case 'Bind':
				case 'Value':
				case 'Text':
				case 'Number':
				case 'Real':
				case 'Integer':
					return typeRules[type](rest);
				default:
					throw new SyntaxError(`Invalid type for Value ${type}`);
			}
	}
};

const FromMatch: MetaMatchFn = (args) => {
	if (typeof args === 'string') {
		deprecated.legacyTable();
		return ['Table', args];
	}
	const [type, ...rest] = args;
	switch (type) {
		case 'SelectQuery':
		case 'UnionQuery':
			return typeRules[type](rest);
		case 'Table':
			checkArgs('Table', rest, 1);
			return ['Table', rest[0]];
		default:
			throw new SyntaxError(`From does not support ${type}`);
	}
};

const MaybeAlias = (
	args: AbstractSqlQuery,
	matchFn: MetaMatchFn,
): AbstractSqlQuery => {
	if (
		args.length === 2 &&
		args[0] !== 'Table' &&
		args[0] !== 'Count' &&
		args[0] !== 'Field' &&
		typeof args[1] === 'string'
	) {
		helped = true;
		deprecated.legacyAlias();
		return ['Alias', matchFn(args[0] as any as AbstractSqlQuery), args[1]];
	}
	const [type, ...rest] = args;
	switch (type) {
		case 'Alias':
			checkArgs('Alias', rest, 2);
			return ['Alias', matchFn(getAbstractSqlQuery(rest, 0)), rest[1]];
		default:
			return matchFn(args);
	}
};

const Lower = matchArgs('Lower', TextValue);
const Upper = matchArgs('Upper', TextValue);

const JoinMatch =
	(joinType: string): MatchFn =>
	(args) => {
		if (args.length !== 1 && args.length !== 2) {
			throw new SyntaxError(`"${joinType}" requires 1/2 arg(s)`);
		}
		const from = MaybeAlias(getAbstractSqlQuery(args, 0), FromMatch);
		if (args.length === 1) {
			return [joinType, from];
		}
		const [type, ...rest] = getAbstractSqlQuery(args, 1);
		switch (type) {
			case 'On':
				checkArgs('On', rest, 1);
				const ruleBody = BooleanValue(getAbstractSqlQuery(rest, 0));
				return [joinType, from, ['On', ruleBody]];
			default:
				throw new SyntaxError(
					`'${joinType}' clause does not support '${type}' clause`,
				);
		}
	};

const AddDateMatcher = tryMatches(
	matchArgs('AddDateDuration', DateValue, DurationValue),
	matchArgs('AddDateNumber', DateValue, NumericValue),
);

const SubtractDateMatcher = tryMatches(
	matchArgs('SubtractDateDate', DateValue, DateValue),
	matchArgs('SubtractDateDuration', DateValue, DurationValue),
	matchArgs('SubtractDateNumber', DateValue, NumericValue),
);

const typeRules: Dictionary<MatchFn> = {
	UnionQuery: (args) => {
		checkMinArgs('UnionQuery', args, 2);
		return [
			'UnionQuery',
			...args.map((arg) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				const [type, ...rest] = arg;
				switch (type) {
					case 'SelectQuery':
					case 'UnionQuery':
						return typeRules[type](rest);
					default:
						throw new SyntaxError(`UnionQuery does not support ${type}`);
				}
			}),
		];
	},
	SelectQuery: (args) => {
		const tables: AbstractSqlQuery[] = [];
		let select: AbstractSqlQuery[] = [];
		const groups = {
			Where: [] as AbstractSqlQuery[],
			GroupBy: [] as AbstractSqlQuery[],
			Having: [] as AbstractSqlQuery[],
			OrderBy: [] as AbstractSqlQuery[],
			Limit: [] as AbstractSqlQuery[],
			Offset: [] as AbstractSqlQuery[],
		};
		for (const arg of args) {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError('`SelectQuery` args must all be arrays');
			}
			const [type, ...rest] = arg;
			switch (type) {
				case 'Select':
					if (select.length !== 0) {
						throw new SyntaxError(
							`'SelectQuery' can only accept one '${type}'`,
						);
					}
					select = [typeRules[type](rest)];
					break;
				case 'From':
				case 'Join':
				case 'LeftJoin':
				case 'RightJoin':
				case 'FullJoin':
				case 'CrossJoin':
					tables.push(typeRules[type](rest));
					break;
				case 'Where':
				case 'GroupBy':
				case 'Having':
				case 'OrderBy':
				case 'Limit':
				case 'Offset':
					if (groups[type].length !== 0) {
						throw new SyntaxError(
							`'SelectQuery' can only accept one '${type}'`,
						);
					}
					groups[type] = [typeRules[type](rest)];
					break;
				default:
					throw new SyntaxError(`'SelectQuery' does not support '${type}'`);
			}
		}

		return [
			'SelectQuery',
			...select,
			...tables,
			...groups.Where,
			...groups.GroupBy,
			...groups.Having,
			...groups.OrderBy,
			...groups.Limit,
			...groups.Offset,
		] as AbstractSqlQuery;
	},
	Select: (args) => {
		checkArgs('Select', args, 1);
		return [
			'Select',
			getAbstractSqlQuery(args, 0).map((arg) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				return MaybeAlias(arg, AnyValue);
			}),
		] as AbstractSqlQuery;
	},
	From: (args) => {
		checkArgs('From', args, 1);
		return ['From', MaybeAlias(args[0] as AbstractSqlQuery, FromMatch)];
	},
	Join: JoinMatch('Join'),
	LeftJoin: JoinMatch('LeftJoin'),
	RightJoin: JoinMatch('RightJoin'),
	FullJoin: JoinMatch('FullJoin'),
	CrossJoin: (args) => {
		checkArgs('CrossJoin', args, 1);
		const from = MaybeAlias(getAbstractSqlQuery(args, 0), FromMatch);
		return ['CrossJoin', from];
	},
	Where: matchArgs('Where', BooleanValue),
	GroupBy: (args) => {
		checkArgs('GroupBy', args, 1);
		const groups = getAbstractSqlQuery(args, 0);
		checkMinArgs('GroupBy groups', groups, 1);
		return ['GroupBy', groups.map(AnyValue)] as AbstractSqlQuery;
	},
	Having: matchArgs('Having', BooleanValue),
	OrderBy: (args) => {
		checkMinArgs('OrderBy', args, 1);
		return [
			'OrderBy',
			...args.map((arg: AbstractSqlQuery) => {
				checkMinArgs('OrderBy ordering', arg, 2);
				const order = arg[0];
				if (order !== 'ASC' && order !== 'DESC') {
					throw new SyntaxError(`Can only order by "ASC" or "DESC"`);
				}
				const value = AnyValue(getAbstractSqlQuery(arg, 1));
				return [order, value];
			}),
		] as AbstractSqlQuery;
	},
	Limit: matchArgs('Limit', NumericValue),
	Offset: matchArgs('Offset', NumericValue),
	Count: (args) => {
		checkArgs('Count', args, 1);
		if (args[0] !== '*') {
			throw new SyntaxError('"Count" only supports "*"');
		}
		return ['Count', args[0]];
	},
	Average: matchArgs('Average', NumericValue),
	Sum: matchArgs('Sum', NumericValue),
	Field: matchArgs('Field', _.identity),
	ReferencedField: matchArgs('ReferencedField', _.identity, _.identity),
	Cast: matchArgs('Cast', AnyValue, _.identity),
	Number: NumberMatch('Number'),
	Real: NumberMatch('Real'),
	Integer: NumberMatch('Integer'),
	Boolean: matchArgs('Boolean', _.identity),
	EmbeddedText: matchArgs('EmbeddedText', _.identity),
	Null: matchArgs('Null'),
	CurrentTimestamp: matchArgs('CurrentTimestamp'),
	CurrentDate: matchArgs('CurrentDate'),
	AggregateJSON: matchArgs('AggregateJSON', _.identity),
	Equals: tryMatches(
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('Equals', args, 2);
			let valueIndex;
			if (args[0][0] === 'Null') {
				valueIndex = 1;
			} else if (args[1][0] === 'Null') {
				valueIndex = 0;
			} else {
				return false;
			}

			return ['NotExists', getAbstractSqlQuery(args, valueIndex)];
		}),
		Comparison('Equals'),
	),
	NotEquals: tryMatches(
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('NotEquals', args, 2);
			let valueIndex;
			if (args[0][0] === 'Null') {
				valueIndex = 1;
			} else if (args[1][0] === 'Null') {
				valueIndex = 0;
			} else {
				return false;
			}

			return ['Exists', getAbstractSqlQuery(args, valueIndex)];
		}),
		Comparison('NotEquals'),
	),
	GreaterThan: Comparison('GreaterThan'),
	GreaterThanOrEqual: Comparison('GreaterThanOrEqual'),
	LessThan: Comparison('LessThan'),
	LessThanOrEqual: Comparison('LessThanOrEqual'),
	Like: Comparison('Like'),
	IsNotDistinctFrom: tryMatches(
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('IsNotDistinctFrom', args, 2);
			let valueIndex;
			if (args[0][0] === 'Null') {
				valueIndex = 1;
			} else if (args[1][0] === 'Null') {
				valueIndex = 0;
			} else {
				return false;
			}

			return ['NotExists', getAbstractSqlQuery(args, valueIndex)];
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('IsDistinctFrom', args, 2);
			if (
				isNotNullable(getAbstractSqlQuery(args, 0)) &&
				isNotNullable(getAbstractSqlQuery(args, 1))
			) {
				return ['Equals', ...args];
			}
			return false;
		}),
		matchArgs('IsNotDistinctFrom', AnyValue, AnyValue),
	),
	IsDistinctFrom: tryMatches(
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('IsDistinctFrom', args, 2);
			let valueIndex;
			if (args[0][0] === 'Null') {
				valueIndex = 1;
			} else if (args[1][0] === 'Null') {
				valueIndex = 0;
			} else {
				return false;
			}

			return ['Exists', getAbstractSqlQuery(args, valueIndex)];
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('IsDistinctFrom', args, 2);
			if (
				isNotNullable(getAbstractSqlQuery(args, 0)) &&
				isNotNullable(getAbstractSqlQuery(args, 1))
			) {
				return ['NotEquals', ...args];
			}
			return false;
		}),
		matchArgs('IsDistinctFrom', AnyValue, AnyValue),
	),
	Add: tryMatches(MathOp('Add'), Helper(AddDateMatcher)),
	Subtract: tryMatches(MathOp('Subtract'), Helper(SubtractDateMatcher)),
	SubtractDateDate: matchArgs('SubtractDateDate', DateValue, DateValue),
	SubtractDateNumber: matchArgs('SubtractDateNumber', DateValue, NumericValue),
	SubtractDateDuration: matchArgs(
		'SubtractDateDuration',
		DateValue,
		DurationValue,
	),
	AddDateDuration: matchArgs('AddDateDuration', DateValue, DurationValue),
	AddDateNumber: matchArgs('AddDateNumber', DateValue, NumericValue),
	Multiply: MathOp('Multiply'),
	Divide: MathOp('Divide'),
	Year: ExtractNumericDatePart('Year'),
	Month: ExtractNumericDatePart('Month'),
	Day: ExtractNumericDatePart('Day'),
	Hour: ExtractNumericDatePart('Hour'),
	Minute: ExtractNumericDatePart('Minute'),
	Second: ExtractNumericDatePart('Second'),
	Fractionalseconds: ExtractNumericDatePart('Fractionalseconds'),
	Totalseconds: matchArgs('Totalseconds', DurationValue),
	Concat: Concatenate,
	Concatenate,
	ConcatenateWithSeparator,
	Replace: matchArgs('Replace', TextValue, TextValue, TextValue),
	CharacterLength: matchArgs('CharacterLength', TextValue),
	StrPos: matchArgs('StrPos', TextValue, TextValue),
	Substring: (args) => {
		checkMinArgs('Substring', args, 2);
		const str = TextValue(getAbstractSqlQuery(args, 0));
		const nums = args.slice(1).map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return NumericValue(arg);
		});
		return ['Substring', str, ...nums];
	},
	Right: matchArgs('Right', TextValue, NumericValue),
	Tolower: Lower,
	ToLower: Lower,
	Lower,
	Toupper: Upper,
	ToUpper: Upper,
	Upper,
	Trim: matchArgs('Trim', TextValue),
	Round: matchArgs('Round', NumericValue),
	Floor: matchArgs('Floor', NumericValue),
	Ceiling: matchArgs('Ceiling', NumericValue),
	ToDate: matchArgs('ToDate', DateValue),
	DateTrunc: matchArgs('DateTrunc', TextValue, DateValue),
	ToTime: matchArgs('ToTime', DateValue),
	ExtractJSONPathAsText: (args) => {
		checkMinArgs('ExtractJSONPathAsText', args, 1);
		const json = TextValue(getAbstractSqlQuery(args, 0));
		const path = ArrayValue(getAbstractSqlQuery(args, 1));
		return ['ExtractJSONPathAsText', json, path];
	},
	TextArray: (args) => {
		// Allow for populated and empty arrays
		return ['TextArray', ...args.map(TextValue)];
	},
	ToJSON: matchArgs('ToJSON', AnyValue),
	Any: matchArgs('Any', AnyValue),
	Coalesce: (args) => {
		checkMinArgs('Coalesce', args, 2);
		return ['Coalesce', ...args.map(AnyValue)];
	},
	Case: (args) => {
		checkMinArgs('Case', args, 1);
		return [
			'Case',
			...args.map((arg, index) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				const [type, ...rest] = arg;
				switch (type) {
					case 'When':
						checkArgs('When', rest, 2);
						const matches = BooleanValue(getAbstractSqlQuery(rest, 0));
						const resultValue = AnyValue(getAbstractSqlQuery(rest, 1));
						return ['When', matches, resultValue];
					case 'Else':
						if (index !== args.length - 1) {
							throw new SyntaxError('Else must be the last element of a Case');
						}
						checkArgs('Else', rest, 1);
						return ['Else', AnyValue(getAbstractSqlQuery(rest, 0))];
					default:
						throw new SyntaxError('Case can only contain When/Else');
				}
			}),
		] as AbstractSqlQuery;
	},
	And: tryMatches(
		Helper<OptimisationMatchFn>((args) => {
			if (args.length !== 1) {
				return false;
			}
			return getAbstractSqlQuery(args, 0);
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkMinArgs('And', args, 2);
			// Collapse nested ANDs.
			let maybeHelped = false;
			const conditions = _.flatMap(args, (arg) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				if (arg[0] === 'And') {
					maybeHelped = true;
					return arg.slice(1);
				}
				return [arg];
			});
			if (!maybeHelped) {
				// Make sure we actually hit an optimisation case
				return false;
			}

			return ['And', ...conditions] as AbstractSqlQuery;
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkMinArgs('And', args, 2);
			// Reduce any booleans
			let maybeHelped = false;
			let containsFalse = false;
			const conditions = args.filter((arg) => {
				if (arg[0] === 'Boolean') {
					if (arg[1] === true) {
						maybeHelped = true;
						return false;
					} else if (arg[1] === false) {
						containsFalse = true;
					}
				}
				return true;
			});
			if (containsFalse) {
				return ['Boolean', false] as AbstractSqlQuery;
			}
			if (maybeHelped) {
				return ['And', ...conditions] as AbstractSqlQuery;
			}
			return false;
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkMinArgs('And', args, 2);
			// Optimise id != 1 AND id != 2 AND id != 3 -> id NOT IN [1, 2, 3]
			const fieldBuckets: Dictionary<AbstractSqlQuery[]> = {};
			const others: AbstractSqlQuery[] = [];
			let maybeHelped = false;
			args.map((arg) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				if (arg[0] === 'NotEquals') {
					const fieldBool = FieldNotEquals(arg.slice(1));
					if (fieldBool !== false) {
						const fieldRef = fieldBool[1] as string;
						if (fieldBuckets[fieldRef] == null) {
							fieldBuckets[fieldRef] = [fieldBool];
						} else {
							// We're adding a second match, so that means we can optimise
							maybeHelped = true;
							fieldBuckets[fieldRef].push(fieldBool);
						}
						return;
					}
				} else if (arg[0] === 'NotIn') {
					const fieldRef = arg[1] as string;
					if (fieldBuckets[fieldRef] == null) {
						fieldBuckets[fieldRef] = [arg];
					} else {
						// We're adding a second match, so that means we can optimise
						maybeHelped = true;
						fieldBuckets[fieldRef].push(arg);
					}
					return;
				}
				others.push(arg);
			});
			// Make sure we have at least some fields entries that can be optimised
			if (!maybeHelped) {
				return false;
			}
			const fields = Object.keys(fieldBuckets).map((fieldRef) => {
				const fieldBucket = fieldBuckets[fieldRef];
				if (fieldBucket.length === 1) {
					return fieldBucket[0];
				} else {
					return [
						'NotIn',
						fieldBucket[0][1],
						..._.flatMap(fieldBucket, (field) => field.slice(2)),
					];
				}
			});
			return ['And', ...fields, ...others] as AbstractSqlQuery;
		}),
		(args) => {
			checkMinArgs('And', args, 2);
			return [
				'And',
				...args.map((arg) => {
					if (!isAbstractSqlQuery(arg)) {
						throw new SyntaxError(
							`Expected AbstractSqlQuery array but got ${typeof arg}`,
						);
					}
					return BooleanValue(arg);
				}),
			];
		},
	),
	Or: tryMatches(
		Helper<OptimisationMatchFn>((args) => {
			if (args.length !== 1) {
				return false;
			}
			return getAbstractSqlQuery(args, 0);
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkMinArgs('Or', args, 2);
			// Collapse nested ORs.
			let maybeHelped = false;
			const conditions = _.flatMap(args, (arg) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				if (arg[0] === 'Or') {
					maybeHelped = true;
					return arg.slice(1);
				}
				return [arg];
			});
			if (!maybeHelped) {
				// Make sure we actually hit an optimisation case
				return false;
			}

			return ['Or', ...conditions] as AbstractSqlQuery;
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkMinArgs('Or', args, 2);
			// Reduce any booleans
			let maybeHelped = false;
			let containsTrue = false;
			const conditions = args.filter((arg) => {
				if (arg[0] === 'Boolean') {
					if (arg[1] === false) {
						maybeHelped = true;
						return false;
					} else if (arg[1] === true) {
						containsTrue = true;
					}
				}
				return true;
			});
			if (containsTrue) {
				return ['Boolean', true] as AbstractSqlQuery;
			}
			if (maybeHelped) {
				return ['Or', ...conditions] as AbstractSqlQuery;
			}
			return false;
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkMinArgs('Or', args, 2);
			// Optimise id = 1 OR id = 2 OR id = 3 -> id IN [1, 2, 3]
			const fieldBuckets: Dictionary<AbstractSqlQuery[]> = {};
			const others: AbstractSqlQuery[] = [];
			let maybeHelped = false;
			args.map((arg) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				if (arg[0] === 'Equals') {
					const fieldBool = FieldEquals(arg.slice(1));
					if (fieldBool !== false) {
						const fieldRef = fieldBool[1] as string;
						if (fieldBuckets[fieldRef] == null) {
							fieldBuckets[fieldRef] = [fieldBool];
						} else {
							// We're adding a second match, so that means we can optimise
							maybeHelped = true;
							fieldBuckets[fieldRef].push(fieldBool);
						}
						return;
					}
				} else if (arg[0] === 'In') {
					const fieldRef = arg[1] as string;
					if (fieldBuckets[fieldRef] == null) {
						fieldBuckets[fieldRef] = [arg];
					} else {
						// We're adding a second match, so that means we can optimise
						maybeHelped = true;
						fieldBuckets[fieldRef].push(arg);
					}
					return;
				}
				others.push(arg);
			});
			// Make sure we have at least some fields entries that can be optimised
			if (!maybeHelped) {
				return false;
			}
			const fields = Object.keys(fieldBuckets).map((fieldRef) => {
				const fieldBucket = fieldBuckets[fieldRef];
				if (fieldBucket.length === 1) {
					return fieldBucket[0];
				} else {
					return [
						'In',
						fieldBucket[0][1],
						..._.flatMap(fieldBucket, (field) => field.slice(2)),
					];
				}
			});
			return ['Or', ...fields, ...others] as AbstractSqlQuery;
		}),
		(args) => {
			checkMinArgs('Or', args, 2);
			return [
				'Or',
				...args.map((arg) => {
					if (!isAbstractSqlQuery(arg)) {
						throw new SyntaxError(
							`Expected AbstractSqlQuery array but got ${typeof arg}`,
						);
					}
					return BooleanValue(arg);
				}),
			];
		},
	),
	Bind: (args) => {
		if (noBinds) {
			throw new SyntaxError('Cannot use a bind whilst they are disabled');
		}
		if (args.length !== 1 && args.length !== 2) {
			throw new SyntaxError(`"Bind" requires 1/2 arg(s)`);
		}
		return ['Bind', ...args];
	},
	Text,
	Value: Text,
	Date: matchArgs('Date', _.identity),
	Duration: (args) => {
		checkArgs('Duration', args, 1);

		let duration = args[0] as DurationNode[1];
		if (duration == null || typeof duration !== 'object') {
			throw new SyntaxError(
				`Duration must be an object, got ${typeof duration}`,
			);
		}
		duration = _(duration)
			.pick('negative', 'day', 'hour', 'minute', 'second')
			.omitBy(_.isNil)
			.value();
		if (_(duration).omit('negative').isEmpty()) {
			throw new SyntaxError('Invalid duration');
		}
		return ['Duration', duration] as AbstractSqlQuery;
	},
	Exists: tryMatches(
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('Exists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			if (isNotNullable(arg)) {
				return ['Boolean', true] as AbstractSqlQuery;
			}
			return false;
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('Exists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			if (isEmptySelectQuery(arg)) {
				return ['Boolean', false] as AbstractSqlQuery;
			}
			return false;
		}),
		(args) => {
			checkArgs('Exists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			const [type, ...rest] = arg;
			switch (type) {
				case 'SelectQuery':
				case 'UnionQuery':
					return ['Exists', typeRules[type](rest)];
				default:
					return ['Exists', AnyValue(arg)];
			}
		},
	),
	NotExists: tryMatches(
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('Exists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			if (isNotNullable(arg)) {
				return ['Boolean', false] as AbstractSqlQuery;
			}
			return false;
		}),
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('Exists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			if (isEmptySelectQuery(arg)) {
				return ['Boolean', true] as AbstractSqlQuery;
			}
			return false;
		}),
		(args) => {
			checkArgs('NotExists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			const [type, ...rest] = arg;
			switch (type) {
				case 'SelectQuery':
				case 'UnionQuery':
					return ['NotExists', typeRules[type](rest)];
				default:
					return ['NotExists', AnyValue(arg)];
			}
		},
	),
	Not: tryMatches(
		Helper<OptimisationMatchFn>((args) => {
			checkArgs('Not', args, 1);
			const [type, ...rest] = getAbstractSqlQuery(args, 0);
			switch (type) {
				case 'Not':
					return BooleanValue(rest[0] as AbstractSqlQuery);
				case 'Equals':
					return typeRules.NotEquals(rest);
				case 'NotEquals':
					return typeRules.Equals(rest);
				case 'In':
					return typeRules.NotIn(rest);
				case 'NotIn':
					return typeRules.In(rest);
				case 'Exists':
					return typeRules.NotExists(rest);
				case 'NotExists':
					return typeRules.Exists(rest);
				default:
					return false;
			}
		}),
		matchArgs('Not', BooleanValue),
	),
	In: (args) => {
		checkMinArgs('In', args, 2);
		const field = Field(getAbstractSqlQuery(args, 0));
		const vals = args.slice(1).map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return AnyValue(arg);
		});
		return ['In', field, ...vals];
	},
	NotIn: (args) => {
		checkMinArgs('NotIn', args, 2);
		const field = Field(getAbstractSqlQuery(args, 0));
		const vals = args.slice(1).map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return AnyValue(arg);
		});
		return ['NotIn', field, ...vals];
	},
	InsertQuery: (args) => {
		const tables: AbstractSqlQuery[] = [];
		let fields: AbstractSqlQuery[] = [];
		let values: AbstractSqlQuery[] = [];
		const where: AbstractSqlQuery[] = [];
		for (const arg of args) {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError('`InsertQuery` args must all be arrays');
			}
			const [type, ...rest] = arg;
			switch (type) {
				case 'Fields':
					if (fields.length !== 0) {
						throw new SyntaxError(
							`'InsertQuery' can only accept one '${type}'`,
						);
					}
					checkMinArgs('Update fields', rest, 1);
					fields = [arg];
					break;
				case 'Values':
					if (values.length !== 0) {
						throw new SyntaxError(
							`'InsertQuery' can only accept one '${type}'`,
						);
					}
					const valuesArray = getAbstractSqlQuery(rest, 0);
					if (valuesArray.length > 0) {
						const [valuesType, ...valuesRest] = valuesArray;
						switch (valuesType) {
							case 'SelectQuery':
							case 'UnionQuery':
								values = [['Values', typeRules[valuesType](valuesRest)]];
								break;
							default:
								values = [
									['Values', valuesArray.map(Value)] as AbstractSqlQuery,
								];
						}
					}
					break;
				case 'From':
					tables.push(typeRules[type](rest));
					break;
				case 'Where':
					// We ignore `Where` in insert queries
					break;
				default:
					throw new SyntaxError(`'InsertQuery' does not support '${type}'`);
			}
		}
		if (tables.length === 0) {
			throw new SyntaxError("'InsertQuery' must have a From component");
		}
		if (fields.length === 0) {
			throw new SyntaxError("'InsertQuery' requires a Fields component");
		}
		if (values.length === 0 && fields[0][1].length !== 0) {
			throw new SyntaxError(
				"'InsertQuery' requires Values component to be present if Fields are provided ",
			);
		}
		if (
			fields.length !== 0 &&
			values.length !== 0 &&
			!['SelectQuery', 'UnionQuery'].includes(values[0][0] as string) &&
			fields[0].length !== values[0].length
		) {
			throw new SyntaxError(
				"'InsertQuery' requires Fields and Values components to have the same length or use a query for Values",
			);
		}
		return [
			'InsertQuery',
			...tables,
			...fields,
			...values,
			...where,
		] as AbstractSqlQuery;
	},
	UpdateQuery: (args) => {
		const tables: AbstractSqlQuery[] = [];
		let fields: AbstractSqlQuery[] = [];
		let values: AbstractSqlQuery[] = [];
		let where: AbstractSqlQuery[] = [];
		for (const arg of args) {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError('`UpdateQuery` args must all be arrays');
			}
			const [type, ...rest] = arg;
			switch (type) {
				case 'Fields':
					if (fields.length !== 0) {
						throw new SyntaxError(
							`'UpdateQuery' can only accept one '${type}'`,
						);
					}
					checkMinArgs('Update fields', rest, 1);
					fields = [arg];
					break;
				case 'Values':
					if (values.length !== 0) {
						throw new SyntaxError(
							`'UpdateQuery' can only accept one '${type}'`,
						);
					}
					checkArgs('Update values', rest, 1);
					const valuesArray = getAbstractSqlQuery(rest, 0);
					checkMinArgs('Update values array', valuesArray, 1);
					values = [['Values', valuesArray.map(Value)] as AbstractSqlQuery];
					break;
				case 'From':
					tables.push(typeRules[type](rest));
					break;
				case 'Where':
					if (where.length !== 0) {
						throw new SyntaxError(
							`'UpdateQuery' can only accept one '${type}'`,
						);
					}
					where = [typeRules[type](rest)];
					break;
				default:
					throw new SyntaxError(`'UpdateQuery' does not support '${type}'`);
			}
		}
		if (tables.length === 0) {
			throw new SyntaxError("'UpdateQuery' must have a From component");
		}
		if (fields.length === 0) {
			throw new SyntaxError("'UpdateQuery' requires a Fields component");
		}
		if (values.length === 0) {
			throw new SyntaxError("'UpdateQuery' requires a Values component");
		}

		return [
			'UpdateQuery',
			...tables,
			...fields,
			...values,
			...where,
		] as AbstractSqlQuery;
	},
	DeleteQuery: (args) => {
		const tables: AbstractSqlQuery[] = [];
		let where: AbstractSqlQuery[] = [];
		for (const arg of args) {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError('`DeleteQuery` args must all be arrays');
			}
			const [type, ...rest] = arg;
			switch (type) {
				case 'From':
					tables.push(typeRules[type](rest));
					break;
				case 'Where':
					if (where.length !== 0) {
						throw new SyntaxError(
							`'DeleteQuery' can only accept one '${type}'`,
						);
					}
					where = [typeRules[type](rest)];
					break;
				default:
					throw new SyntaxError(`'DeleteQuery' does not support '${type}'`);
			}
		}
		if (tables.length === 0) {
			throw new SyntaxError("'DeleteQuery' must have a From component");
		}

		return ['DeleteQuery', ...tables, ...where] as AbstractSqlQuery;
	},

	// Virtual functions
	Now: rewriteMatch(
		'Now',
		[],
		Helper<MatchFn>(([]) => ['CurrentTimestamp']),
	),
	Contains: rewriteMatch(
		'Contains',
		[TextValue, TextValue],
		Helper<MatchFn>(([haystack, needle]) => [
			'Like',
			haystack,
			[
				'Concatenate',
				['EmbeddedText', '%'],
				escapeForLike(needle),
				['EmbeddedText', '%'],
			],
		]),
	),
	Substringof: rewriteMatch(
		'Substringof',
		[TextValue, TextValue],
		Helper<MatchFn>(([needle, haystack]) => [
			'Like',
			haystack,
			[
				'Concatenate',
				['EmbeddedText', '%'],
				escapeForLike(needle),
				['EmbeddedText', '%'],
			],
		]),
	),
	Startswith: rewriteMatch(
		'Startswith',
		[TextValue, TextValue],
		Helper<MatchFn>(([haystack, needle]) => [
			'Like',
			haystack,
			['Concatenate', escapeForLike(needle), ['EmbeddedText', '%']],
		]),
	),
	Endswith: rewriteMatch(
		'Endswith',
		[TextValue, TextValue],
		Helper<MatchFn>(([haystack, needle]) => [
			'Like',
			haystack,
			['Concatenate', ['EmbeddedText', '%'], escapeForLike(needle)],
		]),
	),
	IndexOf: rewriteMatch(
		'IndexOf',
		[TextValue, TextValue],
		Helper<MatchFn>(([haystack, needle]) => [
			'Subtract',
			['StrPos', haystack, needle],
			['Number', 1],
		]),
	),
	Indexof: rewriteMatch(
		'Indexof',
		[TextValue, TextValue],
		Helper<MatchFn>(([haystack, needle]) => [
			'Subtract',
			['StrPos', haystack, needle],
			['Number', 1],
		]),
	),
};

export const AbstractSQLOptimiser = (
	abstractSQL: AbstractSqlQuery,
	$noBinds = false,
): AbstractSqlQuery => {
	noBinds = $noBinds;
	do {
		helped = false;
		const [type, ...rest] = abstractSQL;
		switch (type) {
			case 'SelectQuery':
			case 'UnionQuery':
			case 'InsertQuery':
			case 'UpdateQuery':
			case 'DeleteQuery':
				abstractSQL = typeRules[type](rest);
				break;
			case 'UpsertQuery':
				checkArgs('UpsertQuery', rest, 2);
				const insertQuery = getAbstractSqlQuery(rest, 0);
				const updateQuery = getAbstractSqlQuery(rest, 1);
				if (
					insertQuery[0] !== 'InsertQuery' ||
					updateQuery[0] !== 'UpdateQuery'
				) {
					throw new SyntaxError(
						'UpsertQuery must have [InsertQuery, UpdateQuery] provided',
					);
				}
				abstractSQL = [
					'UpsertQuery',
					typeRules.InsertQuery(insertQuery.slice(1)),
					typeRules.UpdateQuery(updateQuery.slice(1)),
				];
				break;
			default:
				abstractSQL = AnyValue(abstractSQL);
		}
	} while (helped);
	return abstractSQL;
};
