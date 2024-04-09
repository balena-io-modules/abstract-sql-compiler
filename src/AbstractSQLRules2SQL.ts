import * as _ from 'lodash';

import sbvrTypes from '@balena/sbvr-types';

import type { Dictionary } from 'lodash';
import type {
	AbstractSqlQuery,
	AbstractSqlType,
	InsertQueryNode,
	SelectQueryNode,
	UnionQueryNode,
	UpdateQueryNode,
	DeleteQueryNode,
	UpsertQueryNode,
	CoalesceNode,
	DurationNode,
	StrictTextTypeNodes,
	StrictNumberTypeNodes,
	StrictBooleanTypeNodes,
	StrictDateTypeNodes,
	StrictDurationTypeNodes,
	StrictTextArrayTypeNodes,
	StrictJSONTypeNodes,
} from './AbstractSQLCompiler';
import { Engines } from './AbstractSQLCompiler';

export type Binding =
	| [string, any]
	| ['Bind', number | string | [string, string]];
export interface SqlResult {
	query: string;
	bindings: Binding[];
}

type MetaMatchFn = (args: AbstractSqlQuery, indent: string) => string;
type MatchFn = (args: AbstractSqlType[], indent: string) => string;

let fieldOrderings: Binding[] = [];
let fieldOrderingsLookup: Dictionary<number> = {};
let engine: Engines = Engines.postgres;
let noBinds: boolean = false;

export const comparisons = {
	Equals: ' = ',
	GreaterThan: ' > ',
	GreaterThanOrEqual: ' >= ',
	LessThan: ' < ',
	LessThanOrEqual: ' <= ',
	NotEquals: ' != ',
	Like: ' LIKE ',
};

const NestedIndent = (indent: string): string => indent + '\t';

const escapeField = (field: string | AbstractSqlQuery) =>
	field === '*' ? '*' : `"${field}"`;

const AnyValue: MetaMatchFn = (args, indent) => {
	const [type, ...rest] = args;
	if (type === 'Case') {
		return typeRules[type](rest, indent);
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
			return typeRules[type](rest, indent);
		}
	}

	return UnknownValue(args, indent);
};
const UnknownValue: MetaMatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Null':
		case 'Field':
		case 'ReferencedField':
		case 'Bind':
		case 'Cast':
		case 'Coalesce':
		case 'ToJSON':
		case 'Any':
		case 'TextArray':
			return typeRules[type](rest, indent);
		case 'SelectQuery':
		case 'UnionQuery': {
			const nestedIndent = NestedIndent(indent);
			const query = typeRules[type](rest, nestedIndent);
			return '(' + nestedIndent + query + indent + ')';
		}
		default:
			throw new Error(`Invalid "UnknownValue" type: ${type}`);
	}
};
const MatchValue =
	(matcher: (type: unknown) => type is string): MetaMatchFn =>
	(args, indent) => {
		const [type, ...rest] = args;
		if (matcher(type)) {
			return typeRules[type](rest, indent);
		}
		return UnknownValue(args, indent);
	};
export const isTextValue = (type: unknown): type is StrictTextTypeNodes[0] => {
	return (
		type === 'Text' ||
		type === 'EmbeddedText' ||
		type === 'Concatenate' ||
		type === 'ConcatenateWithSeparator' ||
		type === 'Lower' ||
		type === 'Upper' ||
		type === 'Trim' ||
		type === 'Replace' ||
		type === 'ExtractJSONPathAsText' ||
		type === 'Substring' ||
		type === 'Right' ||
		type === 'EscapeForLike'
	);
};
const TextValue = MatchValue(isTextValue);
export const isNumericValue = (
	type: unknown,
): type is StrictNumberTypeNodes[0] => {
	return (
		type === 'Number' ||
		type === 'Real' ||
		type === 'Integer' ||
		type === 'Add' ||
		type === 'Subtract' ||
		type === 'Multiply' ||
		type === 'Divide' ||
		type === 'BitwiseAnd' ||
		type === 'BitwiseShiftRight' ||
		type === 'CharacterLength' ||
		type === 'StrPos' ||
		type === 'Year' ||
		type === 'Month' ||
		type === 'Day' ||
		type === 'Hour' ||
		type === 'Minute' ||
		type === 'Second' ||
		type === 'Fractionalseconds' ||
		type === 'Totalseconds' ||
		type === 'Round' ||
		type === 'Floor' ||
		type === 'Ceiling' ||
		type === 'Count' ||
		type === 'Average' ||
		type === 'Sum' ||
		type === 'SubtractDateDate'
	);
};
const NumericValue = MatchValue(isNumericValue);
export const isBooleanValue = (
	type: unknown,
): type is StrictBooleanTypeNodes[0] => {
	return (
		type === 'Boolean' ||
		type === 'Not' ||
		type === 'And' ||
		type === 'Or' ||
		type === 'Exists' ||
		type === 'NotExists' ||
		type === 'Between' ||
		type === 'In' ||
		type === 'NotIn' ||
		type === 'Equals' ||
		type === 'GreaterThan' ||
		type === 'GreaterThanOrEqual' ||
		type === 'LessThan' ||
		type === 'LessThanOrEqual' ||
		type === 'NotEquals' ||
		type === 'Like' ||
		type === 'IsNotDistinctFrom' ||
		type === 'IsDistinctFrom' ||
		type === 'StartsWith'
	);
};
const BooleanValue = MatchValue(isBooleanValue);
export const isDateValue = (type: unknown): type is StrictDateTypeNodes[0] => {
	return (
		type === 'Date' ||
		type === 'ToDate' ||
		type === 'ToTime' ||
		type === 'CurrentTimestamp' ||
		type === 'CurrentDate' ||
		type === 'DateTrunc' ||
		type === 'AddDateNumber' ||
		type === 'AddDateDuration' ||
		type === 'SubtractDateDuration' ||
		type === 'SubtractDateNumber'
	);
};
const DateValue = MatchValue(isDateValue);
export const isArrayValue = (
	type: unknown,
): type is StrictTextArrayTypeNodes[0] => {
	return type === 'TextArray';
};

export const isJSONValue = (type: unknown): type is StrictJSONTypeNodes[0] => {
	return type === 'AggregateJSON' || type === 'ToJSON';
};
const JSONValue = MatchValue(isJSONValue);

