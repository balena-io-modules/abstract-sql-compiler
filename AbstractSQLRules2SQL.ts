import * as _ from 'lodash';

import sbvrTypes = require('@resin/sbvr-types');

import { Engines, AbstractSqlQuery } from './AbstractSQLCompiler';
import { Dictionary } from 'lodash';

export type Binding = [string, any] | ['Bind', number | string | any[]];
export interface SqlResult {
	query: string;
	bindings: Binding[];
}

type MatchFn = (args: AbstractSqlQuery, indent: string) => string;

let fieldOrderings: Binding[] = [];
let engine: Engines = Engines.postgres;

const comparisons = {
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

const AnyValue: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	if (type === 'Case') {
		return typeRules[type](rest, indent);
	}

	for (const matcher of [
		TextValue,
		NumericValue,
		BooleanValue,
		DateValue,
		JSONValue,
		DurationValue,
	]) {
		try {
			return matcher(args, indent);
		} catch (e) {
			CheckErr(e);
		}
	}

	throw new SyntaxError(`AnyValue does not support ${type}`);
};
const UnknownValue: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Null':
		case 'Field':
		case 'ReferencedField':
		case 'Bind':
		case 'Cast':
			return typeRules[type](rest, indent);
		case 'SelectQuery':
		case 'UnionQuery':
			const nestedIndent = NestedIndent(indent);
			const query = typeRules[type](rest, nestedIndent);
			return '(' + nestedIndent + query + indent + ')';
		default:
			throw new Error(`Invalid "UnknownValue" type: ${type}`);
	}
};
const TextValue: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Value':
		case 'Text':
		case 'EmbeddedText':
		case 'Concat':
		case 'Concatenate':
		case 'Lower':
		case 'Upper':
		case 'Trim':
		case 'Replace':
		case 'Substring':
		case 'Right':
			return typeRules[type](rest, indent);
		default:
			return UnknownValue(args, indent);
	}
};
const NumericValue: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Number':
		case 'Real':
		case 'Integer':
		case 'Add':
		case 'Subtract':
		case 'Multiply':
		case 'Divide':
		case 'BitwiseAnd':
		case 'BitwiseShiftRight':
		case 'CharacterLength':
		case 'StrPos':
		case 'Year':
		case 'Month':
		case 'Day':
		case 'Hour':
		case 'Minute':
		case 'Second':
		case 'Fractionalseconds':
		case 'Totalseconds':
		case 'Round':
		case 'Floor':
		case 'Ceiling':
			return typeRules[type](rest, indent);
		default:
			return UnknownValue(args, indent);
	}
};
const BooleanValue: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Boolean':
		case 'Not':
		case 'And':
		case 'Or':
		case 'Exists':
		case 'NotExists':
		case 'Between':
		case 'In':
		case 'NotIn':
		case 'Equals':
		case 'GreaterThan':
		case 'GreaterThanOrEqual':
		case 'LessThan':
		case 'LessThanOrEqual':
		case 'NotEquals':
		case 'Like':
			return typeRules[type](rest, indent);
		default:
			return UnknownValue(args, indent);
	}
};
const DateValue: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Date':
		case 'ToDate':
		case 'ToTime':
		case 'Now':
			return typeRules[type](rest, indent);
		default:
			return UnknownValue(args, indent);
	}
};
const JSONValue: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'AggregateJSON':
			return typeRules[type](rest, indent);
		default:
			return UnknownValue(args, indent);
	}
};
const DurationValue: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Duration':
			return typeRules[type](rest, indent);
		default:
			return UnknownValue(args, indent);
	}
};
const Field: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Field':
		case 'ReferencedField':
			return typeRules[type](rest, indent);
		default:
			throw new SyntaxError(`Invalid field type: ${type}`);
	}
};

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

const Comparison = (comparison: keyof typeof comparisons): MatchFn => {
	return (args, indent) => {
		checkArgs(comparison, args, 2);
		const a = AnyValue(getAbstractSqlQuery(args, 0), indent);
		const b = AnyValue(getAbstractSqlQuery(args, 1), indent);
		return a + comparisons[comparison] + b;
	};
};
const NumberMatch = (type: string): MatchFn => {
	return args => {
		checkArgs(type, args, 1);
		const n = args[0];
		if (!_.isNumber(n)) {
			throw new SyntaxError(`${type} expected number but got ${typeof n}`);
		}
		return `${n}`;
	};
};
const mathOps = {
	Add: '+',
	Subtract: '-',
	Multiply: '*',
	Divide: '/',
};
const MathOp = (type: keyof typeof mathOps): MatchFn => {
	return (args, indent) => {
		checkArgs(type, args, 2);
		const a = NumericValue(getAbstractSqlQuery(args, 0), indent);
		const b = NumericValue(getAbstractSqlQuery(args, 1), indent);
		return `${a} ${mathOps[type]} ${b}`;
	};
};

