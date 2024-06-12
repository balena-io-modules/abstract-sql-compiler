import * as _ from 'lodash';

import type { Dictionary } from 'lodash';
import type {
	AbstractSqlQuery,
	AbstractSqlType,
	AddDateDurationNode,
	AddDateNumberNode,
	AddNode,
	AggregateJSONNode,
	AliasNode,
	AndNode,
	AnyNode,
	AnyTypeNodes,
	BetweenNode,
	BindNode,
	BitwiseAndNode,
	BitwiseShiftRightNode,
	BooleanNode,
	BooleanTypeNodes,
	CaseNode,
	CastNode,
	CeilingNode,
	CharacterLengthNode,
	CoalesceNode,
	ConcatenateNode,
	ConcatenateWithSeparatorNode,
	CrossJoinNode,
	CurrentDateNode,
	CurrentTimestampNode,
	DateTruncNode,
	DeleteQueryNode,
	DivideNode,
	DurationNode,
	ElseNode,
	EqualsNode,
	ExistsNode,
	ExtractJSONPathAsTextNode,
	ExtractNumericDateTypeNodes,
	FieldNode,
	FieldsNode,
	FloorNode,
	FromNode,
	FullJoinNode,
	GreaterThanNode,
	GreaterThanOrEqualNode,
	GroupByNode,
	HavingNode,
	InNode,
	InnerJoinNode,
	InsertQueryNode,
	IntegerNode,
	IsDistinctFromNode,
	IsNotDistinctFromNode,
	JSONTypeNodes,
	JoinTypeNodes,
	LeftJoinNode,
	LessThanNode,
	LessThanOrEqualNode,
	LikeNode,
	LimitNode,
	LowerNode,
	MultiplyNode,
	NotEqualsNode,
	NotExistsNode,
	NotNode,
	NullNode,
	NumberNode,
	NumberTypeNodes,
	OffsetNode,
	OrNode,
	OrderByNode,
	RealNode,
	ReferencedFieldNode,
	ReplaceNode,
	StrictBooleanTypeNodes,
	StrictDateTypeNodes,
	StrictNumberTypeNodes,
	StrictTextTypeNodes,
	RightJoinNode,
	RightNode,
	RoundNode,
	SelectNode,
	SelectQueryNode,
	StrPosNode,
	SubtractDateDateNode,
	SubtractDateDurationNode,
	SubtractDateNumberNode,
	SubtractNode,
	TableNode,
	TextArrayTypeNodes,
	TextNode,
	TextTypeNodes,
	ToDateNode,
	ToJSONNode,
	ToTimeNode,
	TrimNode,
	UnionQueryNode,
	UnknownTypeNodes,
	UpdateQueryNode,
	UpperNode,
	ValuesNode,
	ValuesNodeTypes,
	WhenNode,
	WhereNode,
	FromTypeNode,
	StartsWithNode,
	EscapeForLikeNode,
} from './AbstractSQLCompiler';
import * as AbstractSQLRules2SQL from './AbstractSQLRules2SQL';

const {
	isAbstractSqlQuery,
	getAbstractSqlQuery,
	checkArgs,
	checkMinArgs,
	isNotNullable,
} = AbstractSQLRules2SQL;

type OptimisationMatchFn<T extends AnyTypeNodes> =
	| ((args: AbstractSqlType[]) => T | false)
	| ((args: AbstractSqlType[]) => T);
type MetaMatchFn<T extends AnyTypeNodes> = (args: AbstractSqlQuery) => T;
type MatchFn<T extends AnyTypeNodes> = (args: AbstractSqlType[]) => T;

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