export const isDurationValue = (
	type: unknown,
): type is StrictDurationTypeNodes[0] => {
	return type === 'Duration';
};
const DurationValue = MatchValue(isDurationValue);

export const isFieldValue = (
	type: unknown,
): type is 'Field' | 'ReferencedField' => {
	return type === 'Field' || type === 'ReferencedField';
};
const Field: MetaMatchFn = (args, indent) => {
	const [type, ...rest] = args;
	if (isFieldValue(type)) {
		return typeRules[type](rest, indent);
	} else {
		throw new SyntaxError(`Invalid field type: ${type}`);
	}
};

export const isNotNullable = (node: AbstractSqlType): boolean => {
	switch (node[0]) {
		case 'EmbeddedText':
		case 'Boolean':
		// We don't support null binds so we can avoid checking them for null-ness
		// and avoid issues with postgres type inference
		case 'Bind':
		case 'Value':
		case 'Text':
		case 'Date':
		case 'Number':
		case 'Real':
		case 'Integer':
		case 'IsDistinctFrom':
		case 'IsNotDistinctFrom':
		case 'Exists':
		case 'NotExists':
			return true;
		case 'Coalesce':
			return (node as CoalesceNode).slice(1).some((n) => isNotNullable(n));
		case 'Not':
			return isNotNullable(node[1]);
	}
	return false;
};

const isNotDistinctFrom: MatchFn = (args, indent) => {
	const a = getAbstractSqlQuery(args, 0);
	const b = getAbstractSqlQuery(args, 1);

	const aSql = AnyValue(a, indent);
	const bSql = AnyValue(b, indent);

	if (engine === Engines.postgres) {
		const aIsNotNullable = isNotNullable(a);
		const bIsNotNullable = isNotNullable(b);
		if (aIsNotNullable && bIsNotNullable) {
			return `${aSql} = ${bSql}`;
		}
		const isNotNullChecks: string[] = [];
		if (!aIsNotNullable) {
			isNotNullChecks.push(`(${aSql}) IS NOT NULL`);
		}
		if (!bIsNotNullable) {
			isNotNullChecks.push(`(${bSql}) IS NOT NULL`);
		}
		const orBothNull =
			!aIsNotNullable && !bIsNotNullable
				? ` OR (${aSql}) IS NULL AND (${bSql}) IS NULL`
				: '';
		return `${isNotNullChecks.join(
			' AND ',
		)} AND (${aSql}) = (${bSql})${orBothNull}`;
	} else if (engine === Engines.mysql) {
		return aSql + ' <=> ' + bSql;
	} else if (engine === Engines.websql) {
		return aSql + ' IS ' + bSql;
	} else {
		throw new SyntaxError(
			'IsDistinctFrom/IsNotDistinctFrom not supported on: ' + engine,
		);
	}
};

export const isAbstractSqlQuery = (
	x: AbstractSqlType,
): x is AbstractSqlQuery => {
	return Array.isArray(x);
};
export const getAbstractSqlQuery = (
	args: AbstractSqlType[],
	index: number,
): AbstractSqlQuery => {
	const abstractSqlQuery = args[index];
	if (!isAbstractSqlQuery(abstractSqlQuery)) {
		throw new SyntaxError(
			`Expected AbstractSqlQuery array but got ${typeof abstractSqlQuery}`,
		);
	}
	return abstractSqlQuery;
};

const Comparison = (comparison: keyof typeof comparisons): MatchFn => {
	return (args, indent) => {
		checkArgs(comparison, args, 2);
		const a = AnyValue(getAbstractSqlQuery(args, 0), indent);
		const b = AnyValue(getAbstractSqlQuery(args, 1), indent);
		return a + comparisons[comparison] + b;
	};
};
const NumberMatch = (type: string): MatchFn => {
	return (args) => {
		checkArgs(type, args, 1);
		const n = args[0];
		if (typeof n !== 'number') {
			throw new SyntaxError(`${type} expected number but got ${typeof n}`);
		}
		return `${n}`;
	};
};
const JoinMatch = (joinType: string): MatchFn => {
	let sqlJoinType: string;
	switch (joinType) {
		case 'Join':
			sqlJoinType = 'JOIN ';
			break;
		case 'LeftJoin':
			sqlJoinType = 'LEFT JOIN ';
			break;
		case 'RightJoin':
			sqlJoinType = 'RIGHT JOIN ';
			break;
		case 'FullJoin':
			sqlJoinType = 'FULL JOIN ';
			break;
		case 'CrossJoin':
			sqlJoinType = 'CROSS JOIN ';
			break;
		default:
			throw new Error(`Unknown join type: '${joinType}'`);
	}
	return (args, indent) => {
		if (args.length !== 1 && args.length !== 2) {
			throw new SyntaxError(`"${joinType}" requires 1/2 arg(s)`);
		}
		const from = MaybeAlias(getAbstractSqlQuery(args, 0), indent, FromMatch);
		if (args.length === 1) {
			return sqlJoinType + from;
		}
		const [type, ...rest] = getAbstractSqlQuery(args, 1);
		switch (type) {
			case 'On': {
				checkArgs('On', rest, 1);
				const ruleBody = BooleanValue(
					getAbstractSqlQuery(rest, 0),
					NestedIndent(indent),
				);
				return sqlJoinType + from + ' ON ' + ruleBody;
			}
			default:
				throw new SyntaxError(
					`'${joinType}' clause does not support '${type}' clause`,
				);
		}
	};
};
const mathOps = {
	Add: '+',
	Subtract: '-',
	Multiply: '*',
	Divide: '/',
	BitwiseAnd: '&',
	BitwiseShiftRight: '>>',
};
export type MathOps = keyof typeof mathOps;

const mathOperatorNodeTypes = new Set([
	...Object.keys(mathOps),
	'AddDateDuration',
	'AddDateNumber',
	'SubtractDateDate',
	'SubtractDateDuration',
	'SubtractDateNumber',
]);

const mathOpValue = (
	valueMatchFn: MetaMatchFn,
	args: AbstractSqlType[],
	index: number,
	indent: string,
) => {
	const operandAbstractSql = getAbstractSqlQuery(args, index);
	const numericValue = valueMatchFn(operandAbstractSql, indent);
	const [childNodeType] = operandAbstractSql;
	if (mathOperatorNodeTypes.has(childNodeType)) {
		return `(${numericValue})`;
	}
	return numericValue;
};