const fractionalSecondsFormat = function(date: string) {
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

const basicDateFormat = function(part: string) {
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
		if (engine === 'websql') {
			return websqlDateFormats[type](date);
		} else {
			return dateFormats[type](date);
		}
	};
};

const Concatenate: MatchFn = (args, indent) => {
	checkMinArgs('Concatenate', args, 1);
	const comparators = args.map(arg => {
		if (!_.isArray(arg)) {
			throw new SyntaxError(
				`Expected AbstractSqlQuery array but got ${typeof arg}`,
			);
		}
		return TextValue(arg, indent);
	});
	if (engine === 'mysql') {
		return 'CONCAT(' + comparators.join(', ') + ')';
	} else {
		return '(' + comparators.join(' || ') + ')';
	}
};

const Text: MatchFn = args => {
	checkArgs('Text', args, 1);
	return AddBind(['Text', args[0]]);
};

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

const Value = (arg: any, indent: string): string => {
	switch (arg) {
		case true:
			return '1';
		case false:
			return '0';
		case 'Default':
			return 'DEFAULT';
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
					return typeRules[type](rest, indent);
				default:
					throw new SyntaxError(`Invalid type for Value ${type}`);
			}
	}
};

const SelectMatch: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'Count':
			return typeRules[type](rest, indent);
		default:
			return AnyValue(args, indent);
	}
};
const FromMatch: MatchFn = (args, indent) => {
	const [type, ...rest] = args;
	switch (type) {
		case 'SelectQuery':
		case 'UnionQuery':
			const nestedindent = NestedIndent(indent);
			const query = typeRules[type](rest, nestedindent);
			return '(' + nestedindent + query + indent + ')';
		case 'Table':
			checkArgs('Table', rest, 1);
			return escapeField(rest[0]);
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
		case 'Alias':
			checkArgs('Alias', rest, 2);
			const field = matchFn(getAbstractSqlQuery(rest, 0), indent);
			return `${field} AS "${rest[1]}"`;
		default:
			return matchFn(args, indent);
	}
};