const isEmptySelectQuery = (query: AnyTypeNodes): boolean => {
	const [type, ...rest] = query;
	switch (type) {
		case 'SelectQuery':
			for (const arg of rest as SelectQueryNode) {
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
	<I extends AnyTypeNodes, O extends AnyTypeNodes>(
		name: I[0],
		matchers: Array<(args: AbstractSqlType) => AbstractSqlType>,
		rewriteFn: MatchFn<O>,
	): MatchFn<O> =>
	(args) => {
		checkArgs(name, args, matchers.length);
		return rewriteFn(
			args.map((arg, index) => {
				return matchers[index](arg);
			}),
		);
	};

const matchArgs = <T extends AnyTypeNodes>(
	name: T[0],
	...matchers: Array<(args: AbstractSqlType) => AbstractSqlType>
): MatchFn<T> => rewriteMatch(name, matchers, (args) => [name, ...args] as T);

const tryMatches = <T extends AnyTypeNodes>(
	...matchers: Array<OptimisationMatchFn<T>>
): MatchFn<T> => {
	return (args): T => {
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

const AnyValue: MetaMatchFn<AnyTypeNodes> = (args) => {
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
const UnknownValue: MetaMatchFn<UnknownTypeNodes> = (args) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Null':
		case 'Field':
		case 'ReferencedField':
		case 'Bind':
		case 'Cast':
		case 'Coalesce':
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
	<T extends AnyTypeNodes>(
		matcher: (type: unknown) => type is T[0],
	): MetaMatchFn<T | UnknownTypeNodes> =>
	(args) => {
		const [type, ...rest] = args;
		if (matcher(type)) {
			return typeRules[type as keyof typeof typeRules](rest) as T;
		}
		return UnknownValue(args);
	};

const isTextValue = (
	type: unknown,
): type is
	| 'Value'
	| 'Concat'
	| 'Tolower'
	| 'ToLower'
	| 'Toupper'
	| 'ToUpper'
	| StrictTextTypeNodes[0] => {
	return (
		type === 'Value' ||
		type === 'Concat' ||
		type === 'Tolower' ||
		type === 'ToLower' ||
		type === 'Toupper' ||
		type === 'ToUpper' ||
		AbstractSQLRules2SQL.isTextValue(type)
	);
};
const TextValue = MatchValue<TextTypeNodes>(
	isTextValue as typeof AbstractSQLRules2SQL.isTextValue,
);

const isNumericValue = (
	type: unknown,
): type is 'IndexOf' | 'Indexof' | StrictNumberTypeNodes[0] => {
	return (
		type === 'IndexOf' ||
		type === 'Indexof' ||
		AbstractSQLRules2SQL.isNumericValue(type)
	);
};
const NumericValue = MatchValue(isNumericValue);

const isBooleanValue = (
	type: unknown,
): type is
	| 'Contains'
	| 'Substringof'
	| 'Startswith'
	| 'Endswith'
	| StrictBooleanTypeNodes[0] => {
	return (
		type === 'Contains' ||
		type === 'Substringof' ||
		type === 'Startswith' ||
		type === 'Endswith' ||
		AbstractSQLRules2SQL.isBooleanValue(type)
	);
};
const BooleanValue = MatchValue<BooleanTypeNodes>(
	isBooleanValue as typeof AbstractSQLRules2SQL.isBooleanValue,
);

const isDateValue = (type: unknown): type is 'Now' | StrictDateTypeNodes[0] => {
	return type === 'Now' || AbstractSQLRules2SQL.isDateValue(type);
};
const DateValue = MatchValue(isDateValue);

const { isJSONValue } = AbstractSQLRules2SQL;
const JSONValue = MatchValue<JSONTypeNodes>(isJSONValue);

const { isDurationValue } = AbstractSQLRules2SQL;
const DurationValue = MatchValue(isDurationValue);

const { isArrayValue } = AbstractSQLRules2SQL;
const ArrayValue = MatchValue<TextArrayTypeNodes>(isArrayValue);

const { isFieldValue } = AbstractSQLRules2SQL;
const Field: MetaMatchFn<FieldNode | ReferencedFieldNode> = (args) => {
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
	(type: string): OptimisationMatchFn<AnyTypeNodes> =>
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

const Comparison = <T extends AnyTypeNodes>(
	comparison: keyof typeof AbstractSQLRules2SQL.comparisons,
): MatchFn<T> => {
	return matchArgs<T>(comparison, AnyValue, AnyValue);
};
const NumberMatch = <T extends AnyTypeNodes>(type: T[0]): MatchFn<T> => {
	return matchArgs(type, (arg) => {
		if (typeof arg !== 'number') {
			throw new SyntaxError(`${type} expected number but got ${typeof arg}`);
		}
		return arg;
	});
};

type ExtractNodeType<T, U> = T extends any[]
	? T[0] extends U
		? T
		: never
	: never;
const MathOp = <
	T extends ExtractNodeType<NumberTypeNodes, AbstractSQLRules2SQL.MathOps>,
>(
	type: T[0],
): MatchFn<T> => {
	return matchArgs(type, NumericValue, NumericValue);
};

const ExtractNumericDatePart = <T extends ExtractNumericDateTypeNodes>(
	type: T[0],
): MatchFn<T> => {
	return matchArgs(type, DateValue);
};

const Concatenate: MatchFn<ConcatenateNode> = (args) => {
	checkMinArgs('Concatenate', args, 1);
	return [
		'Concatenate',
		...(args.map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return TextValue(arg);
		}) as [
			ReturnType<typeof TextValue>,
			...Array<ReturnType<typeof TextValue>>,
		]),
	];
};

const ConcatenateWithSeparator: MatchFn<ConcatenateWithSeparatorNode> = (
	args,
) => {
	checkMinArgs('ConcatenateWithSeparator', args, 2);
	return [
		'ConcatenateWithSeparator',
		...(args.map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return TextValue(arg);
		}) as [
			ReturnType<typeof TextValue>,
			ReturnType<typeof TextValue>,
			...Array<ReturnType<typeof TextValue>>,
		]),
	];
};

const Text = matchArgs<TextNode>('Text', _.identity);

const Value = (arg: string | AbstractSqlQuery): ValuesNodeTypes => {
	switch (arg) {
		case 'Default':
			return arg;
		default: {
			const [type, ...rest] = arg;
			switch (type) {
				case 'Null':
				case 'Bind':
				case 'Value':
				case 'Text':
				case 'Number':
				case 'Real':
				case 'Integer':
				case 'Boolean':
					return typeRules[type](rest) as
						| NullNode
						| BindNode
						| TextNode
						| NumberNode
						| RealNode
						| IntegerNode;
				default:
					throw new SyntaxError(`Invalid type for Value ${type}`);
			}
		}
	}
};

const FromMatch: MetaMatchFn<FromTypeNode[keyof FromTypeNode]> = (args) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'SelectQuery':
		case 'UnionQuery':
			return typeRules[type](rest);
		case 'Table':
			checkArgs('Table', rest, 1);
			return ['Table', rest[0] as TableNode[1]];
		default:
			throw new SyntaxError(`From does not support ${type}`);
	}
};

const MaybeAlias = <T extends AnyTypeNodes>(
	args: AbstractSqlQuery,
	matchFn: MetaMatchFn<T>,
): T | AliasNode<T> => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Alias':
			checkArgs('Alias', rest, 2);
			return [
				'Alias',
				matchFn(getAbstractSqlQuery(rest, 0)),
				rest[1] as AliasNode<T>[2],
			];
		default:
			return matchFn(args);
	}
};