const MathOp = (type: keyof typeof mathOps): MatchFn => {
	return (args, indent) => {
		checkArgs(type, args, 2);
		const a = mathOpValue(NumericValue, args, 0, indent);
		const b = mathOpValue(NumericValue, args, 1, indent);
		return `${a} ${mathOps[type]} ${b}`;
	};
};

const fractionalSecondsFormat = function (date: string) {
	return this['Totalseconds'](date) + ' - ' + this['Second'](date);
};
const websqlBasicDateFormat = (format: string) => {
	return (date: string) => `STRFTIME('${format}', ${date})`;
};
const websqlDateFormats = {
	Year: websqlBasicDateFormat('%Y'),
	Month: websqlBasicDateFormat('%m'),
	Day: websqlBasicDateFormat('%d'),
	Hour: websqlBasicDateFormat('%H'),
	Minute: websqlBasicDateFormat('%M'),
	Second: websqlBasicDateFormat('%S'),
	Fractionalseconds: fractionalSecondsFormat,
	Totalseconds: websqlBasicDateFormat('%f'),
};

const basicDateFormat = function (part: string) {
	return (date: string) => `EXTRACT('${part}' FROM ${date})`;
};
const dateFormats = {
	Year: basicDateFormat('YEAR'),
	Month: basicDateFormat('MONTH'),
	Day: basicDateFormat('DAY'),
	Hour: basicDateFormat('HOUR'),
	Minute: basicDateFormat('MINUTE'),
	Second: (date: string) => `FLOOR(${dateFormats['Totalseconds'](date)})`,
	Fractionalseconds: fractionalSecondsFormat,
	Totalseconds: basicDateFormat('SECOND'),
};
const ExtractNumericDatePart = (type: keyof typeof dateFormats): MatchFn => {
	return (args, indent) => {
		checkArgs(type, args, 1);
		const date = DateValue(getAbstractSqlQuery(args, 0), indent);
		if (engine === Engines.websql) {
			return websqlDateFormats[type](date);
		} else {
			return dateFormats[type](date);
		}
	};
};

const Text: MatchFn = (args) => {
	checkArgs('Text', args, 1);
	if (noBinds) {
		return `'${args[0]}'`;
	} else {
		return AddBind(['Text', args[0]]);
	}
};

export const checkArgs = (matchName: string, args: any[], num: number) => {
	if (args.length !== num) {
		throw new SyntaxError(`"${matchName}" requires ${num} arg(s)`);
	}
};
export const checkMinArgs = (matchName: string, args: any[], num: number) => {
	if (args.length < num) {
		throw new SyntaxError(`"${matchName}" requires at least ${num} arg(s)`);
	}
};

const AddDateNumber: MatchFn = (args, indent) => {
	checkArgs('AddDateNumber', args, 2);
	const a = mathOpValue(DateValue, args, 0, indent);
	const b = mathOpValue(NumericValue, args, 1, indent);

	if (engine === Engines.postgres) {
		return `${a} + ${b}`;
	} else if (engine === Engines.mysql) {
		return `ADDDATE(${a}, ${b})`;
	} else {
		throw new SyntaxError('AddDateNumber not supported on: ' + engine);
	}
};

const AddDateDuration: MatchFn = (args, indent) => {
	checkArgs('AddDateDuration', args, 2);
	const a = mathOpValue(DateValue, args, 0, indent);
	const b = mathOpValue(DurationValue, args, 1, indent);

	if (engine === Engines.postgres) {
		return `${a} + ${b}`;
	} else if (engine === Engines.mysql) {
		return `DATE_ADD(${a}, ${b})`;
	} else {
		throw new SyntaxError('AddDateDuration not supported on: ' + engine);
	}
};

const SubtractDateDuration: MatchFn = (args, indent) => {
	checkArgs('SubtractDateDuration', args, 2);
	const a = mathOpValue(DateValue, args, 0, indent);
	const b = mathOpValue(DurationValue, args, 1, indent);

	if (engine === Engines.postgres) {
		return `${a} - ${b}`;
	} else if (engine === Engines.mysql) {
		return `DATE_SUB(${a}, ${b})`;
	} else {
		throw new SyntaxError('SubtractDateDuration not supported on: ' + engine);
	}
};

const SubtractDateNumber: MatchFn = (args, indent) => {
	checkArgs('SubtractDateNumber', args, 2);
	const a = mathOpValue(DateValue, args, 0, indent);
	const b = mathOpValue(NumericValue, args, 1, indent);

	if (engine === Engines.postgres) {
		return `${a} - ${b}`;
	} else if (engine === Engines.mysql) {
		return `SUBDATE(${a}, ${b})`;
	} else {
		throw new SyntaxError('SubtractDateNumber not supported on: ' + engine);
	}
};

const SubtractDateDate: MatchFn = (args, indent) => {
	checkArgs('SubtractDateDate', args, 2);
	const a = mathOpValue(DateValue, args, 0, indent);
	const b = mathOpValue(DateValue, args, 1, indent);
	if (engine === Engines.postgres) {
		return `${a} - ${b}`;
	} else if (engine === Engines.mysql) {
		return `DATEDIFF(${a}, ${b})`;
	} else {
		throw new SyntaxError('SubtractDateDate not supported on: ' + engine);
	}
};

const Value = (arg: any, indent: string): string => {
	switch (arg) {
		case 'Default':
			return 'DEFAULT';
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
					return typeRules[type](rest, indent);
				default:
					throw new SyntaxError(`Invalid type for Value ${type}`);
			}
		}
	}
};

const SelectMatch: MetaMatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Count':
			return typeRules[type](rest, indent);
		default:
			return AnyValue(args, indent);
	}
};
const FromMatch: MetaMatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'SelectQuery':
		case 'UnionQuery': {
			const nestedindent = NestedIndent(indent);
			const query = typeRules[type](rest, nestedindent);
			return '(' + nestedindent + query + indent + ')';
		}
		case 'Table': {
			checkArgs('Table', rest, 1);
			const [table] = rest;
			if (typeof table !== 'string') {
				throw new SyntaxError('`Table` table must be a string');
			}
			return escapeField(table);
		}
		default:
			throw new SyntaxError(`From does not support ${type}`);
	}
};

const MaybeAlias = (
	args: AbstractSqlQuery,
	indent: string,
	matchFn: MatchFn,
): string => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Alias': {
			checkArgs('Alias', rest, 2);
			const field = matchFn(getAbstractSqlQuery(rest, 0), indent);
			return `${field} AS "${rest[1]}"`;
		}
		default:
			return matchFn(args, indent);
	}
};