const AddBind = (bind: Binding): string => {
	if (engine === 'postgres') {
		if (bind[0] === 'Bind') {
			const existingBindIndex = _.findIndex(fieldOrderings, existingBind =>
				_.isEqual(bind, existingBind),
			);
			if (existingBindIndex !== -1) {
				// Reuse the existing bind if there is one, adding 1 because the postgres binds start from $1
				return '$' + (existingBindIndex + 1);
			}
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
			.map(arg => {
				if (!_.isArray(arg)) {
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
		const tables = [];
		let select: string = '';
		const groups = {
			Where: '',
			GroupBy: '',
			OrderBy: '',
			Limit: '',
			Offset: '',
		};
		for (const arg of args) {
			if (!_.isArray(arg)) {
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
				case 'Where':
				case 'GroupBy':
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
		const from =
			tables.length > 0
				? indent + 'FROM ' + tables.join(',' + NestedIndent(indent))
				: '';

		return (
			'SELECT ' +
			select +
			from +
			groups.Where +
			groups.GroupBy +
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
			.map(arg => {
				if (!_.isArray(arg)) {
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
	Where: (args, indent) => {
		checkArgs('Where', args, 1);
		const ruleBody = BooleanValue(getAbstractSqlQuery(args, 0), indent);
		return 'WHERE ' + ruleBody;
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
					const field = Field(getAbstractSqlQuery(arg, 1), indent);
					return `${field} ${order}`;
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
	Count: args => {
		checkArgs('Count', args, 1);
		if (args[0] !== '*') {
			throw new SyntaxError('"Count" only supports "*"');
		}
		return 'COUNT(*)';
	},
	Field: args => {
		checkArgs('Field', args, 1);
		return escapeField(args[0]);
	},
	ReferencedField: args => {
		checkArgs('ReferencedField', args, 2);
		return `"${args[0]}".${escapeField(args[1])}`;
	},
	Cast: (args, indent) => {
		checkArgs('Cast', args, 2);
		const value = AnyValue(getAbstractSqlQuery(args, 0), indent);
		const typeName = args[1] as string;
		if (!sbvrTypes[typeName] || !sbvrTypes[typeName].types[engine]) {
			throw new SyntaxError(`Invalid cast type: ${typeName}`);
		}
		let type: string;
		const dbType = sbvrTypes[typeName].types[engine];
		if (_.isFunction(dbType) || dbType.toUpperCase() === 'SERIAL') {
			// HACK: SERIAL type in postgres is really an INTEGER with automatic sequence,
			// so it's not actually possible to cast to SERIAL, instead you have to cast to INTEGER.
			// For mysql/websql it's a function since it needs to generate an INTEGER ... AUTOINCREMENT/AUTO_INCREMENT
			type = 'INTEGER';
		} else {
			type = dbType;
		}
		return `CAST(${value} AS ${type})`;
	},
	Number: NumberMatch('Number'),
	Real: NumberMatch('Real'),
	Integer: NumberMatch('Integer'),
	Boolean: args => {
		checkArgs('Boolean', args, 1);
		const b = args[0];
		if (!_.isBoolean(b)) {
			throw new SyntaxError(`Boolean expected boolean but got ${typeof b}`);
		}
		return b ? '1' : '0';
	},
	EmbeddedText: args => {
		checkArgs('EmbeddedText', args, 1);
		return `'${args[0]}'`;
	},
	Null: args => {
		checkArgs('Null', args, 0);
		return 'NULL';
	},
	Now: args => {
		checkArgs('Now', args, 0);
		return 'CURRENT_TIMESTAMP';
	},
	AggregateJSON: args => {
		checkArgs('AggregateJSON', args, 1);
		args = getAbstractSqlQuery(args, 0);
		checkArgs("AggregateJSON's argument", args, 2);
		if (engine !== 'postgres') {
			throw new SyntaxError('AggregateJSON not supported on: ' + engine);
		}
		const [table, field] = args;
		return `coalesce(array_to_json(array_agg("${table}".${escapeField(
			field,
		)})), '[]')`;
	},
	Equals: Comparison('Equals'),
	GreaterThan: Comparison('GreaterThan'),
	GreaterThanOrEqual: Comparison('GreaterThanOrEqual'),
	LessThan: Comparison('LessThan'),
	LessThanOrEqual: Comparison('LessThanOrEqual'),
	NotEquals: Comparison('NotEquals'),
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
	Totalseconds: (args, indent) => {
		checkArgs('Totalseconds', args, 1);
		const duration = DurationValue(getAbstractSqlQuery(args, 0), indent);
		if (engine === 'postgres') {
			return `EXTRACT(EPOCH FROM ${duration})`;
		} else if (this.engine === 'mysql') {
			return `(TIMESTAMPDIFF(MICROSECOND, FROM_UNIXTIME(0), FROM_UNIXTIME(0) + ${duration}) / 1000000)`;
		} else {
			throw new SyntaxError('TotalSeconds not supported on: ' + engine);
		}
	},
	Concat: Concatenate,
	Concatenate: Concatenate,
	Replace: (args, indent) => {
		checkArgs('Replace', args, 3);
		const str = TextValue(getAbstractSqlQuery(args, 0), indent);
		const find = TextValue(getAbstractSqlQuery(args, 1), indent);
		const replacement = TextValue(getAbstractSqlQuery(args, 2), indent);
		return `REPLACE(${str}, ${find}, ${replacement})`;
	},
	CharacterLength: (args, indent) => {
		checkArgs('CharacterLength', args, 1);
		const text = TextValue(getAbstractSqlQuery(args, 0), indent);
		if (engine === 'mysql') {
			return `CHAR_LENGTH(${text})`;
		} else {
			return `LENGTH(${text})`;
		}
	},
	StrPos: (args, indent) => {
		checkArgs('StrPos', args, 2);
		const haystack = TextValue(getAbstractSqlQuery(args, 0), indent);
		const needle = TextValue(getAbstractSqlQuery(args, 1), indent);
		if (engine === 'postgres') {
			return `STRPOS(${haystack}, ${needle})`;
		} else {
			return `INSTR(${haystack}, ${needle})`;
		}
	},
	Substring: (args, indent) => {
		checkMinArgs('Substring', args, 2);
		const str = TextValue(getAbstractSqlQuery(args, 0), indent);
		const nums = args.slice(1).map(arg => {
			if (!_.isArray(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return NumericValue(arg, indent);
		});
		return `SUBSTRING(${[str].concat(nums).join(', ')})`;
	},
	Right: (args, indent) => {
		checkArgs('Right', args, 2);
		const str = TextValue(getAbstractSqlQuery(args, 0), indent);
		const n = NumericValue(getAbstractSqlQuery(args, 0), indent);
		if (engine === 'websql') {
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
	ToTime: (args, indent) => {
		checkArgs('ToTime', args, 1);
		const date = DateValue(getAbstractSqlQuery(args, 0), indent);
		if (engine === 'postgres') {
			return `CAST(${date} AS TIME)`;
		} else {
			return `TIME(${date})`;
		}
	},
	Case: (args, indent) => {
		checkMinArgs('Case', args, 1);
		const nestedIndent = NestedIndent(indent);
		const clauses = args
			.map((arg, index) => {
				if (!_.isArray(arg)) {
					throw new SyntaxError(
						`Expected AbstractSqlQuery array but got ${typeof arg}`,
					);
				}
				const [type, ...rest] = arg;
				switch (type) {
					case 'When':
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
			.map(arg => {
				if (!_.isArray(arg)) {
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
				.map(arg => {
					if (!_.isArray(arg)) {
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
	Bind: args => {
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
	Text: Text,
	Value: Text,
	Date: args => {
		checkArgs('Date', args, 1);
		return AddBind(['Date', args[0]]);
	},
	Duration: args => {
		checkArgs('Duration', args, 1);
		if (engine === 'websql') {
			throw new SyntaxError('Durations not supported on: ' + engine);
		}
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
		return (
			"INTERVAL '" +
			(duration.negative ? '-' : '') +
			(duration.day || '0') +
			' ' +
			(duration.negative ? '-' : '') +
			(duration.hour || '0') +
			':' +
			(duration.minute || '0') +
			':' +
			// Force seconds to be at least 0.0 - required for mysql
			Number(duration.second).toLocaleString('en', {
				minimumFractionDigits: 1,
			}) +
			"'" +
			(engine === 'mysql' ? ' DAY_MICROSECOND' : '')
		);
	},
	Exists: (args, indent) => {
		checkArgs('Exists', args, 1);
		args = getAbstractSqlQuery(args, 0);
		const [type, ...rest] = args;
		switch (type) {
			case 'SelectQuery':
			case 'UnionQuery':
				const nestedIndent = NestedIndent(indent);
				const query = typeRules[type](rest, nestedIndent);
				return 'EXISTS (' + nestedIndent + query + indent + ')';
			default:
				return AnyValue(args, indent) + ' IS NOT NULL';
		}
	},
	NotExists: (args, indent) => {
		checkArgs('NotExists', args, 1);
		args = getAbstractSqlQuery(args, 0);
		const [type, ...rest] = args;
		switch (type) {
			case 'SelectQuery':
			case 'UnionQuery':
				const nestedIndent = NestedIndent(indent);
				const query = typeRules[type](rest, nestedIndent);
				return 'NOT EXISTS (' + nestedIndent + query + indent + ')';
			default:
				return AnyValue(args, indent) + ' IS NULL';
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
		const vals = args.slice(1).map(arg => {
			if (!_.isArray(arg)) {
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
		const vals = args.slice(1).map(arg => {
			if (!_.isArray(arg)) {
				throw new SyntaxError(
					`Expected AbstractSqlQuery array but got ${typeof arg}`,
				);
			}
			return AnyValue(arg, indent);
		});
		return field + ' NOT IN (' + vals.join(', ') + ')';
	},
	InsertQuery: (args, indent) => {
		const tables = [];
		let fields: string[] = [];
		let values: string | string[] = [];
		for (const arg of args) {
			if (!_.isArray(arg)) {
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
								values = typeRules[valuesType](valuesRest, indent);
								break;
							default:
								values = valuesArray.map(arg => Value(arg, indent));
						}
					}
					break;
				case 'From':
					tables.push(typeRules[type](rest, indent));
					break;
				default:
					throw new SyntaxError(`'InsertQuery' does not support '${type}'`);
			}
		}
		if (!_.isString(values) && fields.length !== values.length) {
			throw new SyntaxError(
				'Fields and Values must have the same length or use a query',
			);
		}

		if (fields.length > 0) {
			if (_.isArray(values)) {
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
		const tables = [];
		let fields: string[] = [];
		let values: string[] = [];
		let where: string = '';
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
					fields = getAbstractSqlQuery(rest, 0).map(escapeField);
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
					values = valuesArray.map(arg => Value(arg, indent));
					break;
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
		const tables = [];
		let where: string = '';
		for (const arg of args) {
			if (!_.isArray(arg)) {
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
};

export const AbstractSQLRules2SQL = (
	abstractSQL: AbstractSqlQuery,
	$engine: Engines,
): SqlResult | SqlResult[] => {
	engine = $engine;
	fieldOrderings = [];

	const indent = '\n';
	const [type, ...rest] = abstractSQL;
	switch (type) {
		case 'SelectQuery':
		case 'UnionQuery':
		case 'InsertQuery':
		case 'UpdateQuery':
		case 'DeleteQuery':
			const query = typeRules[type](rest, indent);
			return {
				query,
				bindings: fieldOrderings,
			};
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
			const insertSql = typeRules.InsertQuery(insertQuery.slice(1), indent);
			const insert = {
				query: insertSql,
				bindings: fieldOrderings,
			};
			// Reset fieldOrderings for the second query
			fieldOrderings = [];
			const updateSql = typeRules.UpdateQuery(updateQuery.slice(1), indent);
			const update = {
				query: updateSql,
				bindings: fieldOrderings,
			};
			return [insert, update];
		default:
			const value = AnyValue(abstractSQL, indent);
			return {
				query: `SELECT ${value} AS "result";`,
				bindings: fieldOrderings,
			};
	}
};
