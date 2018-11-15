import * as _ from 'lodash';

import { AbstractSqlQuery } from './AbstractSQLCompiler';
import * as AbstractSQLRules2SQL from './AbstractSQLRules2SQL';
import { Dictionary } from 'lodash';

type OptimisationMatchFn = (args: AbstractSqlQuery) => AbstractSqlQuery | false;
type MatchFn = (args: AbstractSqlQuery) => AbstractSqlQuery;

const escapeForLike = (str: AbstractSqlQuery) => [
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

type FnArgs<T> = T extends (...args: infer U) => any ? U : any[];

let helped = false;
const Helper = <F extends (...args: any[]) => any>(fn: F) => {
	return (...args: FnArgs<F>): ReturnType<F> => {
		const result = fn(...args);
		if (result !== false) {
			helped = true;
		}
		return result;
	};
};

type RewriteFn = (args: AbstractSqlQuery[]) => AbstractSqlQuery;

const rewriteMatch = (
	name: string,
	matchers: MatchFn[],
	rewriteFn: RewriteFn,
): MatchFn => args => {
	checkArgs(name, args, matchers.length);
	return rewriteFn(
		args.map((arg, index) => {
			// Type cast because of cases where not all nodes are arrays, but we do handle them correctly where they can occur
			return matchers[index](arg as AbstractSqlQuery);
		}),
	);
};

const matchArgs = (name: string, ...matchers: MatchFn[]): MatchFn =>
	rewriteMatch(name, matchers, args => [name, ...args]);

const tryMatches = (...matchers: OptimisationMatchFn[]): MatchFn => {
	return args => {
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

const AnyValue: MatchFn = args => {
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
const UnknownValue: MatchFn = args => {
	if ((args as any) === 'Null') {
		helped = true;
		args = [args];
	}
	const [type, ...rest] = args;
	switch (type) {
		case 'Null':
		case 'Field':
		case 'ReferencedField':
		case 'Bind':
		case 'Cast':
			return typeRules[type](rest);
		case 'SelectQuery':
		case 'UnionQuery':
			return typeRules[type](rest);
		default:
			throw new Error(`Invalid "UnknownValue" type: ${type}`);
	}
};
const MatchValue = (
	matcher: (type: string | AbstractSqlQuery) => type is string,
): MatchFn => args => {
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

const isDateValue = AbstractSQLRules2SQL.isDateValue;
const DateValue = MatchValue(isDateValue);

const isJSONValue = AbstractSQLRules2SQL.isJSONValue;

const isDurationValue = AbstractSQLRules2SQL.isDurationValue;
const DurationValue = MatchValue(isDurationValue);

const isFieldValue = (
	type: string | AbstractSqlQuery,
): type is 'Field' | 'ReferencedField' => {
	return type === 'Field' || type === 'ReferencedField';
};
const Field: MatchFn = args => {
	const [type, ...rest] = args;
	if (isFieldValue(type)) {
		return typeRules[type](rest);
	} else {
		throw new SyntaxError(`Invalid field type: ${type}`);
	}
};

const AnyNotNullValue: OptimisationMatchFn = args => {
	if (args == null || (args as any) === 'Null' || args[0] === 'Null') {
		throw false;
	}
	return args;
};

const FieldOp = (type: string): OptimisationMatchFn => args => {
	if (
		AnyNotNullValue(args[0] as AbstractSqlQuery) === false ||
		AnyNotNullValue(args[1] as AbstractSqlQuery) === false
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

const getAbstractSqlQuery = (
	args: AbstractSqlQuery,
	index: number,
): AbstractSqlQuery => {
	const abstractSqlQuery = args[index];
	if (!_.isArray(abstractSqlQuery)) {
		throw new SyntaxError(
			`Expected AbstractSqlQuery array but got ${typeof abstractSqlQuery}`,
		);
	}
	return abstractSqlQuery;
};

const Comparison = (
	comparison: keyof typeof AbstractSQLRules2SQL.comparisons,
): MatchFn => {
	return matchArgs(comparison, AnyValue, AnyValue);
};
const NumberMatch = (type: string): MatchFn => {
	return matchArgs(type, arg => {
		if (!_.isNumber(arg)) {
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

const Concatenate: MatchFn = args => {
	checkMinArgs('Concatenate', args, 1);
	return [
		'Concatenate',
		...args.map(arg => {
			if (!_.isArray(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return TextValue(arg);
		}),
	];
};

const Text: MatchFn = matchArgs('Text', _.identity);

const checkArgs = (matchName: string, args: AbstractSqlQuery, num: number) => {
	if (args.length !== num) {
		throw new SyntaxError(`"${matchName}" requires ${num} arg(s)`);
	}
};
const checkMinArgs = (
	matchName: string,
	args: AbstractSqlQuery,
	num: number,
) => {
	if (args.length < num) {
		throw new SyntaxError(`"${matchName}" requires at least ${num} arg(s)`);
	}
};

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

const SelectMatch: MatchFn = args => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Count':
			return typeRules[type](rest);
		default:
			return AnyValue(args);
	}
};
const FromMatch: MatchFn = args => {
	if (_.isString(args)) {
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
	matchFn: MatchFn,
): AbstractSqlQuery => {
	if (
		args.length === 2 &&
		args[0] !== 'Table' &&
		args[0] !== 'Count' &&
		_.isString(args[1])
	) {
		helped = true;
		return ['Alias', matchFn(args[0] as AbstractSqlQuery), args[1]];
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

const typeRules: Dictionary<MatchFn> = {
	UnionQuery: args => {
		checkMinArgs('UnionQuery', args, 2);
		return [
			'UnionQuery',
			...args.map(arg => {
				if (!_.isArray(arg)) {
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
	SelectQuery: args => {
		const tables = [];
		let select: AbstractSqlQuery = [];
		const groups = {
			Where: [] as AbstractSqlQuery,
			GroupBy: [] as AbstractSqlQuery,
			OrderBy: [] as AbstractSqlQuery,
			Limit: [] as AbstractSqlQuery,
			Offset: [] as AbstractSqlQuery,
		};
		for (const arg of args) {
			if (!_.isArray(arg)) {
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
					tables.push(typeRules[type](rest));
					break;
				case 'Where':
				case 'GroupBy':
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
			...groups.OrderBy,
			...groups.Limit,
			...groups.Offset,
		];
	},
	Select: args => {
		checkArgs('Select', args, 1);
		return [
			'Select',
			getAbstractSqlQuery(args, 0).map(arg => {
				if (!_.isArray(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				return MaybeAlias(arg, SelectMatch);
			}),
		];
	},
	From: args => {
		checkArgs('From', args, 1);
		return ['From', MaybeAlias(args[0] as AbstractSqlQuery, FromMatch)];
	},
	Where: matchArgs('Where', BooleanValue),
	OrderBy: args => {
		checkMinArgs('OrderBy', args, 1);
		return [
			'OrderBy',
			...args.map((arg: AbstractSqlQuery) => {
				checkMinArgs('OrderBy ordering', arg, 2);
				const order = arg[0];
				if (order !== 'ASC' && order !== 'DESC') {
					throw new SyntaxError(`Can only order by "ASC" or "DESC"`);
				}
				const field = Field(getAbstractSqlQuery(arg, 1));
				return [order, field];
			}),
		];
	},
	Limit: matchArgs('Limit', NumericValue),
	Offset: matchArgs('Offset', NumericValue),
	Count: args => {
		checkArgs('Count', args, 1);
		if (args[0] !== '*') {
			throw new SyntaxError('"Count" only supports "*"');
		}
		return ['Count', args[0]];
	},
	Field: matchArgs('Field', _.identity),
	ReferencedField: matchArgs('ReferencedField', _.identity, _.identity),
	Cast: matchArgs('Cast', AnyValue, _.identity),
	Number: NumberMatch('Number'),
	Real: NumberMatch('Real'),
	Integer: NumberMatch('Integer'),
	Boolean: matchArgs('Boolean', _.identity),
	EmbeddedText: matchArgs('EmbeddedText', _.identity),
	Null: matchArgs('Null'),
	Now: matchArgs('Now'),
	AggregateJSON: matchArgs('AggregateJSON', _.identity),
	Equals: tryMatches(
		Helper(args => {
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
		Helper(args => {
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
	Add: MathOp('Add'),
	Subtract: MathOp('Subtract'),
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
	Concatenate: Concatenate,
	Replace: matchArgs('Replace', TextValue, TextValue, TextValue),
	CharacterLength: matchArgs('CharacterLength', TextValue),
	StrPos: matchArgs('StrPos', TextValue, TextValue),
	Substring: args => {
		checkMinArgs('Substring', args, 2);
		const str = TextValue(getAbstractSqlQuery(args, 0));
		const nums = args.slice(1).map(arg => {
			if (!_.isArray(arg)) {
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
	Lower: Lower,
	Toupper: Upper,
	ToUpper: Upper,
	Upper: Upper,
	Trim: matchArgs('Trim', TextValue),
	Round: matchArgs('Round', NumericValue),
	Floor: matchArgs('Floor', NumericValue),
	Ceiling: matchArgs('Ceiling', NumericValue),
	ToDate: matchArgs('ToDate', DateValue),
	ToTime: matchArgs('ToTime', DateValue),
	Case: args => {
		checkMinArgs('Case', args, 1);
		return [
			'Case',
			...args.map((arg, index) => {
				if (!_.isArray(arg)) {
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
		];
	},
	And: tryMatches(
		Helper(args => {
			if (args.length !== 1) {
				return false;
			}
			return args[0];
		}),
		Helper<OptimisationMatchFn>(args => {
			checkMinArgs('And', args, 2);
			// Optimise id != 1 AND id != 2 AND id != 3 -> id NOT IN [1, 2, 3]
			const fieldBuckets: Dictionary<AbstractSqlQuery[]> = {};
			const others: AbstractSqlQuery[] = [];
			let maybeHelped = false;
			args.map(arg => {
				if (!_.isArray(arg)) {
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
				}
				others.push(arg);
			});
			// Make sure we have at least some fields entries that can be optimised
			if (!maybeHelped) {
				return false;
			}
			const fields = _.map(fieldBuckets, fields => {
				if (fields.length === 1) {
					return fields[0];
				} else {
					return ['NotIn', fields[0][1], ..._.map(fields, 2)];
				}
			});
			return ['And', ...fields, ...others];
		}),
		Helper(args => {
			checkMinArgs('And', args, 2);
			// Collapse nested ANDs.
			let maybeHelped = false;
			const conditions = _.flatMap(args, arg => {
				if (!_.isArray(arg)) {
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

			return ['And', ...conditions];
		}),
		args => {
			checkMinArgs('And', args, 2);
			return [
				'And',
				...args.map(arg => {
					if (!_.isArray(arg)) {
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
		Helper(args => {
			if (args.length !== 1) {
				return false;
			}
			return args[0];
		}),
		Helper<OptimisationMatchFn>(args => {
			checkMinArgs('Or', args, 2);
			// Optimise id = 1 OR id = 2 OR id = 3 -> id IN [1, 2, 3]
			const fieldBuckets: Dictionary<AbstractSqlQuery[]> = {};
			const others: AbstractSqlQuery[] = [];
			let maybeHelped = false;
			args.map(arg => {
				if (!_.isArray(arg)) {
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
				}
				others.push(arg);
			});
			// Make sure we have at least some fields entries that can be optimised
			if (!maybeHelped) {
				return false;
			}
			const fields = _.map(fieldBuckets, fields => {
				if (fields.length === 1) {
					return fields[0];
				} else {
					maybeHelped = true;
					return ['In', fields[0][1], ..._.map(fields, 2)];
				}
			});
			return ['Or', ...fields, ...others];
		}),
		Helper(args => {
			checkMinArgs('Or', args, 2);
			// Collapse nested ORs.
			let maybeHelped = false;
			const conditions = _.flatMap(args, arg => {
				if (!_.isArray(arg)) {
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

			return ['Or', ...conditions];
		}),
		args => {
			checkMinArgs('Or', args, 2);
			return [
				'Or',
				...args.map(arg => {
					if (!_.isArray(arg)) {
						throw new SyntaxError(
							`Expected AbstractSqlQuery array but got ${typeof arg}`,
						);
					}
					return BooleanValue(arg);
				}),
			];
		},
	),
	Bind: args => {
		if (args.length !== 1 && args.length !== 2) {
			throw new SyntaxError(`"Bind" requires 1/2 arg(s)`);
		}
		return ['Bind', ...args];
	},
	Text: Text,
	Value: Text,
	Date: matchArgs('Date', _.identity),
	Duration: args => {
		checkArgs('Duration', args, 1);

		// TODO: The abstract sql type should accommodate this
		let duration = (args[0] as any) as Dictionary<string>;
		if (!_.isObject(duration)) {
			throw new SyntaxError(
				`Duration must be an object, got ${typeof duration}`,
			);
		}
		duration = _(duration)
			.pick('negative', 'day', 'hour', 'minute', 'second')
			.omitBy(_.isNil)
			.value();
		if (
			_(duration)
				.omit('negative')
				.isEmpty()
		) {
			throw new SyntaxError('Invalid duration');
		}
		return ['Duration', duration] as AbstractSqlQuery;
	},
	Exists: args => {
		checkArgs('Exists', args, 1);
		args = getAbstractSqlQuery(args, 0);
		const [type, ...rest] = args;
		switch (type) {
			case 'SelectQuery':
			case 'UnionQuery':
				return ['Exists', typeRules[type](rest)];
			default:
				return ['Exists', AnyValue(args)];
		}
	},
	NotExists: args => {
		checkArgs('NotExists', args, 1);
		args = getAbstractSqlQuery(args, 0);
		const [type, ...rest] = args;
		switch (type) {
			case 'SelectQuery':
			case 'UnionQuery':
				return ['NotExists', typeRules[type](rest)];
			default:
				return ['NotExists', AnyValue(args)];
		}
	},
	Not: tryMatches(
		Helper(args => {
			checkArgs('Not', args, 1);
			const [type, ...rest] = getAbstractSqlQuery(args, 0);
			switch (type) {
				case 'Not':
					return typeRules.BooleanValue(rest);
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
	In: args => {
		checkMinArgs('In', args, 2);
		const field = Field(getAbstractSqlQuery(args, 0));
		const vals = args.slice(1).map(arg => {
			if (!_.isArray(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return AnyValue(arg);
		});
		return ['In', field, ...vals];
	},
	NotIn: args => {
		checkMinArgs('NotIn', args, 2);
		const field = Field(getAbstractSqlQuery(args, 0));
		const vals = args.slice(1).map(arg => {
			if (!_.isArray(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return AnyValue(arg);
		});
		return ['NotIn', field, ...vals];
	},
	InsertQuery: args => {
		const tables = [];
		let fields: AbstractSqlQuery = [];
		let values: AbstractSqlQuery = [];
		let where: AbstractSqlQuery = [];
		for (const arg of args) {
			if (!_.isArray(arg)) {
				throw new SyntaxError('`SelectQuery` args must all be arrays');
			}
			const [type, ...rest] = arg;
			switch (type) {
				case 'Fields':
					if (fields.length !== 0) {
						throw new SyntaxError(
							`'SelectQuery' can only accept one '${type}'`,
						);
					}
					checkMinArgs('Update fields', rest, 1);
					fields = arg;
					break;
				case 'Values':
					if (values.length !== 0) {
						throw new SyntaxError(
							`'SelectQuery' can only accept one '${type}'`,
						);
					}
					values = getAbstractSqlQuery(rest, 0);
					if (values.length > 0) {
						const [valuesType, ...valuesRest] = values;
						switch (valuesType) {
							case 'SelectQuery':
							case 'UnionQuery':
								values = typeRules[valuesType](valuesRest);
								break;
							default:
								values = values.map(Value);
						}
					}
					values = ['Values', values];
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
		if (
			!['SelectQuery', 'UnionQuery'].includes(values[0] as string) &&
			fields.length !== values.length
		) {
			throw new SyntaxError(
				'Fields and Values must have the same length or use a query',
			);
		}
		return ['InsertQuery', ...tables, fields, values, ...where];
	},
	UpdateQuery: args => {
		const tables = [];
		let fields: AbstractSqlQuery = [];
		let values: AbstractSqlQuery = [];
		let where: AbstractSqlQuery = [];
		for (const arg of args) {
			if (!_.isArray(arg)) {
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
					fields = arg;
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
					values = ['Values', valuesArray.map(Value)];
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
					where = typeRules[type](rest);
					break;
				default:
					throw new SyntaxError(`'UpdateQuery' does not support '${type}'`);
			}
		}
		if (fields.length !== values.length) {
			throw new SyntaxError('Fields and Values must have the same length');
		}

		return ['UpdateQuery', ...tables, fields, values, where];
	},
	DeleteQuery: args => {
		const tables = [];
		let where: AbstractSqlQuery = [];
		for (const arg of args) {
			if (!_.isArray(arg)) {
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
					where = typeRules[type](rest);
					break;
				default:
					throw new SyntaxError(`'DeleteQuery' does not support '${type}'`);
			}
		}

		return ['DeleteQuery', ...tables, where];
	},

	// Virtual functions
	Contains: rewriteMatch(
		'Contains',
		[TextValue, TextValue],
		Helper(([haystack, needle]) => [
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
		Helper(([needle, haystack]) => [
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
		Helper(([haystack, needle]) => [
			'Like',
			haystack,
			['Concatenate', escapeForLike(needle), ['EmbeddedText', '%']],
		]),
	),
	Endswith: rewriteMatch(
		'Endswith',
		[TextValue, TextValue],
		Helper(([haystack, needle]) => [
			'Like',
			haystack,
			['Concatenate', ['EmbeddedText', '%'], escapeForLike(needle)],
		]),
	),
	IndexOf: rewriteMatch(
		'IndexOf',
		[TextValue, TextValue],
		Helper(([haystack, needle]) => [
			'Subtract',
			['StrPos', haystack, needle],
			['Number', 1],
		]),
	),
	Indexof: rewriteMatch(
		'Indexof',
		[TextValue, TextValue],
		Helper(([haystack, needle]) => [
			'Subtract',
			['StrPos', haystack, needle],
			['Number', 1],
		]),
	),
};

export const AbstractSQLOptimiser = (
	abstractSQL: AbstractSqlQuery,
): AbstractSqlQuery => {
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