const AddBind = (bind: Binding): string => {
	if (noBinds) {
		throw new SyntaxError('Cannot use a bind whilst they are disabled');
	}
	if (engine === Engines.postgres) {
		if (bind[0] === 'Bind') {
			const key = JSON.stringify(bind[1]);
			const existingBindIndex = fieldOrderingsLookup[key];
			if (existingBindIndex != null) {
				// Reuse the existing bind if there is one
				return '$' + existingBindIndex;
			}
			const nextID = fieldOrderings.push(bind);
			fieldOrderingsLookup[key] = nextID;
			return '$' + nextID;
		}
		return '$' + fieldOrderings.push(bind);
	} else {
		fieldOrderings.push(bind);
		return '?';
	}
};

const typeRules: Dictionary<MatchFn> = {
	UnionQuery: (args, indent) => {
		checkMinArgs('UnionQuery', args, 2);
		return args
			.map((arg) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				const [type, ...rest] = arg;
				switch (type) {
					case 'SelectQuery':
					case 'UnionQuery':
						return typeRules[type](rest, indent);
					default:
						throw new SyntaxError(`UnionQuery does not support ${type}`);
				}
			})
			.join(indent + 'UNION' + indent);
	},
	SelectQuery: (args, indent) => {
		const tables: string[] = [];
		const joins: string[] = [];
		let select: string = '';
		const groups = {
			Where: '',
			GroupBy: '',
			Having: '',
			OrderBy: '',
			Limit: '',
			Offset: '',
		};
		for (const arg of args) {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError('`SelectQuery` args must all be arrays');
			}
			const [type, ...rest] = arg;
			switch (type) {
				case 'Select':
					if (select !== '') {
						throw new SyntaxError(
							`'SelectQuery' can only accept one '${type}'`,
						);
					}
					select = typeRules[type](rest, indent);
					break;
				case 'From':
					tables.push(typeRules[type](rest, indent));
					break;
				case 'Join':
				case 'LeftJoin':
				case 'RightJoin':
				case 'FullJoin':
				case 'CrossJoin':
					joins.push(typeRules[type](rest, indent));
					break;
				case 'Where':
				case 'GroupBy':
				case 'Having':
				case 'OrderBy':
				case 'Limit':
				case 'Offset':
					if (groups[type] !== '') {
						throw new SyntaxError(
							`'SelectQuery' can only accept one '${type}'`,
						);
					}
					groups[type] = indent + typeRules[type](rest, indent);
					break;
				default:
					throw new SyntaxError(`'SelectQuery' does not support '${type}'`);
			}
		}

		if (tables.length === 0 && joins.length > 0) {
			throw new SyntaxError(
				'Must have at least one From node in order to use Join nodes',
			);
		}

		const from =
			tables.length > 0
				? indent + 'FROM ' + tables.join(',' + NestedIndent(indent))
				: '';

		const joinStr = joins.length > 0 ? indent + joins.join(indent) : '';

		return (
			'SELECT ' +
			select +
			from +
			joinStr +
			groups.Where +
			groups.GroupBy +
			groups.Having +
			groups.OrderBy +
			groups.Limit +
			groups.Offset
		);
	},
	Select: (args, indent) => {
		checkArgs('Select', args, 1);
		args = getAbstractSqlQuery(args, 0);
		if (args.length === 0) {
			// Empty select fields are converted to `SELECT 1`
			return '1';
		}
		return args
			.map((arg) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				return MaybeAlias(arg, indent, SelectMatch);
			})
			.join(', ');
	},
	From: (args, indent) => {
		checkArgs('From', args, 1);
		return MaybeAlias(getAbstractSqlQuery(args, 0), indent, FromMatch);
	},
	Join: JoinMatch('Join'),
	LeftJoin: JoinMatch('LeftJoin'),
	RightJoin: JoinMatch('RightJoin'),
	FullJoin: JoinMatch('FullJoin'),
	CrossJoin: (args, indent) => {
		checkArgs('CrossJoin', args, 1);
		const from = MaybeAlias(getAbstractSqlQuery(args, 0), indent, FromMatch);
		return `CROSS JOIN ${from}`;
	},
	Where: (args, indent) => {
		checkArgs('Where', args, 1);
		const boolNode = getAbstractSqlQuery(args, 0);
		if (boolNode[0] === 'Boolean') {
			// This is designed to avoid cases of `WHERE 0`/`WHERE 1` which are invalid, ideally
			// we need to convert booleans to always use true/false but that's a major change
			return `WHERE ${boolNode[1] ? 'true' : 'false'}`;
		}
		const ruleBody = BooleanValue(boolNode, indent);
		return 'WHERE ' + ruleBody;
	},
	GroupBy: (args, indent) => {
		checkArgs('GroupBy', args, 1);
		const groups = getAbstractSqlQuery(args, 0);
		checkMinArgs('GroupBy groups', groups, 1);
		return (
			'GROUP BY ' +
			groups.map((arg: AbstractSqlQuery) => AnyValue(arg, indent)).join(', ')
		);
	},
	Having: (args, indent) => {
		checkArgs('Having', args, 1);
		const havingBody = BooleanValue(getAbstractSqlQuery(args, 0), indent);
		return `HAVING ${havingBody}`;
	},
	OrderBy: (args, indent) => {
		checkMinArgs('OrderBy', args, 1);
		return (
			'ORDER BY ' +
			args
				.map((arg: AbstractSqlQuery) => {
					checkMinArgs('OrderBy ordering', arg, 2);
					const order = arg[0];
					if (order !== 'ASC' && order !== 'DESC') {
						throw new SyntaxError(`Can only order by "ASC" or "DESC"`);
					}
					const value = AnyValue(getAbstractSqlQuery(arg, 1), indent);
					return `${value} ${order}`;
				})
				.join(',' + NestedIndent(indent))
		);
	},
	Limit: (args, indent) => {
		checkArgs('Limit', args, 1);
		const num = NumericValue(getAbstractSqlQuery(args, 0), indent);
		return `LIMIT ${num}`;
	},
	Offset: (args, indent) => {
		checkArgs('Offset', args, 1);
		const num = NumericValue(getAbstractSqlQuery(args, 0), indent);
		return `OFFSET ${num}`;
	},
	Count: (args) => {
		checkArgs('Count', args, 1);
		if (args[0] !== '*') {
			throw new SyntaxError('"Count" only supports "*"');
		}
		return 'COUNT(*)';
	},
	Average: (args, indent) => {
		checkArgs('Average', args, 1);
		const num = NumericValue(getAbstractSqlQuery(args, 0), indent);
		return `AVG(${num})`;
	},
	Sum: (args, indent) => {
		checkArgs('Sum', args, 1);
		const num = NumericValue(getAbstractSqlQuery(args, 0), indent);
		return `SUM(${num})`;
	},
	Field: (args) => {
		checkArgs('Field', args, 1);
		const [field] = args;
		if (typeof field !== 'string') {
			throw new SyntaxError('`Field` field must be a string');
		}
		return escapeField(field);
	},
	ReferencedField: (args) => {
		checkArgs('ReferencedField', args, 2);
		const [table, field] = args;
		if (typeof table !== 'string') {
			throw new SyntaxError('`ReferencedField` table must be a string');
		}
		if (typeof field !== 'string') {
			throw new SyntaxError('`ReferencedField` field must be a string');
		}
		return `"${table}".${escapeField(field)}`;
	},
	Cast: (args, indent) => {
		checkArgs('Cast', args, 2);
		const value = AnyValue(getAbstractSqlQuery(args, 0), indent);
		const typeName = args[1] as keyof typeof sbvrTypes;
		if (!sbvrTypes[typeName] || !sbvrTypes[typeName].types[engine]) {
			throw new SyntaxError(`Invalid cast type: ${typeName}`);
		}
		let type: string;
		const dbType = sbvrTypes[typeName].types[engine];
		if (typeof dbType === 'function') {
			type = dbType.castType;
		} else if (dbType.toUpperCase() === 'SERIAL') {
			// HACK: SERIAL type in postgres is really an INTEGER with automatic sequence,
			// so it's not actually possible to cast to SERIAL, instead you have to cast to INTEGER.
			type = 'INTEGER';
		} else if (dbType.toUpperCase() === 'BIGSERIAL') {
			// HACK: BIGSERIAL type in postgres is really a BIGINT with automatic sequence,
			// so it's not actually possible to cast to BIGSERIAL, instead you have to cast to BIGINT.
			type = 'BIGINT';
		} else {
			type = dbType;
		}
		return `CAST(${value} AS ${type})`;
	},
	// eslint-disable-next-line id-denylist
	Number: NumberMatch('Number'),
	Real: NumberMatch('Real'),
	Integer: NumberMatch('Integer'),
	// eslint-disable-next-line id-denylist
	Boolean: (args) => {
		checkArgs('Boolean', args, 1);
		const b = args[0];
		if (typeof b !== 'boolean') {
			throw new SyntaxError(`Boolean expected boolean but got ${typeof b}`);
		}
		return b ? 'TRUE' : 'FALSE';
	},
	EmbeddedText: (args) => {
		checkArgs('EmbeddedText', args, 1);
		return `'${args[0]}'`;
	},
	TextArray: (args, indent) => {
		const values = args.map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return TextValue(arg, indent);
		});
		return values.length
			? `ARRAY[${values.join(', ')}]`
			: 'CAST(ARRAY[] as TEXT[])';
	},
	Null: (args) => {
		checkArgs('Null', args, 0);
		return 'NULL';
	},
	CurrentTimestamp: (args) => {
		checkArgs('CurrentTimestamp', args, 0);
		return 'CURRENT_TIMESTAMP';
	},
	CurrentDate: (args) => {
		checkArgs('CurrentDate', args, 0);
		return 'CURRENT_DATE';
	},
	AggregateJSON: (args, indent) => {
		checkArgs('AggregateJSON', args, 1);
		if (engine !== Engines.postgres) {
			throw new SyntaxError('AggregateJSON not supported on: ' + engine);
		}
		const field = Field(getAbstractSqlQuery(args, 0), indent);
		return `COALESCE(JSON_AGG(${field}), '[]')`;
	},
	Equals: Comparison('Equals'),
	GreaterThan: Comparison('GreaterThan'),
	GreaterThanOrEqual: Comparison('GreaterThanOrEqual'),
	LessThan: Comparison('LessThan'),
	LessThanOrEqual: Comparison('LessThanOrEqual'),
	NotEquals: Comparison('NotEquals'),
	Like: Comparison('Like'),
	IsNotDistinctFrom: (args, indent) => {
		checkArgs('IsNotDistinctFrom', args, 2);
		return isNotDistinctFrom(args, indent);
	},
	IsDistinctFrom: (args, indent) => {
		checkArgs('IsDistinctFrom', args, 2);
		return 'NOT(' + isNotDistinctFrom(args, indent) + ')';
	},
	Between: (args, indent) => {
		checkArgs('Between', args, 3);
		const v = AnyValue(getAbstractSqlQuery(args, 0), indent);
		const a = AnyValue(getAbstractSqlQuery(args, 1), indent);
		const b = AnyValue(getAbstractSqlQuery(args, 2), indent);
		return `${v} BETWEEN ${a} AND (${b})`;
	},
	Add: MathOp('Add'),
	Subtract: MathOp('Subtract'),
	Multiply: MathOp('Multiply'),
	Divide: MathOp('Divide'),
	BitwiseAnd: MathOp('BitwiseAnd'),
	BitwiseShiftRight: MathOp('BitwiseShiftRight'),
	AddDateNumber, // returns date
	AddDateDuration, // returns date
	SubtractDateDate, // returns integer
	SubtractDateNumber, // returns date
	SubtractDateDuration, // returns date
	Year: ExtractNumericDatePart('Year'),
	Month: ExtractNumericDatePart('Month'),
	Day: ExtractNumericDatePart('Day'),
	Hour: ExtractNumericDatePart('Hour'),
	Minute: ExtractNumericDatePart('Minute'),
	Second: ExtractNumericDatePart('Second'),
	Fractionalseconds: ExtractNumericDatePart('Fractionalseconds'),
	Totalseconds: (args, indent) => {
		checkArgs('Totalseconds', args, 1);
		const duration = DurationValue(getAbstractSqlQuery(args, 0), indent);
		if (engine === Engines.postgres) {
			return `EXTRACT(EPOCH FROM ${duration})`;
		} else if (engine === Engines.mysql) {
			return `(TIMESTAMPDIFF(MICROSECOND, FROM_UNIXTIME(0), FROM_UNIXTIME(0) + ${duration}) / 1000000)`;
		} else {
			throw new SyntaxError('TotalSeconds not supported on: ' + engine);
		}
	},
	Concatenate: (args, indent) => {
		checkMinArgs('Concatenate', args, 1);
		const comparators = args.map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return TextValue(arg, indent);
		});
		if (engine === Engines.mysql) {
			return 'CONCAT(' + comparators.join(', ') + ')';
		} else {
			return '(' + comparators.join(' || ') + ')';
		}
	},
	ConcatenateWithSeparator: (args, indent) => {
		checkMinArgs('ConcatenateWithSeparator', args, 2);
		const textParts = args.map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return TextValue(arg, indent);
		});
		if (engine === Engines.websql) {
			throw new SyntaxError(
				'ConcatenateWithSeparator not supported on: ' + engine,
			);
		}
		return `CONCAT_WS(${textParts.join(', ')})`;
	},
	Replace: (args, indent) => {
		checkArgs('Replace', args, 3);
		const str = TextValue(getAbstractSqlQuery(args, 0), indent);
		const find = TextValue(getAbstractSqlQuery(args, 1), indent);
		const replacement = TextValue(getAbstractSqlQuery(args, 2), indent);
		return `REPLACE(${str}, ${find}, ${replacement})`;
	},
	ExtractJSONPathAsText: (args, indent) => {
		checkMinArgs('ExtractJSONPathAsText', args, 1);
		if (engine !== Engines.postgres) {
			throw new SyntaxError(
				'ExtractJSONPathAsText not supported on: ' + engine,
			);
		}
		const json = JSONValue(getAbstractSqlQuery(args, 0), indent);
		const path = TextValue(getAbstractSqlQuery(args, 1), indent);
		return `${json} #>> ${path}`;
	},
	CharacterLength: (args, indent) => {
		checkArgs('CharacterLength', args, 1);
		const text = TextValue(getAbstractSqlQuery(args, 0), indent);
		if (engine === Engines.mysql) {
			return `CHAR_LENGTH(${text})`;
		} else {
			return `LENGTH(${text})`;
		}
	},
	StrPos: (args, indent) => {
		checkArgs('StrPos', args, 2);
		const haystack = TextValue(getAbstractSqlQuery(args, 0), indent);
		const needle = TextValue(getAbstractSqlQuery(args, 1), indent);
		if (engine === Engines.postgres) {
			return `STRPOS(${haystack}, ${needle})`;
		} else {
			return `INSTR(${haystack}, ${needle})`;
		}
	},
	StartsWith: (args, indent) => {
		checkArgs('StartsWith', args, 2);
		const haystack = TextValue(getAbstractSqlQuery(args, 0), indent);
		const needle = TextValue(getAbstractSqlQuery(args, 1), indent);
		if (engine === Engines.postgres) {
			return `STARTS_WITH(${haystack}, ${needle})`;
		} else {
			return typeRules.Like(
				[
					haystack,
					['Concatenate', ['EscapeForLike', needle], ['EmbeddedText', '%']],
				],
				indent,
			);
		}
	},
	Substring: (args, indent) => {
		checkMinArgs('Substring', args, 2);
		const str = TextValue(getAbstractSqlQuery(args, 0), indent);
		const nums = args.slice(1).map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return NumericValue(arg, indent);
		});
		return `SUBSTRING(${[str, ...nums].join(', ')})`;
	},
	Right: (args, indent) => {
		checkArgs('Right', args, 2);
		const str = TextValue(getAbstractSqlQuery(args, 0), indent);
		const n = NumericValue(getAbstractSqlQuery(args, 1), indent);
		if (engine === Engines.websql) {
			return `SUBSTRING(${str}, -${n})`;
		} else {
			return `RIGHT(${str}, ${n})`;
		}
	},
	Lower: (args, indent) => {
		checkArgs('Lower', args, 1);
		const str = TextValue(getAbstractSqlQuery(args, 0), indent);
		return `LOWER(${str})`;
	},
	Upper: (args, indent) => {
		checkArgs('Upper', args, 1);
		const str = TextValue(getAbstractSqlQuery(args, 0), indent);
		return `UPPER(${str})`;
	},
	Trim: (args, indent) => {
		checkArgs('Trim', args, 1);
		const str = TextValue(getAbstractSqlQuery(args, 0), indent);
		return `TRIM(${str})`;
	},
	Round: (args, indent) => {
		checkArgs('Round', args, 1);
		const num = NumericValue(getAbstractSqlQuery(args, 0), indent);
		return `ROUND(${num})`;
	},
	Floor: (args, indent) => {
		checkArgs('Floor', args, 1);
		const num = NumericValue(getAbstractSqlQuery(args, 0), indent);
		return `FLOOR(${num})`;
	},
	Ceiling: (args, indent) => {
		checkArgs('Ceiling', args, 1);
		const num = NumericValue(getAbstractSqlQuery(args, 0), indent);
		return `CEILING(${num})`;
	},
	ToDate: (args, indent) => {
		checkArgs('ToDate', args, 1);
		const date = DateValue(getAbstractSqlQuery(args, 0), indent);
		return `DATE(${date})`;
	},
	DateTrunc: (args, indent) => {
		checkArgs('DateTrunc', args, 2);
		const precision = TextValue(getAbstractSqlQuery(args, 0), indent);
		const date = DateValue(getAbstractSqlQuery(args, 1), indent);
		// Postgres generated timestamps have a microseconds precision
		// these timestamps will fail on comparisons: eq, ne, gt, lt with
		// js timestamps that have only milliseconds precision
		// thus supporting for truncating to a given precision
		if (engine === Engines.postgres) {
			return `DATE_TRUNC(${precision}, ${date})`;
		} else if (
			// not postgresql ==> no need to truncate ==> return timestamp as is (milliseconds precision)
			precision === "'milliseconds'" ||
			precision === "'microseconds'"
		) {
			return date;
		} else {
			// not postgresql ==> no truncate functionality ==>
			throw new SyntaxError('DateTrunc is not supported on: ' + engine);
		}
	},
	ToTime: (args, indent) => {
		checkArgs('ToTime', args, 1);
		const date = DateValue(getAbstractSqlQuery(args, 0), indent);
		if (engine === Engines.postgres) {
			return `CAST(${date} AS TIME)`;
		} else {
			return `TIME(${date})`;
		}
	},
	ToJSON: (args, indent) => {
		checkMinArgs('ToJSON', args, 1);
		if (engine !== Engines.postgres) {
			throw new SyntaxError('ToJSON not supported on: ' + engine);
		}
		const value = AnyValue(getAbstractSqlQuery(args, 0), indent);
		return `TO_JSON(${value})`;
	},
	Any: (args, indent) => {
		checkArgs('Any', args, 2);
		if (engine !== Engines.postgres) {
			throw new SyntaxError('Any not supported on: ' + engine);
		}
		const value = AnyValue(getAbstractSqlQuery(args, 0), indent);
		const innerType =
			sbvrTypes[args[1] as keyof typeof sbvrTypes].types[engine];
		return `ANY(CAST(${value} AS ${innerType}[]))`;
	},
	Coalesce: (args, indent) => {
		checkMinArgs('Coalesce', args, 2);
		const comparators = args.map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return AnyValue(arg, indent);
		});
		return 'COALESCE(' + comparators.join(', ') + ')';
	},
	Case: (args, indent) => {
		checkMinArgs('Case', args, 1);
		const nestedIndent = NestedIndent(indent);
		const clauses = args
			.map((arg, index) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				const [type, ...rest] = arg;
				switch (type) {
					case 'When': {
						checkArgs('When', rest, 2);
						const matches = BooleanValue(
							getAbstractSqlQuery(rest, 0),
							NestedIndent(nestedIndent),
						);
						const resultValue = AnyValue(
							getAbstractSqlQuery(rest, 1),
							nestedIndent,
						);
						return 'WHEN ' + matches + ' THEN ' + resultValue;
					}
					case 'Else':
						if (index !== args.length - 1) {
							throw new SyntaxError('Else must be the last element of a Case');
						}
						checkArgs('Else', rest, 1);
						return (
							'ELSE ' + AnyValue(getAbstractSqlQuery(rest, 0), nestedIndent)
						);
					default:
						throw new SyntaxError('Case can only contain When/Else');
				}
			})
			.join(nestedIndent);
		return 'CASE' + nestedIndent + clauses + indent + 'END';
	},
	And: (args, indent) => {
		checkMinArgs('And', args, 2);
		return args
			.map((arg) => {
				if (!isAbstractSqlQuery(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				return BooleanValue(arg, indent);
			})
			.join(indent + 'AND ');
	},
	Or: (args, indent) => {
		checkMinArgs('Or', args, 2);
		return (
			'(' +
			args
				.map((arg) => {
					if (!isAbstractSqlQuery(arg)) {
						throw new SyntaxError(
							`Expected AbstractSqlQuery array but got ${typeof arg}`,
						);
					}
					return BooleanValue(arg, indent);
				})
				.join(indent + 'OR ') +
			')'
		);
	},
	Bind: (args) => {
		let bind;
		if (args.length === 2) {
			bind = args;
		} else if (args.length === 1) {
			bind = args[0];
		} else {
			throw new SyntaxError(`"Bind" requires 1/2 arg(s)`);
		}
		return AddBind(['Bind', bind]);
	},
	Text,
	Date: (args) => {
		checkArgs('Date', args, 1);
		return AddBind(['Date', args[0]]);
	},
	Duration: (args) => {
		checkArgs('Duration', args, 1);
		if (engine === Engines.websql) {
			throw new SyntaxError('Durations not supported on: ' + engine);
		}
		// TODO: The abstract sql type should accommodate this
		let duration = args[0] as DurationNode[1];
		if (duration == null || typeof duration !== 'object') {
			throw new SyntaxError(
				`Duration must be an object, got ${typeof duration}`,
			);
		}
		duration = _(duration)
			.pick('negative', 'day', 'hour', 'minute', 'second')
			.omitBy(_.isNil)
			.value() as Dictionary<string>;
		if (_(duration).omit('negative').isEmpty()) {
			throw new SyntaxError('Invalid duration');
		}
		return (
			"INTERVAL '" +
			(duration.negative ? '-' : '') +
			(duration.day ?? '0') +
			' ' +
			(duration.negative ? '-' : '') +
			(duration.hour ?? '0') +
			':' +
			(duration.minute ?? '0') +
			':' +
			// Force seconds to be at least 0.0 - required for mysql
			Number(duration.second ?? 0).toLocaleString('en', {
				minimumFractionDigits: 1,
			}) +
			"'" +
			(engine === Engines.mysql ? ' DAY_MICROSECOND' : '')
		);
	},
	Exists: (args, indent) => {
		checkArgs('Exists', args, 1);
		const arg = getAbstractSqlQuery(args, 0);
		const [type, ...rest] = arg;
		switch (type) {
			case 'SelectQuery':
			case 'UnionQuery': {
				const nestedIndent = NestedIndent(indent);
				const query = typeRules[type](rest, nestedIndent);
				return 'EXISTS (' + nestedIndent + query + indent + ')';
			}
			default:
				return AnyValue(arg, indent) + ' IS NOT NULL';
		}
	},
	NotExists: (args, indent) => {
		checkArgs('NotExists', args, 1);
		const arg = getAbstractSqlQuery(args, 0);
		const [type, ...rest] = arg;
		switch (type) {
			case 'SelectQuery':
			case 'UnionQuery': {
				const nestedIndent = NestedIndent(indent);
				const query = typeRules[type](rest, nestedIndent);
				return 'NOT EXISTS (' + nestedIndent + query + indent + ')';
			}
			default:
				return AnyValue(arg, indent) + ' IS NULL';
		}
	},
	Not: (args, indent) => {
		checkArgs('Not', args, 1);
		const nestedIndent = NestedIndent(indent);
		const bool = BooleanValue(getAbstractSqlQuery(args, 0), nestedIndent);
		return 'NOT (' + nestedIndent + bool + indent + ')';
	},
	In: (args, indent) => {
		checkMinArgs('In', args, 2);
		const field = Field(getAbstractSqlQuery(args, 0), indent);
		const vals = args.slice(1).map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return AnyValue(arg, indent);
		});
		return field + ' IN (' + vals.join(', ') + ')';
	},
	NotIn: (args, indent) => {
		checkMinArgs('NotIn', args, 2);
		const field = Field(getAbstractSqlQuery(args, 0), indent);
		const vals = args.slice(1).map((arg) => {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return AnyValue(arg, indent);
		});
		return field + ' NOT IN (' + vals.join(', ') + ')';
	},
	InsertQuery: (args, indent) => {
		const tables: string[] = [];
		let fields: string[] = [];
		let values: string | string[] = [];
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
					fields = getAbstractSqlQuery(rest, 0).map(escapeField);
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
								values = typeRules[valuesType](valuesRest, indent);
								break;
							default:
								values = valuesArray.map((v) => Value(v, indent));
						}
					}
					break;
				}
				case 'From':
					tables.push(typeRules[type](rest, indent));
					break;
				default:
					throw new SyntaxError(`'InsertQuery' does not support '${type}'`);
			}
		}
		if (typeof values !== 'string' && fields.length !== values.length) {
			throw new SyntaxError(
				'Fields and Values must have the same length or use a query',
			);
		}

		if (fields.length > 0) {
			if (Array.isArray(values)) {
				values = 'VALUES (' + values.join(', ') + ')';
			}
			return (
				'INSERT INTO ' +
				tables.join(', ') +
				' (' +
				fields.join(', ') +
				')' +
				indent +
				values
			);
		} else {
			return 'INSERT INTO ' + tables.join(', ') + ' DEFAULT VALUES';
		}
	},
	UpdateQuery: (args, indent) => {
		const tables: string[] = [];
		let fields: string[] = [];
		let values: string[] = [];
		let where: string = '';
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
					fields = getAbstractSqlQuery(rest, 0).map(escapeField);
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
					values = valuesArray.map((v) => Value(v, indent));
					break;
				}
				case 'From':
					tables.push(typeRules[type](rest, indent));
					break;
				case 'Where':
					if (where !== '') {
						throw new SyntaxError(
							`'UpdateQuery' can only accept one '${type}'`,
						);
					}
					where = indent + typeRules[type](rest, indent);
					break;
				default:
					throw new SyntaxError(`'UpdateQuery' does not support '${type}'`);
			}
		}
		if (fields.length !== values.length) {
			throw new SyntaxError('Fields and Values must have the same length');
		}
		const sets = fields.map((field, i) => field + ' = ' + values[i]);

		return (
			'UPDATE ' +
			tables.join(', ') +
			indent +
			'SET ' +
			sets.join(',' + NestedIndent(indent)) +
			where
		);
	},
	DeleteQuery: (args, indent) => {
		const tables: string[] = [];
		let where: string = '';
		for (const arg of args) {
			if (!isAbstractSqlQuery(arg)) {
				throw new SyntaxError('`DeleteQuery` args must all be arrays');
			}
			const [type, ...rest] = arg;
			switch (type) {
				case 'From':
					tables.push(typeRules[type](rest, indent));
					break;
				case 'Where':
					if (where !== '') {
						throw new SyntaxError(
							`'DeleteQuery' can only accept one '${type}'`,
						);
					}
					where = indent + typeRules[type](rest, indent);
					break;
				default:
					throw new SyntaxError(`'DeleteQuery' does not support '${type}'`);
			}
		}

		return 'DELETE FROM ' + tables.join(', ') + where;
	},
	EscapeForLike: (args, indent) => {
		checkArgs('EscapeForLike', args, 1);
		const textTypeNode = getAbstractSqlQuery(args, 0);
		return typeRules.Replace(
			[
				[
					'Replace',
					[
						'Replace',
						textTypeNode,
						['EmbeddedText', '\\'],
						['EmbeddedText', '\\\\'],
					],
					['EmbeddedText', '_'],
					['EmbeddedText', '\\_'],
				],
				['EmbeddedText', '%'],
				['EmbeddedText', '\\%'],
			],
			indent,
		);
	},
};