const Lower = matchArgs<LowerNode>('Lower', TextValue);
const Upper = matchArgs<UpperNode>('Upper', TextValue);

const JoinMatch =
	<T extends JoinTypeNodes>(joinType: T[0]): MatchFn<T> =>
	(args) => {
		if (args.length !== 1 && args.length !== 2) {
			throw new SyntaxError(`"${joinType}" requires 1/2 arg(s)`);
		}
		const from = MaybeAlias(getAbstractSqlQuery(args, 0), FromMatch);
		if (args.length === 1) {
			return [joinType, from] as T;
		}
		const [type, ...rest] = getAbstractSqlQuery(args, 1);
		switch (type) {
			case 'On':
				if (joinType !== 'CrossJoin') {
					checkArgs('On', rest, 1);
					const ruleBody = BooleanValue(getAbstractSqlQuery(rest, 0));
					return [joinType, from, ['On', ruleBody]] as unknown as T;
				}
			// eslint-disable-next-line no-fallthrough
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

const SubtractDateMatcher = tryMatches<
	SubtractDateDateNode | SubtractDateDurationNode | SubtractDateNumberNode
>(
	matchArgs<SubtractDateDateNode>('SubtractDateDate', DateValue, DateValue),
	matchArgs<SubtractDateDurationNode>(
		'SubtractDateDuration',
		DateValue,
		DurationValue,
	),
	matchArgs<SubtractDateNumberNode>(
		'SubtractDateNumber',
		DateValue,
		NumericValue,
	),
);

const EndsWithMatcher = rewriteMatch(
	'Endswith',
	[TextValue, TextValue],
	Helper<MatchFn<LikeNode>>(
		([haystack, needle]: [TextTypeNodes, TextTypeNodes]) => [
			'Like',
			haystack,
			['Concatenate', ['EmbeddedText', '%'], ['EscapeForLike', needle]],
		],
	),
);

const typeRules = {
	UnionQuery: (args): UnionQueryNode => {
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
	SelectQuery: (args): SelectQueryNode => {
		const tables: Array<
			| FromNode
			| InnerJoinNode
			| LeftJoinNode
			| RightJoinNode
			| FullJoinNode
			| CrossJoinNode
		> = [];
		let select: SelectNode[] = [];
		const groups = {
			Where: [] as WhereNode[],
			GroupBy: [] as GroupByNode[],
			Having: [] as HavingNode[],
			OrderBy: [] as OrderByNode[],
			Limit: [] as LimitNode[],
			Offset: [] as OffsetNode[],
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
					tables.push(
						typeRules[type](rest) as
							| FromNode
							| InnerJoinNode
							| LeftJoinNode
							| RightJoinNode
							| FullJoinNode
							| CrossJoinNode,
					);
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
					groups[type] = [
						typeRules[type](rest) as
							| WhereNode
							| GroupByNode
							| HavingNode
							| OrderByNode
							| LimitNode
							// The cast as any is because I couldn't find a way to automatically match up the correct type based upon the group we're assigning
							| OffsetNode as any,
					];
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
		];
	},
	Select: (args): SelectNode => {
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
		];
	},
	From: (args): FromNode => {
		checkArgs('From', args, 1);
		return ['From', MaybeAlias(getAbstractSqlQuery(args, 0), FromMatch)];
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
	Where: matchArgs<WhereNode>('Where', BooleanValue),
	GroupBy: (args) => {
		checkArgs('GroupBy', args, 1);
		const groups = getAbstractSqlQuery(args, 0);
		checkMinArgs('GroupBy groups', groups, 1);
		return ['GroupBy', groups.map(AnyValue)] as GroupByNode;
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
		] as OrderByNode;
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
	Field: matchArgs<FieldNode>('Field', _.identity),
	ReferencedField: matchArgs<ReferencedFieldNode>(
		'ReferencedField',
		_.identity,
		_.identity,
	),
	Cast: matchArgs<CastNode>('Cast', AnyValue, _.identity),
	// eslint-disable-next-line id-denylist
	Number: NumberMatch('Number'),
	Real: NumberMatch('Real'),
	Integer: NumberMatch('Integer'),
	// eslint-disable-next-line id-denylist
	Boolean: matchArgs<BooleanNode>('Boolean', _.identity),
	EmbeddedText: matchArgs('EmbeddedText', _.identity),
	Null: matchArgs<NullNode>('Null'),
	CurrentTimestamp: matchArgs<CurrentTimestampNode>('CurrentTimestamp'),
	CurrentDate: matchArgs<CurrentDateNode>('CurrentDate'),
	AggregateJSON: matchArgs<AggregateJSONNode>('AggregateJSON', Field),
	Equals: tryMatches<NotExistsNode | EqualsNode>(
		Helper<OptimisationMatchFn<NotExistsNode>>((args) => {
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
		Comparison<EqualsNode>('Equals'),
	),
	NotEquals: tryMatches<NotEqualsNode | ExistsNode>(
		Helper<OptimisationMatchFn<ExistsNode>>((args) => {
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
		Comparison<NotEqualsNode>('NotEquals'),
	),
	GreaterThan: Comparison<GreaterThanNode>('GreaterThan'),
	GreaterThanOrEqual: Comparison<GreaterThanOrEqualNode>('GreaterThanOrEqual'),
	LessThan: Comparison<LessThanNode>('LessThan'),
	LessThanOrEqual: Comparison<LessThanOrEqualNode>('LessThanOrEqual'),
	Like: Comparison<LikeNode>('Like'),
	IsNotDistinctFrom: tryMatches(
		Helper<OptimisationMatchFn<NotExistsNode>>((args) => {
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
		Helper<OptimisationMatchFn<EqualsNode>>((args) => {
			checkArgs('IsNotDistinctFrom', args, 2);
			const a = getAbstractSqlQuery(args, 0);
			const b = getAbstractSqlQuery(args, 1);
			if (isNotNullable(a) && isNotNullable(b)) {
				return ['Equals', a, b];
			}
			return false;
		}),
		matchArgs<IsNotDistinctFromNode>('IsNotDistinctFrom', AnyValue, AnyValue),
	),
	IsDistinctFrom: tryMatches(
		Helper<OptimisationMatchFn<ExistsNode>>((args) => {
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
		Helper<OptimisationMatchFn<NotEqualsNode>>((args) => {
			checkArgs('IsDistinctFrom', args, 2);
			const a = getAbstractSqlQuery(args, 0);
			const b = getAbstractSqlQuery(args, 1);
			if (isNotNullable(a) && isNotNullable(b)) {
				return ['NotEquals', a, b];
			}
			return false;
		}),
		matchArgs<IsDistinctFromNode>('IsDistinctFrom', AnyValue, AnyValue),
	),
	Between: matchArgs<BetweenNode>('Between', AnyValue, AnyValue, AnyValue),
	Add: tryMatches(MathOp<AddNode>('Add'), Helper(AddDateMatcher)),
	Subtract: tryMatches<
		| SubtractNode
		| SubtractDateDateNode
		| SubtractDateNumberNode
		| SubtractDateDurationNode
	>(MathOp<SubtractNode>('Subtract'), Helper(SubtractDateMatcher)),
	SubtractDateDate: matchArgs<SubtractDateDateNode>(
		'SubtractDateDate',
		DateValue,
		DateValue,
	),
	SubtractDateNumber: matchArgs<SubtractDateNumberNode>(
		'SubtractDateNumber',
		DateValue,
		NumericValue,
	),
	SubtractDateDuration: matchArgs<SubtractDateDurationNode>(
		'SubtractDateDuration',
		DateValue,
		DurationValue,
	),
	AddDateDuration: matchArgs<AddDateDurationNode>(
		'AddDateDuration',
		DateValue,
		DurationValue,
	),
	AddDateNumber: matchArgs<AddDateNumberNode>(
		'AddDateNumber',
		DateValue,
		NumericValue,
	),
	Multiply: MathOp<MultiplyNode>('Multiply'),
	Divide: MathOp<DivideNode>('Divide'),
	BitwiseAnd: MathOp<BitwiseAndNode>('BitwiseAnd'),
	BitwiseShiftRight: MathOp<BitwiseShiftRightNode>('BitwiseShiftRight'),
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
	Replace: matchArgs<ReplaceNode>('Replace', TextValue, TextValue, TextValue),
	CharacterLength: matchArgs<CharacterLengthNode>('CharacterLength', TextValue),
	StrPos: matchArgs<StrPosNode>('StrPos', TextValue, TextValue),
	StartsWith: matchArgs<StartsWithNode>('StartsWith', TextValue, TextValue),
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
	Right: matchArgs<RightNode>('Right', TextValue, NumericValue),
	Tolower: Lower,
	ToLower: Lower,
	Lower,
	Toupper: Upper,
	ToUpper: Upper,
	Upper,
	Trim: matchArgs<TrimNode>('Trim', TextValue),
	Round: matchArgs<RoundNode>('Round', NumericValue),
	Floor: matchArgs<FloorNode>('Floor', NumericValue),
	Ceiling: matchArgs<CeilingNode>('Ceiling', NumericValue),
	ToDate: matchArgs<ToDateNode>('ToDate', DateValue),
	DateTrunc: matchArgs<DateTruncNode>('DateTrunc', TextValue, DateValue),
	ToTime: matchArgs<ToTimeNode>('ToTime', DateValue),
	ExtractJSONPathAsText: (args): ExtractJSONPathAsTextNode => {
		checkMinArgs('ExtractJSONPathAsText', args, 1);
		const json = JSONValue(getAbstractSqlQuery(args, 0));
		const path = ArrayValue(getAbstractSqlQuery(args, 1));
		return ['ExtractJSONPathAsText', json, path];
	},
	TextArray: (args) => {
		// Allow for populated and empty arrays
		return ['TextArray', ...args.map(TextValue)];
	},
	ToJSON: matchArgs<ToJSONNode>('ToJSON', AnyValue),
	Any: matchArgs<AnyNode>('Any', AnyValue, _.identity),
	Coalesce: (args): CoalesceNode => {
		checkMinArgs('Coalesce', args, 2);
		return [
			'Coalesce',
			...(args.map(AnyValue) as [
				AnyTypeNodes,
				AnyTypeNodes,
				...AnyTypeNodes[],
			]),
		];
	},
	Case: (args) => {
		checkMinArgs('Case', args, 1);
		return [
			'Case',
			...args.map((arg, index): WhenNode | ElseNode => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				const [type, ...rest] = arg;
				switch (type) {
					case 'When': {
						checkArgs('When', rest, 2);
						const matches = BooleanValue(getAbstractSqlQuery(rest, 0));
						const resultValue = AnyValue(getAbstractSqlQuery(rest, 1));
						return ['When', matches, resultValue];
					}
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
		] as CaseNode;
	},
	And: tryMatches(
		Helper<OptimisationMatchFn<AnyTypeNodes>>((args) => {
			if (args.length !== 1) {
				return false;
			}
			return getAbstractSqlQuery(args, 0);
		}),
		Helper<OptimisationMatchFn<AndNode>>((args) => {
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

			return ['And', ...conditions] as AndNode;
		}),
		Helper<OptimisationMatchFn<BooleanNode | AndNode>>((args) => {
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
				return ['Boolean', false];
			}
			if (maybeHelped) {
				return ['And', ...conditions] as AndNode;
			}
			return false;
		}),
		Helper<OptimisationMatchFn<AndNode>>((args) => {
			checkMinArgs('And', args, 2);
			// Optimise id != 1 AND id != 2 AND id != 3 -> id NOT IN [1, 2, 3]
			const fieldBuckets: Dictionary<AnyTypeNodes[]> = {};
			const others: AnyTypeNodes[] = [];
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
			return ['And', ...fields, ...others] as AndNode;
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
		Helper<OptimisationMatchFn<AnyTypeNodes>>((args) => {
			if (args.length !== 1) {
				return false;
			}
			return getAbstractSqlQuery(args, 0);
		}),
		Helper<OptimisationMatchFn<OrNode>>((args) => {
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

			return ['Or', ...conditions] as OrNode;
		}),
		Helper<OptimisationMatchFn<BooleanNode | OrNode>>((args) => {
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
				return ['Boolean', true];
			}
			if (maybeHelped) {
				return ['Or', ...conditions] as OrNode;
			}
			return false;
		}),
		Helper<OptimisationMatchFn<InNode | OrNode>>((args) => {
			checkMinArgs('Or', args, 2);
			// Optimise id = 1 OR id = 2 OR id = 3 -> id IN [1, 2, 3]
			const fieldBuckets: Dictionary<AnyTypeNodes[]> = {};
			const others: AnyTypeNodes[] = [];
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
			return ['Or', ...fields, ...others] as OrNode;
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
		return ['Bind', ...args] as BindNode;
	},
	Text,
	Value: Text,
	Date: matchArgs('Date', _.identity),
	Duration: (args): DurationNode => {
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
		return ['Duration', duration];
	},
	Exists: tryMatches<ExistsNode | BooleanNode>(
		Helper<OptimisationMatchFn<BooleanNode>>((args) => {
			checkArgs('Exists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			if (isNotNullable(arg)) {
				return ['Boolean', true];
			}
			return false;
		}),
		Helper<OptimisationMatchFn<BooleanNode>>((args) => {
			checkArgs('Exists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			if (isEmptySelectQuery(arg)) {
				return ['Boolean', false];
			}
			return false;
		}),
		(args): ExistsNode => {
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
	NotExists: tryMatches<BooleanNode | NotExistsNode>(
		Helper<OptimisationMatchFn<BooleanNode>>((args) => {
			checkArgs('Exists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			if (isNotNullable(arg)) {
				return ['Boolean', false];
			}
			return false;
		}),
		Helper<OptimisationMatchFn<BooleanNode>>((args) => {
			checkArgs('Exists', args, 1);
			const arg = getAbstractSqlQuery(args, 0);
			if (isEmptySelectQuery(arg)) {
				return ['Boolean', true];
			}
			return false;
		}),
		(args): NotExistsNode => {
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
	Not: tryMatches<NotNode | BooleanTypeNodes | NotEqualsNode | ExistsNode>(
		Helper<OptimisationMatchFn<BooleanTypeNodes | NotEqualsNode | ExistsNode>>(
			(args): BooleanTypeNodes | NotEqualsNode | ExistsNode | false => {
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
			},
		),
		matchArgs<NotNode>('Not', BooleanValue),
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
		}) as [AnyTypeNodes, ...AnyTypeNodes[]];
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
		}) as [AnyTypeNodes, ...AnyTypeNodes[]];
		return ['NotIn', field, ...vals];
	},
	InsertQuery: (args): InsertQueryNode => {
		const tables: FromNode[] = [];
		let fields: FieldsNode[] = [];
		let values: ValuesNode[] = [];
		const where: WhereNode[] = [];
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
					fields = [arg as FieldsNode];
					break;
				case 'Values': {
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
								values = [
									[
										'Values',
										typeRules[valuesType](valuesRest) as
											| SelectQueryNode
											| UnionQueryNode,
									],
								];
								break;
							default:
								values = [['Values', valuesArray.map(Value)] as ValuesNode];
						}
					}
					break;
				}
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
			!['SelectQuery', 'UnionQuery'].includes(values[0][0]) &&
			fields[0].length !== values[0].length
		) {
			throw new SyntaxError(
				"'InsertQuery' requires Fields and Values components to have the same length or use a query for Values",
			);
		}
		return ['InsertQuery', ...tables, ...fields, ...values, ...where];
	},
	UpdateQuery: (args): UpdateQueryNode => {
		const tables: FromNode[] = [];
		let fields: FieldsNode[] = [];
		let values: ValuesNode[] = [];
		let where: WhereNode[] = [];
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
					fields = [arg as FieldsNode];
					break;
				case 'Values': {
					if (values.length !== 0) {
						throw new SyntaxError(
							`'UpdateQuery' can only accept one '${type}'`,
						);
					}
					checkArgs('Update values', rest, 1);
					const valuesArray = getAbstractSqlQuery(rest, 0);
					checkMinArgs('Update values array', valuesArray, 1);
					values = [['Values', valuesArray.map(Value)]];
					break;
				}
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

		return ['UpdateQuery', ...tables, ...fields, ...values, ...where];
	},
	DeleteQuery: (args): DeleteQueryNode => {
		const tables: FromNode[] = [];
		let where: WhereNode[] = [];
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

		return ['DeleteQuery', ...tables, ...where];
	},

	EscapeForLike: matchArgs<EscapeForLikeNode>('EscapeForLike', TextValue),

	// Virtual functions
	Now: rewriteMatch(
		'Now',
		[],
		Helper<MatchFn<CurrentTimestampNode>>(() => ['CurrentTimestamp']),
	),
	Contains: rewriteMatch(
		'Contains',
		[TextValue, TextValue],
		Helper<MatchFn<LikeNode>>(
			([haystack, needle]: [TextTypeNodes, TextTypeNodes]) => [
				'Like',
				haystack,
				[
					'Concatenate',
					['EmbeddedText', '%'],
					['EscapeForLike', needle],
					['EmbeddedText', '%'],
				],
			],
		),
	),
	Substringof: rewriteMatch(
		'Substringof',
		[TextValue, TextValue],
		Helper<MatchFn<LikeNode>>(
			([needle, haystack]: [TextTypeNodes, TextTypeNodes]) => [
				'Like',
				haystack,
				[
					'Concatenate',
					['EmbeddedText', '%'],
					['EscapeForLike', needle],
					['EmbeddedText', '%'],
				],
			],
		),
	),
	Startswith: rewriteMatch(
		'Startswith',
		[TextValue, TextValue],
		Helper<MatchFn<StartsWithNode>>(
			([haystack, needle]: [TextTypeNodes, TextTypeNodes]) => [
				'StartsWith',
				haystack,
				needle,
			],
		),
	),
	Endswith: EndsWithMatcher,
	EndsWith: EndsWithMatcher,
	IndexOf: rewriteMatch(
		'IndexOf',
		[TextValue, TextValue],
		Helper<MatchFn<SubtractNode>>(
			([haystack, needle]: [TextTypeNodes, TextTypeNodes]) => [
				'Subtract',
				['StrPos', haystack, needle],
				['Number', 1],
			],
		),
	),
	Indexof: rewriteMatch(
		'Indexof',
		[TextValue, TextValue],
		Helper<MatchFn<SubtractNode>>(
			([haystack, needle]: [TextTypeNodes, TextTypeNodes]) => [
				'Subtract',
				['StrPos', haystack, needle],
				['Number', 1],
			],
		),
	),
} satisfies Dictionary<MatchFn<AnyTypeNodes>>;

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
			case 'UpsertQuery': {
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
			}
			default:
				abstractSQL = AnyValue(abstractSQL) as AbstractSqlQuery;
		}
	} while (helped);
	return abstractSQL;
};
