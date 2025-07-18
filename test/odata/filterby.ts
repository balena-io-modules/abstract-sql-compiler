/*
 * decaffeinate suggestions:
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { expect } from 'chai';
import type { ExpectationSuccessFn } from './test';
import test, { clientModel } from './test';
import _ from 'lodash';
import { odataNameToSqlName } from '@balena/odata-to-abstract-sql';
import { pilotFields, teamFields, aliasPilotCanFlyPlaneFields } from './fields';
import type {
	Binding,
	DurationNode,
	SqlResult,
} from '../../src/AbstractSQLCompiler';

const pilotFieldsStr = pilotFields.join(', ');
const aliasPilotCanFlyPlaneFieldsStr = aliasPilotCanFlyPlaneFields.join(', ');
const teamFieldsStr = teamFields.join(', ');

type ParsedOperand = {
	odata: string | number | boolean;
	bindings: Binding[];
	sql: string;
};
type Operand =
	| string
	| number
	| boolean
	| Date
	| DurationNode[1]
	| ParsedOperand;

let parseOperandFactory = function (defaultResource = 'pilot') {
	let bindNo = 0;
	const operandToOData = function (operand: Operand) {
		if (operand != null && typeof operand === 'object') {
			if ('odata' in operand) {
				return operand.odata;
			}
			if (_.isDate(operand)) {
				return "datetime'" + encodeURIComponent(operand.toISOString()) + "'";
			}

			const duration: Array<string | number> = [];
			let t = false;
			if (operand.negative) {
				duration.push('-');
			}
			duration.push('P');
			if (operand.day != null) {
				duration.push(operand.day, 'D');
			}
			if (operand.hour != null) {
				t = true;
				duration.push('T', operand.hour, 'H');
			}
			if (operand.minute != null) {
				if (!t) {
					t = true;
					duration.push('T');
				}
				duration.push(operand.minute, 'M');
			}
			if (operand.second != null) {
				if (!t) {
					t = true;
					duration.push('T');
				}
				duration.push(operand.second, 'S');
			}
			if (duration.length < 3) {
				throw new Error('Duration must contain at least 1 component');
			}
			return `duration'${duration.join('')}'`;
		}
		return operand;
	};

	const operandToBindings = function (operand: Operand): Binding[] {
		if (typeof operand === 'object' && 'bindings' in operand) {
			return operand.bindings;
		}
		if (
			typeof operand === 'boolean' ||
			typeof operand === 'number' ||
			_.isDate(operand) ||
			(typeof operand === 'string' && operand.startsWith("'"))
		) {
			return [['Bind', bindNo++]];
		}
		return [];
	};

	const operandToSQL = function (
		operand: Operand,
		resource = defaultResource,
	): string {
		if (typeof operand === 'object' && 'sql' in operand) {
			return operand.sql;
		}
		if (
			typeof operand === 'boolean' ||
			typeof operand === 'number' ||
			_.isDate(operand)
		) {
			return '?';
		}
		if (typeof operand === 'string') {
			let mapping;
			if (operand === 'null') {
				return 'NULL';
			}
			if (operand.startsWith("'")) {
				return '?';
			}
			const fieldParts = operand.split('/');
			if (fieldParts.length > 1) {
				let alias = resource;
				let previousResource = resource;
				for (const resourceName of fieldParts.slice(0, -1)) {
					const sqlName = odataNameToSqlName(resourceName);
					const sqlNameParts = sqlName.split('-');
					mapping = _.get(
						clientModel.relationships[previousResource],
						sqlNameParts.join('.'),
					).$;
					const refTable = mapping[1][0];
					if (sqlNameParts.length > 1 && !_.includes(refTable, '-')) {
						alias = `${alias}.${sqlNameParts[0]}-${refTable}`;
					} else {
						alias = `${alias}.${refTable}`;
					}
					previousResource = refTable;
				}
				mapping = [alias, _.last(fieldParts)];
			} else {
				mapping = [resource, odataNameToSqlName(operand)];
			}
			return '"' + mapping.join('"."') + '"';
		}
		if (operand != null && typeof operand === 'object') {
			const sign = operand.negative ? '-' : '';
			const day = operand.day ?? 0;
			const hour = operand.hour ?? 0;
			const minute = operand.minute ?? 0;
			const second = operand.second ?? 0;
			return `INTERVAL '${sign}${day} ${sign}${hour}:${minute}:${second}'`;
		}
		throw new Error(`Unknown operand type: ${operand}`);
	};

	return (operand: Operand): ParsedOperand => ({
		sql: operandToSQL(operand),
		bindings: operandToBindings(operand),
		odata: operandToOData(operand),
	});
};

let parseOperand: ReturnType<typeof parseOperandFactory> | null = null;
const run = (function () {
	let running = false;
	return function (fn: () => void) {
		if (!running) {
			running = true;
			parseOperand = parseOperandFactory();
			fn();
			parseOperand = null;
			running = false;
		} else {
			fn();
		}
	};
})();

const sqlOps = {
	eq: ' =',
	ne: ' !=',
	gt: ' >',
	ge: ' >=',
	lt: ' <',
	le: ' <=',
	and: '\nAND',
	or: '\nOR',
	add: ' +',
	sub: ' -',
	mul: ' *',
	div: ' /',
};
const sqlOpBrackets = { or: true };

const methodMaps = {
	TOUPPER: 'UPPER',
	TOLOWER: 'LOWER',
};

const createExpression = function (lhs: Operand, op?: Operand, rhs?: Operand) {
	let sql;
	if (lhs === 'not') {
		op = parseOperand!(op!);
		return {
			odata: 'not(' + op.odata + ')',
			sql: 'NOT (\n\t' + op.sql + '\n)',
			bindings: op.bindings,
		};
	}
	if (rhs == null) {
		lhs = parseOperand!(lhs);
		return {
			odata: '(' + lhs.odata + ')',
			sql: lhs.sql,
			bindings: lhs.bindings,
		};
	}
	lhs = parseOperand!(lhs);
	rhs = parseOperand!(rhs);
	const bindings = lhs.bindings.concat(rhs.bindings);
	if (op === 'eq' || op === 'ne') {
		if ([lhs.sql, rhs.sql].includes('NULL')) {
			const nullCheck = op === 'eq' ? ' IS NULL' : ' IS NOT NULL';
			if (lhs.sql === 'NULL') {
				sql = rhs.sql + nullCheck;
			} else {
				sql = lhs.sql + nullCheck;
			}
		} else {
			const isAtomic = /^([-." a-zA-Z]+|\?|\$[0-9]+)$/;
			const lhsSql = isAtomic.test(lhs.sql) ? lhs.sql : `(${lhs.sql})`;
			const rhsSql = isAtomic.test(rhs.sql) ? rhs.sql : `(${rhs.sql})`;
			const nullCheck = ' IS NOT NULL';
			const lhsNullCheck = lhs.sql === '?' ? '' : `${lhsSql}${nullCheck} AND `;
			const rhsNullCheck = rhs.sql === '?' ? '' : `${rhsSql}${nullCheck} AND `;
			const bothNullCheck =
				lhsNullCheck.length > 0 && rhsNullCheck.length > 0
					? ` OR ${lhsSql} IS NULL AND ${rhsSql} IS NULL`
					: '';

			if (lhsNullCheck.length > 0 || rhsNullCheck.length > 0) {
				if (op === 'ne') {
					const mainCheck = `${lhsSql}${sqlOps.eq} ${rhsSql}`;
					sql = `NOT(${lhsNullCheck}${rhsNullCheck}${mainCheck}${bothNullCheck})`;
				} else {
					const mainCheck = `${lhsSql}${sqlOps[op]} ${rhsSql}`;
					sql = `${lhsNullCheck}${rhsNullCheck}${mainCheck}${bothNullCheck}`;
				}
			} else {
				const mainCheck = `${lhs.sql}${sqlOps[op]} ${rhs.sql}`;
				sql = `${lhsNullCheck}${rhsNullCheck}${mainCheck}${bothNullCheck}`;
			}
		}
	} else {
		sql = `${lhs.sql}${sqlOps[op as keyof typeof sqlOps]} ${rhs.sql}`;
	}

	if (sqlOpBrackets[op as keyof typeof sqlOpBrackets]) {
		sql = '(' + sql + ')';
	}
	return {
		odata: `${lhs.odata} ${op} ${rhs.odata}`,
		sql,
		bindings,
	};
};
const createMethodCall = function (method: string, ...args: Operand[]) {
	const parsedArgs = args.map((arg) => parseOperand!(arg));
	const odata =
		method + '(' + parsedArgs.map((arg) => arg.odata).join(',') + ')';
	method = method.toUpperCase();
	switch (method) {
		case 'CONTAINS':
		case 'SUBSTRINGOF':
			if (method === 'SUBSTRINGOF') {
				parsedArgs.reverse();
			}
			return {
				sql: `${parsedArgs[0].sql} LIKE ('%' || REPLACE(REPLACE(REPLACE(${parsedArgs[1].sql}, '\\', '\\\\'), '_', '\\_'), '%', '\\%') || '%')`,
				bindings: [...parsedArgs[0].bindings, ...parsedArgs[1].bindings],
				odata,
			};
		case 'STARTSWITH':
			return {
				sql: `STARTS_WITH(${parsedArgs[0].sql}, ${parsedArgs[1].sql})`,
				bindings: [...parsedArgs[0].bindings, ...parsedArgs[1].bindings],
				odata,
			};
		case 'ENDSWITH':
			return {
				sql: `${parsedArgs[0].sql} LIKE ('%' || REPLACE(REPLACE(REPLACE(${parsedArgs[1].sql}, '\\', '\\\\'), '_', '\\_'), '%', '\\%'))`,
				bindings: [...parsedArgs[0].bindings, ...parsedArgs[1].bindings],
				odata,
			};
		case 'CONCAT':
			return {
				sql: '(' + parsedArgs.map((arg) => arg.sql).join(' || ') + ')',
				bindings: _.flatten(parsedArgs.map((arg) => arg.bindings)),
				odata,
			};
		case 'INDEXOF':
			return {
				sql: 'STRPOS(' + parsedArgs.map((arg) => arg.sql).join(', ') + ') - 1',
				bindings: _.flatten(parsedArgs.map((arg) => arg.bindings)),
				odata,
			};
		case 'NOW':
			return {
				sql: 'CURRENT_TIMESTAMP',
				bindings: [],
				odata,
			};
		case 'YEAR':
		case 'MONTH':
		case 'DAY':
		case 'HOUR':
		case 'MINUTE':
			return {
				sql: `EXTRACT('${method}' FROM DATE_TRUNC('milliseconds', ${parsedArgs[0].sql}, 'UTC'))`,
				bindings: parsedArgs[0].bindings,
				odata,
			};
		case 'SECOND':
			return {
				sql: `FLOOR(EXTRACT('${method}' FROM DATE_TRUNC('milliseconds', ${parsedArgs[0].sql}, 'UTC')))`,
				bindings: parsedArgs[0].bindings,
				odata,
			};
		case 'FRACTIONALSECONDS':
			return {
				sql: `EXTRACT('SECOND' FROM DATE_TRUNC('milliseconds', ${parsedArgs[0].sql}, 'UTC')) - FLOOR(EXTRACT('SECOND' FROM DATE_TRUNC('milliseconds', ${parsedArgs[0].sql}, 'UTC')))`,
				bindings: parsedArgs[0].bindings,
				odata,
			};
		case 'TIME':
			return {
				sql: `CAST(DATE_TRUNC('milliseconds', ${parsedArgs[0].sql}, 'UTC') AS ${method})`,
				bindings: parsedArgs[0].bindings,
				odata,
			};
		case 'TOTALSECONDS':
			return {
				sql: `EXTRACT(EPOCH FROM ${parsedArgs[0].sql})`,
				bindings: parsedArgs[0].bindings,
				odata,
			};
		case 'DATE':
			return {
				sql: `DATE(DATE_TRUNC('milliseconds', ${parsedArgs[0].sql}, 'UTC'))`,
				bindings: parsedArgs[0].bindings,
				odata,
			};
		default: {
			if (Object.prototype.hasOwnProperty.call(methodMaps, method)) {
				method = methodMaps[method as keyof typeof methodMaps];
			}
			switch (method) {
				case 'SUBSTRING':
					parsedArgs[1].sql += ' + 1';
					break;
			}
			const sql =
				method + '(' + parsedArgs.map((arg) => arg.sql).join(', ') + ')';
			return {
				sql,
				bindings: _.flatten(parsedArgs.map((arg) => arg.bindings)),
				odata,
			};
		}
	}
};

const operandTest = (
	lhs: Operand,
	op?: Operand,
	rhs?: Operand,
	override?: Partial<ParsedOperand>,
) => {
	run(function () {
		let from;
		let { odata, sql, bindings } = createExpression(lhs, op, rhs);
		bindings = override?.bindings ?? bindings;
		sql = override?.sql ?? sql;
		if (_.includes(odata, '/')) {
			from = `\
"pilot"
LEFT JOIN "pilot" AS "pilot.trained-pilot" ON "pilot"."id" = "pilot.trained-pilot"."was trained by-pilot"`;
		} else {
			from = '"pilot"';
		}

		test(`/pilot?$filter=${odata}`, 'GET', bindings, (result, sqlEquals) => {
			it('should select from pilot where "' + odata + '"', () => {
				sqlEquals(
					result,
					`\
SELECT ${pilotFieldsStr}
FROM ${from}
WHERE ${sql}`,
				);
			});
		});
		test(
			`/pilot/$count?$filter=${odata}`,
			'GET',
			bindings,
			(result, sqlEquals) => {
				it('should select count(*) from pilot where "' + odata + '"', () => {
					sqlEquals(
						result,
						`\
SELECT COUNT(*) AS "$count"
FROM ${from}
WHERE ${sql}`,
					);
				});
			},
		);
	});
};

const methodTest = (...args: [method: string, ...Operand[]]) => {
	run(function () {
		const { odata, sql, bindings } = createMethodCall(...args);
		test(`/pilot?$filter=${odata}`, 'GET', bindings, (result, sqlEquals) => {
			it('should select from pilot where "' + odata + '"', () => {
				sqlEquals(
					result,
					`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE ` + sql,
				);
			});
		});
		test(
			`/pilot/$count?$filter=${odata}`,
			'GET',
			bindings,
			(result, sqlEquals) => {
				it('should select count(*) from pilot where "' + odata + '"', () => {
					sqlEquals(
						result,
						`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
WHERE ` + sql,
					);
				});
			},
		);
	});
};

// Test each combination of operands and operations
(function () {
	const operations = ['eq', 'ne', 'gt', 'ge', 'lt', 'le'];
	const nonNullableOperands = [
		2,
		-2,
		2.5,
		-2.5,
		"'bar'",
		new Date(),
		true,
		false,
	];
	const nullableOperands = [
		'name',
		'trained__pilot/name',
		{ negative: true, day: 3, hour: 4, minute: 5, second: 6.7 },
		// null is quoted as otherwise we hit issues with coffeescript defaulting values
		// 'null',
	];
	operations.forEach((op) => {
		describe(op, () => {
			nonNullableOperands.forEach((lhs) => {
				[...nonNullableOperands, ...nullableOperands].forEach((rhs) => {
					run(() => {
						operandTest(lhs, op, rhs);
					});
				});
				run(() => {
					switch (op) {
						case 'eq':
						case 'ne':
							// eq/ne of non-nullable to null are automatically optimized away
							operandTest(lhs, op, 'null', {
								bindings: [],
								sql: op === 'eq' ? 'false' : 'true',
							});
							break;

						default:
							operandTest(lhs, op, 'null');
							break;
					}
				});
			});
			nullableOperands.forEach((lhs) => {
				[...nonNullableOperands, ...nullableOperands].forEach((rhs) => {
					run(() => {
						operandTest(lhs, op, rhs);
					});
				});
				run(() => {
					operandTest(lhs, op, 'null');
				});
			});
		});
	});
})();

run(function () {
	const left = createExpression('age', 'gt', 2);
	const right = createExpression('age', 'lt', 10);
	operandTest(left, 'and', right);
	operandTest(left, 'or', right);
	operandTest('is_experienced');
	operandTest('not', 'is_experienced');
	operandTest('not', left);
});

(function () {
	const mathOps = ['add', 'sub', 'mul', 'div'];
	mathOps.map((mathOp) => {
		run(() => {
			const mathOpExpr = createExpression('age', mathOp, 2);
			operandTest(mathOpExpr, 'gt', 10);
		});
	});
})();

run(function () {
	const odata = "name eq @name&@name='Pete'";
	test(
		`/pilot?$filter=${odata}`,
		'GET',
		[['Bind', '@name']],
		(result, sqlEquals) => {
			it('should select from pilot where "' + odata + '"', () => {
				sqlEquals(
					result,
					`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE "pilot"."name" IS NOT NULL AND "pilot"."name" = ?`,
				);
			});
		},
	);
});

run(function () {
	const odata = "name eq @x or favourite_colour eq @x&@x='Amber'";
	test(
		`/pilot?$filter=${odata}`,
		'GET',
		[['Bind', '@x']],
		(result, sqlEquals) => {
			it('should select from pilot where "' + odata + '"', () => {
				sqlEquals(
					result,
					`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE ("pilot"."name" IS NOT NULL AND "pilot"."name" = $1
OR "pilot"."favourite colour" IS NOT NULL AND "pilot"."favourite colour" = $1)`,
				);
			});
		},
	);
});

run(function () {
	const { odata, bindings, sql } = createExpression(
		'can_fly__plane/id',
		'eq',
		10,
	);
	test(`/pilot?$filter=${odata}`, 'GET', bindings, (result, sqlEquals) => {
		it('should select from pilot where "' + odata + '"', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
WHERE ${sql}`,
			);
		});
	});
});

run(function () {
	const { odata: keyOdata, bindings: keyBindings } = parseOperand!(1);
	const { odata, bindings } = createExpression('can_fly__plane/id', 'eq', 10);
	test(
		'/pilot(' + keyOdata + ')/can_fly__plane?$filter=' + odata,
		'GET',
		bindings.concat(keyBindings),
		(result, sqlEquals) => {
			it(
				'should select from pilot__can_fly__plane where "' + odata + '"',
				() => {
					sqlEquals(
						result,
						`\
SELECT ${aliasPilotCanFlyPlaneFieldsStr}
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.can fly-plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.can fly-plane"."id"
WHERE "pilot.pilot-can fly-plane.can fly-plane"."id" IS NOT NULL AND "pilot.pilot-can fly-plane.can fly-plane"."id" = ?
AND "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND "pilot"."id" IS NOT NULL AND "pilot"."id" = ?`,
					);
				},
			);
		},
	);
});

run(function () {
	const { odata, bindings, sql } = createExpression(
		'can_fly__plane/plane/id',
		'eq',
		10,
	);
	const name = 'Peter';
	const bodyBindings = [['Bind', ['pilot', 'name']], ...bindings] as const;
	const insertTest: ExpectationSuccessFn = (result, sqlEquals) => {
		sqlEquals(
			result,
			`\
INSERT INTO "pilot" ("name")
SELECT "$insert"."name"
FROM (
	SELECT CAST(NULL AS TIMESTAMPTZ) AS "created at", CAST(NULL AS TIMESTAMPTZ) AS "modified at", CAST(NULL AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS BOOLEAN) AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMPTZ) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
) AS "$insert"
WHERE EXISTS (
	SELECT 1
	FROM (
		SELECT "$insert".*
	) AS "pilot"
	LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE ${sql}
)`,
		);
	};
	const updateWhere = `\
WHERE "pilot"."id" IN ((
	SELECT "pilot"."id" AS "$modifyid"
	FROM "pilot"
	LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE ${sql}
))`;

	test(`/pilot?$filter=${odata}`, 'GET', bindings, (result, sqlEquals) => {
		it(`should select from pilot where '${odata}'`, () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
WHERE ${sql}`,
			);
		});
	});

	test(
		`/pilot?$filter=${odata}`,
		'PATCH',
		bodyBindings,
		{ name },
		(result, sqlEquals) => {
			it(`should update pilot where '${odata}'`, () => {
				sqlEquals(
					result,
					`\
UPDATE "pilot"
SET "name" = ?
${updateWhere}`,
				);
			});
		},
	);

	test(
		`/pilot?$filter=${odata}`,
		'POST',
		bodyBindings,
		{ name },
		(result, sqlEquals) => {
			it(`should insert pilot where '${odata}'`, () => {
				insertTest(result, sqlEquals);
			});
		},
	);

	test(
		`/pilot?$filter=${odata}`,
		'PUT',
		bodyBindings,
		{ name },
		(result, sqlEquals) => {
			describe('should upsert the pilot with id 1', function () {
				it('should be an upsert', () => {
					expect(result).to.be.an('array');
				});
				it('that inserts', () => {
					insertTest((result as SqlResult[])[0], sqlEquals);
				});
				it('and updates', () => {
					sqlEquals(
						(result as SqlResult[])[1],
						`\
UPDATE "pilot"
SET "created at" = DEFAULT,
	"modified at" = DEFAULT,
	"id" = DEFAULT,
	"person" = DEFAULT,
	"is experienced" = DEFAULT,
	"name" = ?,
	"age" = DEFAULT,
	"favourite colour" = DEFAULT,
	"is on-team" = DEFAULT,
	"licence" = DEFAULT,
	"hire date" = DEFAULT,
	"was trained by-pilot" = DEFAULT
${updateWhere}`,
					);
				});
			});
		},
	);

	test(`/pilot?$filter=${odata}`, 'DELETE', bindings, (result, sqlEquals) => {
		it('should delete from pilot where "' + odata + '"', () => {
			sqlEquals(
				result,
				`\
DELETE FROM "pilot"
WHERE "pilot"."id" IN ((
	SELECT "pilot"."id" AS "$modifyid"
	FROM "pilot"
	LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE ${sql}
))`,
			);
		});
	});
});

run(function () {
	const name = 'Peter';
	const {
		odata,
		sql,
		bindings: exprBindings,
	} = createExpression('name', 'eq', `'${name}'`);
	test(
		`/pilot?$filter=${odata}`,
		'POST',
		[['Bind', ['pilot', 'name']], ...exprBindings],
		{ name },
		(result, sqlEquals) => {
			it(`should insert into pilot where '${odata}'`, () => {
				sqlEquals(
					result,
					`\
INSERT INTO "pilot" ("name")
SELECT "$insert"."name"
FROM (
	SELECT CAST(NULL AS TIMESTAMPTZ) AS "created at", CAST(NULL AS TIMESTAMPTZ) AS "modified at", CAST(NULL AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS BOOLEAN) AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMPTZ) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
) AS "$insert"
WHERE EXISTS (
	SELECT 1
	FROM (
		SELECT "$insert".*
	) AS "pilot"
	WHERE ${sql}
)`,
				);
			});
		},
	);
});

run(function () {
	const name = 'Peter';
	const { odata: keyOdata, bindings: keyBindings } = parseOperand!(1);
	const {
		odata,
		sql,
		bindings: exprBindings,
	} = createExpression('name', 'eq', `'${name}'`);
	const bodyBindings = [['Bind', ['pilot', 'name']]] as const;
	const insertBindings = [
		['Bind', ['pilot', 'id']],
		...bodyBindings,
		...exprBindings,
		...keyBindings,
	] as const;
	const updateBindings = [
		...bodyBindings,
		...keyBindings,
		...exprBindings,
	] as const;
	test(
		'/pilot(' + keyOdata + ')?$filter=' + odata,
		'PATCH',
		updateBindings,
		{ name },
		(result, sqlEquals) => {
			it('should update the pilot with id 1', () => {
				sqlEquals(
					result,
					`\
UPDATE "pilot"
SET "name" = ?
WHERE "pilot"."id" IS NOT NULL AND "pilot"."id" = ?
AND "pilot"."id" IN ((
	SELECT "pilot"."id" AS "$modifyid"
	FROM "pilot"
	WHERE ${sql}
))`,
				);
			});
		},
	);

	test(
		'/pilot(' + keyOdata + ')?$filter=' + odata,
		'PUT',
		[insertBindings, [['Bind', ['pilot', 'id']], ...updateBindings]],
		{ name },
		(result, sqlEquals) => {
			describe('should upsert the pilot with id 1', function () {
				it('should be an upsert', () => {
					expect(result).to.be.an('array');
				});
				it('that inserts', () => {
					sqlEquals(
						(result as SqlResult[])[0],
						`\
INSERT INTO "pilot" ("id", "name")
SELECT "$insert"."id", "$insert"."name"
FROM (
	SELECT CAST(NULL AS TIMESTAMPTZ) AS "created at", CAST(NULL AS TIMESTAMPTZ) AS "modified at", CAST(? AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS BOOLEAN) AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMPTZ) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
) AS "$insert"
WHERE EXISTS (
	SELECT 1
	FROM (
		SELECT "$insert".*
	) AS "pilot"
	WHERE ${sql}
	AND "pilot"."id" IS NOT NULL AND "pilot"."id" = ?
)`,
					);
				});
				it('and updates', () => {
					sqlEquals(
						(result as SqlResult[])[1],
						`\
UPDATE "pilot"
SET "created at" = DEFAULT,
	"modified at" = DEFAULT,
	"id" = ?,
	"person" = DEFAULT,
	"is experienced" = DEFAULT,
	"name" = ?,
	"age" = DEFAULT,
	"favourite colour" = DEFAULT,
	"is on-team" = DEFAULT,
	"licence" = DEFAULT,
	"hire date" = DEFAULT,
	"was trained by-pilot" = DEFAULT
WHERE "pilot"."id" IS NOT NULL AND "pilot"."id" = ?
AND "pilot"."id" IN ((
	SELECT "pilot"."id" AS "$modifyid"
	FROM "pilot"
	WHERE ${sql}
))`,
					);
				});
			});
		},
	);
});

run(function () {
	const { odata: keyOdata, bindings: keyBindings } = parseOperand!(1);
	const { odata, bindings, sql } = createExpression(
		createExpression(1, 'eq', 1),
		'or',
		createExpression(1, 'eq', 1),
	);
	test(
		'/pilot(' + keyOdata + ')/can_fly__plane?$filter=' + odata,
		'GET',
		bindings.concat(keyBindings),
		(result, sqlEquals) => {
			it(
				'should select from pilot__can_fly__plane where "' + odata + '"',
				() => {
					sqlEquals(
						result,
						`\
SELECT ${aliasPilotCanFlyPlaneFieldsStr}
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
WHERE ${sql}
AND "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND "pilot"."id" IS NOT NULL AND "pilot"."id" = ?`,
					);
				},
			);
		},
	);
});

methodTest('contains', 'name', "'et'");
methodTest('endswith', 'name', "'ete'");
methodTest('startswith', 'name', "'P'");
run(() => {
	operandTest(createMethodCall('length', 'name'), 'eq', 4);
});

run(() => {
	operandTest(createMethodCall('indexof', 'name', "'Pe'"), 'eq', 0, {
		sql: '(STRPOS("pilot"."name", $1) - 1) IS NOT NULL AND (STRPOS("pilot"."name", $1) - 1) = $2',
	});
});
run(() => {
	operandTest(createMethodCall('substring', 'name', 1), 'eq', "'ete'", {
		sql: '(SUBSTRING("pilot"."name", $1 + 1)) IS NOT NULL AND (SUBSTRING("pilot"."name", $1 + 1)) = $2',
	});
});
run(() => {
	operandTest(createMethodCall('substring', 'name', 1, 2), 'eq', "'et'", {
		sql: '(SUBSTRING("pilot"."name", $1 + 1, $2)) IS NOT NULL AND (SUBSTRING("pilot"."name", $1 + 1, $2)) = $3',
	});
});
run(() => {
	operandTest(createMethodCall('tolower', 'name'), 'eq', "'pete'");
});
run(() => {
	operandTest(
		createMethodCall('tolower', 'trained__pilot/name'),
		'eq',
		"'pete'",
	);
});
run(() => {
	operandTest(createMethodCall('toupper', 'name'), 'eq', "'PETE'");
});
run(function () {
	const concat = createMethodCall('concat', 'name', "'%20'");
	operandTest(createMethodCall('trim', concat), 'eq', "'Pete'", {
		sql: '(TRIM(("pilot"."name" || $1))) IS NOT NULL AND (TRIM(("pilot"."name" || $1))) = $2',
	});
});
run(function () {
	const concat = createMethodCall('concat', 'name', "'%20'");
	operandTest(concat, 'eq', "'Pete%20'", {
		sql: '(("pilot"."name" || $1)) IS NOT NULL AND (("pilot"."name" || $1)) = $2',
	});
});
run(() => {
	operandTest(createMethodCall('year', 'hire_date'), 'eq', 2011);
});
run(() => {
	operandTest(createMethodCall('month', 'hire_date'), 'eq', 10);
});
run(() => {
	operandTest(createMethodCall('day', 'hire_date'), 'eq', 3);
});
run(() => {
	operandTest(createMethodCall('hour', 'hire_date'), 'eq', 12);
});
run(() => {
	operandTest(createMethodCall('minute', 'hire_date'), 'eq', 10);
});
run(() => {
	operandTest(createMethodCall('second', 'hire_date'), 'eq', 25);
});
run(() => {
	operandTest(createMethodCall('fractionalseconds', 'hire_date'), 'eq', 0.222);
});
run(() => {
	operandTest(createMethodCall('date', 'hire_date'), 'eq', "'2011-10-03'");
});
run(() => {
	operandTest(createMethodCall('time', 'hire_date'), 'eq', "'12:10:25.222'");
});
run(() => {
	operandTest(createMethodCall('now'), 'eq', new Date('2012-12-03T07:16:23Z'));
});
run(() => {
	operandTest(
		createMethodCall('totalseconds', {
			negative: true,
			day: 3,
			hour: 4,
			minute: 5,
			second: 6.7,
		}),
		'eq',
		-273906.7,
	);
});
run(() => {
	operandTest(createMethodCall('round', 'age'), 'eq', 25);
});
run(() => {
	operandTest(createMethodCall('floor', 'age'), 'eq', 25);
});
run(() => {
	operandTest(createMethodCall('ceiling', 'age'), 'eq', 25);
});

methodTest('substringof', "'Pete'", 'name');
run(() => {
	operandTest(
		createMethodCall('replace', 'name', "'ete'", "'at'"),
		'eq',
		"'Pat'",
		{
			sql: '(REPLACE("pilot"."name", $1, $2)) IS NOT NULL AND (REPLACE("pilot"."name", $1, $2)) = $3',
		},
	);
});

test(
	"/pilot?$filter=can_fly__plane/any(d:d/plane/name eq 'Concorde')",
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select from pilot where ...', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
)`,
			);
		});
	},
);

test(
	"/pilot/$count?$filter=can_fly__plane/any(d:d/plane/name eq 'Concorde')",
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where ...', () => {
			sqlEquals(
				result,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
WHERE EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
)`,
			);
		});
	},
);

test(
	"/pilot?$filter=can_fly__plane/any(d:d/plane/name eq 'Concorde') or (id eq 5 or id eq 10) or (name eq 'Peter' or name eq 'Harry')",
	'GET',
	[
		['Bind', 0],
		['Bind', 1],
		['Bind', 2],
		['Bind', 3],
		['Bind', 4],
	],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where id in (5,10)', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE (EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
)
OR "pilot"."id" IS NOT NULL AND "pilot"."id" = ?
OR "pilot"."id" IS NOT NULL AND "pilot"."id" = ?
OR "pilot"."name" IS NOT NULL AND "pilot"."name" = ?
OR "pilot"."name" IS NOT NULL AND "pilot"."name" = ?)`,
			);
		});
	},
);

test(
	"/pilot?$filter=not(can_fly__plane/any(d:d/plane/name eq 'Concorde') or (id eq 5 or id eq 10) or (name eq 'Peter' or name eq 'Harry'))",
	'GET',
	[
		['Bind', 0],
		['Bind', 1],
		['Bind', 2],
		['Bind', 3],
		['Bind', 4],
	],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where id in (5,10)', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE NOT (
	(EXISTS (
		SELECT 1
		FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
		LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
		WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
		AND "pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
	)
	OR "pilot"."id" IS NOT NULL AND "pilot"."id" = ?
	OR "pilot"."id" IS NOT NULL AND "pilot"."id" = ?
	OR "pilot"."name" IS NOT NULL AND "pilot"."name" = ?
	OR "pilot"."name" IS NOT NULL AND "pilot"."name" = ?)
)`,
			);
		});
	},
);

test(
	"/pilot?$filter=can_fly__plane/all(d:d/plane/name eq 'Concorde')",
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select from pilot where ...', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE NOT EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND NOT (
		"pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
	)
)`,
			);
		});
	},
);

test(
	"/pilot/$count?$filter=can_fly__plane/all(d:d/plane/name eq 'Concorde')",
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where ...', () => {
			sqlEquals(
				result,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
WHERE NOT EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND NOT (
		"pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
	)
)`,
			);
		});
	},
);

test(
	"/pilot?$filter=can_fly__plane/plane/any(d:d/name eq 'Concorde')",
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select from pilot where ...', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
WHERE EXISTS (
	SELECT 1
	FROM "plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND "pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
)`,
			);
		});
	},
);

test(
	"/pilot/$count?$filter=can_fly__plane/plane/any(d:d/name eq 'Concorde')",
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where ...', () => {
			sqlEquals(
				result,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
WHERE EXISTS (
	SELECT 1
	FROM "plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND "pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
)`,
			);
		});
	},
);

test(
	"/pilot?$filter=can_fly__plane/plane/all(d:d/name eq 'Concorde')",
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select from pilot where ...', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
WHERE NOT EXISTS (
	SELECT 1
	FROM "plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND NOT (
		"pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
	)
)`,
			);
		});
	},
);

test(
	"/pilot/$count?$filter=can_fly__plane/plane/all(d:d/name eq 'Concorde')",
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where ...', () => {
			sqlEquals(
				result,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
WHERE NOT EXISTS (
	SELECT 1
	FROM "plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND NOT (
		"pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
	)
)`,
			);
		});
	},
);

test(
	"/pilot?$filter=can_fly__plane/any(d:d/plane/name eq 'Concorde') or (id eq 5 or name eq 'Peter') or (id eq 10 or name eq 'Harry')",
	'GET',
	[
		['Bind', 0],
		['Bind', 1],
		['Bind', 2],
		['Bind', 3],
		['Bind', 4],
	],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where id in (5,10)', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE (EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
)
OR "pilot"."id" IS NOT NULL AND "pilot"."id" = ?
OR "pilot"."name" IS NOT NULL AND "pilot"."name" = ?
OR "pilot"."id" IS NOT NULL AND "pilot"."id" = ?
OR "pilot"."name" IS NOT NULL AND "pilot"."name" = ?)`,
			);
		});
	},
);

test(
	"/pilot?$filter=can_fly__plane/any(d:d/plane/name eq 'Concorde') and (id ne 5 and id ne 10) and (name ne 'Peter' and name ne 'Harry')",
	'GET',
	[
		['Bind', 0],
		['Bind', 1],
		['Bind', 2],
		['Bind', 3],
		['Bind', 4],
	],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where id in (5,10)', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
)
AND NOT("pilot"."id" IS NOT NULL AND "pilot"."id" = ?)
AND NOT("pilot"."id" IS NOT NULL AND "pilot"."id" = ?)
AND NOT("pilot"."name" IS NOT NULL AND "pilot"."name" = ?)
AND NOT("pilot"."name" IS NOT NULL AND "pilot"."name" = ?)`,
			);
		});
	},
);

test(
	"/pilot?$filter=can_fly__plane/any(d:d/plane/name eq 'Concorde') and (id ne 5 and name ne 'Peter') and (id ne 10 and name ne 'Harry')",
	'GET',
	[
		['Bind', 0],
		['Bind', 1],
		['Bind', 2],
		['Bind', 3],
		['Bind', 4],
	],
	(result, sqlEquals) => {
		it('should select count(*) from pilot where id in (5,10)', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
	LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane.plane"."name" IS NOT NULL AND "pilot.pilot-can fly-plane.plane"."name" = ?
)
AND NOT("pilot"."id" IS NOT NULL AND "pilot"."id" = ?)
AND NOT("pilot"."name" IS NOT NULL AND "pilot"."name" = ?)
AND NOT("pilot"."id" IS NOT NULL AND "pilot"."id" = ?)
AND NOT("pilot"."name" IS NOT NULL AND "pilot"."name" = ?)`,
			);
		});
	},
);

// Switch parseOperandFactory permanently to using 'team' as the resource,
// as we are switch to using that as our base resource from here on.
parseOperandFactory = _.partialRight(parseOperandFactory, 'team');
run(function () {
	const favouriteColour = 'purple';
	const { odata, sql, bindings } = createExpression(
		'favourite_colour',
		'eq',
		`'${favouriteColour}'`,
	);
	test(
		'/team?$filter=' + odata,
		'POST',
		[['Bind', ['team', 'favourite_colour']], ...bindings],
		{ favourite_colour: favouriteColour },
		(result, sqlEquals) => {
			it('should insert into team where "' + odata + '"', () => {
				sqlEquals(
					result,
					`\
INSERT INTO "team" ("favourite colour")
SELECT "$insert"."favourite colour"
FROM (
	SELECT CAST(NULL AS TIMESTAMPTZ) AS "created at", CAST(NULL AS TIMESTAMPTZ) AS "modified at", CAST(? AS INTEGER) AS "favourite colour"
) AS "$insert"
WHERE EXISTS (
	SELECT 1
	FROM (
		SELECT "$insert".*
	) AS "team"
	WHERE ${sql}
)`,
				);
			});
		},
	);
});

run(function () {
	const { odata, sql, bindings } = createExpression(
		'includes__pilot/can_fly__plane/plane/name',
		'eq',
		"'Concorde'",
	);
	test('/team?$filter=' + odata, 'GET', bindings, (result, sqlEquals) => {
		it('should select from team where "' + odata + '"', () => {
			sqlEquals(
				result,
				`\
SELECT ${teamFieldsStr}
FROM "team"
LEFT JOIN "pilot" AS "team.includes-pilot" ON "team"."favourite colour" = "team.includes-pilot"."is on-team"
LEFT JOIN "pilot-can fly-plane" AS "team.includes-pilot.pilot-can fly-plane" ON "team.includes-pilot"."id" = "team.includes-pilot.pilot-can fly-plane"."pilot"
LEFT JOIN "plane" AS "team.includes-pilot.pilot-can fly-plane.plane" ON "team.includes-pilot.pilot-can fly-plane"."can fly-plane" = "team.includes-pilot.pilot-can fly-plane.plane"."id"
WHERE ${sql}`,
			);
		});
	});
});

run(function () {
	const odata = "now() sub created_at lt duration'P1D'";
	test(`/pilot?$filter=${odata}`, 'GET', [], (result, sqlEquals) => {
		it('should select from pilot where "' + odata + '"', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE CURRENT_TIMESTAMP - DATE_TRUNC('milliseconds', "pilot"."created at", 'UTC') < INTERVAL '1 0:0:0.0'`,
			);
		});
	});
});

run(function () {
	const odata = 'now() add now()';
	test.fail(`/pilot?$filter=${odata}`, 'GET', [], (err) => {
		it(
			'should fail to add current_timestamp to current_timestamp where "' +
				odata +
				'"',
			() => {
				expect(err).to.be.instanceOf(Error);
			},
		);
	});
});

run(function () {
	const odata = "created_at add duration'P1D' gt now()";
	test(`/pilot?$filter=${odata}`, 'GET', [], (result, sqlEquals) => {
		it('should select from pilot where "' + odata + '"', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE DATE_TRUNC('milliseconds', "pilot"."created at", 'UTC') + INTERVAL '1 0:0:0.0' > CURRENT_TIMESTAMP`,
			);
		});
	});
});

run(function () {
	const odata = "totalseconds(duration'P1D') gt 1";
	test(`/pilot?$filter=${odata}`, 'GET', [['Bind', 0]], (result, sqlEquals) => {
		it('should select from pilot where "' + odata + '"', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE EXTRACT(EPOCH FROM INTERVAL '1 0:0:0.0') > $1`,
			);
		});
	});
});