const toSqlResult = (query: string): SqlResult | string => {
	if (noBinds) {
		return query;
	}
	return {
		query,
		bindings: fieldOrderings,
	};
};

export function AbstractSQLRules2SQL(
	abstractSQL: UpsertQueryNode,
	$engine: Engines,
	$noBinds: true,
): [string, string];
export function AbstractSQLRules2SQL(
	abstractSQL: AbstractSqlQuery,
	$engine: Engines,
	$noBinds: true,
): string;
export function AbstractSQLRules2SQL(
	abstractSQL: UpsertQueryNode,
	$engine: Engines,
	$noBinds?: false,
): [SqlResult, SqlResult];
export function AbstractSQLRules2SQL(
	abstractSQL:
		| SelectQueryNode
		| UnionQueryNode
		| InsertQueryNode
		| UpdateQueryNode
		| DeleteQueryNode,
	$engine: Engines,
	$noBinds?: false,
): SqlResult;
export function AbstractSQLRules2SQL(
	abstractSQL: AbstractSqlQuery,
	$engine: Engines,
	$noBinds?: false,
): SqlResult | [SqlResult, SqlResult];
export function AbstractSQLRules2SQL(
	abstractSQL: AbstractSqlQuery,
	$engine: Engines,
	$noBinds?: boolean,
): SqlResult | [SqlResult, SqlResult] | string;
export function AbstractSQLRules2SQL(
	abstractSQL: AbstractSqlQuery,
	$engine: Engines,
	$noBinds = false,
): SqlResult | [SqlResult, SqlResult] | string | [string, string] {
	engine = $engine;
	noBinds = $noBinds;
	fieldOrderings = [];
	fieldOrderingsLookup = {};

	const indent = '\n';
	const [type, ...rest] = abstractSQL;
	switch (type) {
		case 'SelectQuery':
		case 'UnionQuery':
		case 'InsertQuery':
		case 'UpdateQuery':
		case 'DeleteQuery': {
			const query = typeRules[type](rest, indent);
			return toSqlResult(query);
		}
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
			const insertSql = typeRules.InsertQuery(insertQuery.slice(1), indent);
			const insert = toSqlResult(insertSql);
			// Reset fieldOrderings for the second query
			fieldOrderings = [];
			fieldOrderingsLookup = {};
			const updateSql = typeRules.UpdateQuery(updateQuery.slice(1), indent);
			const update = toSqlResult(updateSql);
			return [insert, update] as [string, string] | [SqlResult, SqlResult];
		}
		default: {
			const value = AnyValue(abstractSQL, indent);
			if (noBinds) {
				return value;
			}
			return {
				query: `SELECT ${value} AS "result";`,
				bindings: fieldOrderings,
			};
		}
	}
}
