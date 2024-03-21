/*
 * decaffeinate suggestions:
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { expect } from 'chai';
import test, { clientModel } from './test';
import * as _ from 'lodash';
import { odataNameToSqlName } from '@balena/odata-to-abstract-sql';
import { pilotFields, teamFields, aliasPilotCanFlyPlaneFields } from './fields';

const pilotFieldsStr = pilotFields.join(', ');
const aliasPilotCanFlyPlaneFieldsStr = aliasPilotCanFlyPlaneFields.join(', ');
const teamFieldsStr = teamFields.join(', ');

let parseOperandFactory = function (defaultResource) {
	if (defaultResource == null) {
		defaultResource = 'pilot';
	}
	let bindNo = 0;
	const operandToOData = function (operand) {
		if (operand.odata != null) {
			return operand.odata;
		}
		if (_.isDate(operand)) {
			return "datetime'" + encodeURIComponent(operand.toISOString()) + "'";
		}
		if (operand != null && typeof operand === 'object') {
			const duration = [];
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

	const operandToBindings = function (operand) {
		if (operand.bindings != null) {
			return operand.bindings;
		}
		if (
			typeof operand === 'boolean' ||
			typeof operand === 'number' ||
			_.isDate(operand) ||
			(typeof operand === 'string' && operand.charAt(0) === "'")
		) {
			return [['Bind', bindNo++]];
		}
		return [];
	};

	const operandToSQL = function (operand, resource) {
		if (resource == null) {
			resource = defaultResource;
		}
		if (operand.sql != null) {
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
			if (operand.charAt(0) === "'") {
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
			const day = operand.day || 0;
			const hour = operand.hour || 0;
			const minute = operand.minute || 0;
			const second = operand.second || 0;
			return `INTERVAL '${sign}${day} ${sign}${hour}:${minute}:${second}'`;
		}
		throw new Error('Unknown operand type: ' + operand);
	};

	return (operand) => ({
		sql: operandToSQL(operand),
		bindings: operandToBindings(operand),
		odata: operandToOData(operand),
	});
};

let parseOperand = null;
const run = (function () {
	let running = false;
	return function (fn) {
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

const createExpression = function (lhs, op, rhs) {
	let sql;
	if (lhs === 'not') {
		op = parseOperand(op);
		return {
			odata: 'not(' + op.odata + ')',
			sql: 'NOT (\n\t' + op.sql + '\n)',
			bindings: op.bindings,
		};
	}
	if (rhs == null) {
		lhs = parseOperand(lhs);
		return {
			odata: '(' + lhs.odata + ')',
			sql: lhs.sql,
			bindings: lhs.bindings,
		};
	}
	lhs = parseOperand(lhs);
	rhs = parseOperand(rhs);
	const bindings = lhs.bindings.concat(rhs.bindings);
	if (['eq', 'ne'].includes(op)) {
		if ([lhs.sql, rhs.sql].includes('NULL')) {
			const nullCheck = op === 'eq' ? ' IS NULL' : ' IS NOT NULL';
			if (lhs.sql === 'NULL') {
				sql = rhs.sql + nullCheck;
			} else {
				sql = lhs.sql + nullCheck;
			}
		} else {
			const nullCheck = ' IS NOT NULL';
			const lhsNullCheck =
				lhs.sql === '?' ? '' : `(${lhs.sql})${nullCheck} AND `;
			const rhsNullCheck =
				rhs.sql === '?' ? '' : `(${rhs.sql})${nullCheck} AND `;
			const bothNullCheck =
				lhsNullCheck.length > 0 && rhsNullCheck.length > 0
					? ` OR (${lhs.sql}) IS NULL AND (${rhs.sql}) IS NULL`
					: '';

			if (lhsNullCheck.length > 0 || rhsNullCheck.length > 0) {
				if (op === 'ne') {
					const mainCheck = `(${lhs.sql})${sqlOps.eq} (${rhs.sql})`;
					sql = `NOT(${lhsNullCheck}${rhsNullCheck}${mainCheck}${bothNullCheck})`;
				} else {
					const mainCheck = `(${lhs.sql})${sqlOps[op]} (${rhs.sql})`;
					sql = `${lhsNullCheck}${rhsNullCheck}${mainCheck}${bothNullCheck}`;
				}
			} else {
				const mainCheck = `${lhs.sql}${sqlOps[op]} ${rhs.sql}`;
				sql = `${lhsNullCheck}${rhsNullCheck}${mainCheck}${bothNullCheck}`;
			}
		}
	} else {
		sql = `${lhs.sql}${sqlOps[op]} ${rhs.sql}`;
	}

	if (sqlOpBrackets[op]) {
		sql = '(' + sql + ')';
	}
	return {
		odata: lhs.odata + ' ' + op + ' ' + rhs.odata,
		sql,
		bindings,
	};
};
const createMethodCall = function (method, ...args) {
	args = args.map((arg) => parseOperand(arg));
	const odata = method + '(' + args.map((arg) => arg.odata).join(',') + ')';
	method = method.toUpperCase();
	switch (method) {
		case 'CONTAINS':
		case 'SUBSTRINGOF':
			if (method === 'SUBSTRINGOF') {
				args.reverse();
			}
			return {
				sql: `${args[0].sql} LIKE ('%' || REPLACE(REPLACE(REPLACE(${args[1].sql}, '\\', '\\\\'), '_', '\\_'), '%', '\\%') || '%')`,
				bindings: [...args[0].bindings, ...args[1].bindings],
				odata,
			};
		case 'STARTSWITH':
			return {
				sql: `STARTS_WITH(${args[0].sql}, ${args[1].sql})`,
				bindings: [...args[0].bindings, ...args[1].bindings],
				odata,
			};
		case 'ENDSWITH':
			return {
				sql: `${args[0].sql} LIKE ('%' || REPLACE(REPLACE(REPLACE(${args[1].sql}, '\\', '\\\\'), '_', '\\_'), '%', '\\%'))`,
				bindings: [...args[0].bindings, ...args[1].bindings],
				odata,
			};
		case 'CONCAT':
			return {
				sql: '(' + args.map((arg) => arg.sql).join(' || ') + ')',
				bindings: _.flatten(args.map((arg) => arg.bindings)),
				odata,
			};
		case 'INDEXOF':
			return {
				sql: 'STRPOS(' + args.map((arg) => arg.sql).join(', ') + ') - 1',
				bindings: _.flatten(args.map((arg) => arg.bindings)),
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
				sql: `EXTRACT('${method}' FROM DATE_TRUNC('milliseconds', ${args[0].sql}))`,
				bindings: args[0].bindings,
				odata,
			};
		case 'SECOND':
			return {
				sql: `FLOOR(EXTRACT('${method}' FROM DATE_TRUNC('milliseconds', ${args[0].sql})))`,
				bindings: args[0].bindings,
				odata,
			};
		case 'FRACTIONALSECONDS':
			return {
				sql: `EXTRACT('SECOND' FROM DATE_TRUNC('milliseconds', ${args[0].sql})) - FLOOR(EXTRACT('SECOND' FROM DATE_TRUNC('milliseconds', ${args[0].sql})))`,
				bindings: args[0].bindings,
				odata,
			};
		case 'TIME':
			return {
				sql: `CAST(DATE_TRUNC('milliseconds', ${args[0].sql}) AS ${method})`,
				bindings: args[0].bindings,
				odata,
			};
		case 'TOTALSECONDS':
			return {
				sql: `EXTRACT(EPOCH FROM ${args[0].sql})`,
				bindings: args[0].bindings,
				odata,
			};
		case 'DATE':
			return {
				sql: `DATE(DATE_TRUNC('milliseconds', ${args[0].sql}))`,
				bindings: args[0].bindings,
				odata,
			};
		default: {
			if (Object.prototype.hasOwnProperty.call(methodMaps, method)) {
				method = methodMaps[method];
			}
			switch (method) {
				case 'SUBSTRING':
					args[1].sql += ' + 1';
					break;
			}
			const sql = method + '(' + args.map((arg) => arg.sql).join(', ') + ')';
			return {
				sql,
				bindings: _.flatten(args.map((arg) => arg.bindings)),
				odata,
			};
		}
	}
};

const operandTest = (lhs, op, rhs, override) => {
	run(function () {
		let from;
		let where;
		let { odata, sql, bindings } = createExpression(lhs, op, rhs);
		bindings = override?.bindings ?? bindings;
		sql = override?.sql ?? sql;
		if (_.includes(odata, '/')) {
			from = `\
"pilot",
	"pilot" AS "pilot.trained-pilot"`;
			where =
				`\
"pilot"."id" = "pilot.trained-pilot"."was trained by-pilot"
AND ` + sql;
		} else {
			from = '"pilot"';
			where = sql;
		}

		test(`/pilot?$filter=${odata}`, 'GET', bindings, (result, sqlEquals) => {
			it('should select from pilot where "' + odata + '"', () => {
				sqlEquals(
					result.query,
					`\
SELECT ${pilotFieldsStr}
FROM ${from}
WHERE ${where}`,
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
						result.query,
						`\
SELECT COUNT(*) AS "$count"
FROM ${from}
WHERE ${where}`,
					);
				});
			},
		);
	});
};

const methodTest = (...args) => {
	run(function () {
		const { odata, sql, bindings } = createMethodCall(...args);
		test(`/pilot?$filter=${odata}`, 'GET', bindings, (result, sqlEquals) => {
			it('should select from pilot where "' + odata + '"', () => {
				sqlEquals(
					result.query,
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
						result.query,
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
					result.query,
					`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE ("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?)`,
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
					result.query,
					`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE (("pilot"."name") IS NOT NULL AND ("pilot"."name") = ($1)
OR ("pilot"."favourite colour") IS NOT NULL AND ("pilot"."favourite colour") = ($1))`,
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND ${sql}`,
			);
		});
	});
});

run(function () {
	const { odata: keyOdata, bindings: keyBindings } = parseOperand(1);
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
						result.query,
						`\
SELECT ${aliasPilotCanFlyPlaneFieldsStr}
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
	"plane" AS "pilot.pilot-can fly-plane.can fly-plane"
WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.can fly-plane"."id"
AND ("pilot.pilot-can fly-plane.can fly-plane"."id") IS NOT NULL AND ("pilot.pilot-can fly-plane.can fly-plane"."id") = (?)
AND "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
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
	const bodyBindings = [['Bind', ['pilot', 'name']]].concat(bindings);
	const filterWhere = [
		'WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"',
		'AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"',
		`AND ${sql}`,
	];
	const insertTest = (result, sqlEquals) => {
		sqlEquals(
			result.query,
			`\
INSERT INTO "pilot" ("name")
SELECT "$insert"."name"
FROM (
	SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(NULL AS TIMESTAMP) AS "modified at", CAST(NULL AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS BOOLEAN) AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMP) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
) AS "$insert"
WHERE EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane",
		(
		SELECT "$insert".*
	) AS "pilot"
	${filterWhere.join('\n\t')}
)`,
		);
	};
	const updateWhere = `\
WHERE "pilot"."id" IN ((
	SELECT "pilot"."id"
	FROM "pilot",
		"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	${filterWhere.join('\n\t')}
))`;

	test(`/pilot?$filter=${odata}`, 'GET', bindings, (result, sqlEquals) => {
		it(`should select from pilot where '${odata}'`, () => {
			sqlEquals(
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
	"plane" AS "pilot.pilot-can fly-plane.plane"
${filterWhere.join('\n')}`,
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
					result.query,
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
					insertTest(result[0], sqlEquals);
				});
				it('and updates', () => {
					sqlEquals(
						result[1].query,
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
				result.query,
				`\
DELETE FROM "pilot"
WHERE "pilot"."id" IN ((
	SELECT "pilot"."id"
	FROM "pilot",
		"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	${filterWhere.join('\n\t')}
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
	const bindings = [['Bind', ['pilot', 'name']], ...exprBindings];
	test(
		`/pilot?$filter=${odata}`,
		'POST',
		bindings,
		{ name },
		(result, sqlEquals) => {
			it(`should insert into pilot where '${odata}'`, () => {
				sqlEquals(
					result.query,
					`\
INSERT INTO "pilot" ("name")
SELECT "$insert"."name"
FROM (
	SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(NULL AS TIMESTAMP) AS "modified at", CAST(NULL AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS BOOLEAN) AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMP) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
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
	const { odata: keyOdata, bindings: keyBindings } = parseOperand(1);
	const {
		odata,
		sql,
		bindings: exprBindings,
	} = createExpression('name', 'eq', `'${name}'`);
	const bodyBindings = [['Bind', ['pilot', 'name']]];
	const insertBindings = [
		['Bind', ['pilot', 'id']],
		...bodyBindings,
		...exprBindings,
		...keyBindings,
	];
	const updateBindings = [...bodyBindings, ...keyBindings, ...exprBindings];
	test(
		'/pilot(' + keyOdata + ')?$filter=' + odata,
		'PATCH',
		updateBindings,
		{ name },
		(result, sqlEquals) => {
			it('should update the pilot with id 1', () => {
				sqlEquals(
					result.query,
					`\
UPDATE "pilot"
SET "name" = ?
WHERE ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
AND "pilot"."id" IN ((
	SELECT "pilot"."id"
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
						result[0].query,
						`\
INSERT INTO "pilot" ("id", "name")
SELECT "$insert"."id", "$insert"."name"
FROM (
	SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(NULL AS TIMESTAMP) AS "modified at", CAST(? AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS BOOLEAN) AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMP) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
) AS "$insert"
WHERE EXISTS (
	SELECT 1
	FROM (
		SELECT "$insert".*
	) AS "pilot"
	WHERE ${sql}
	AND ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
)`,
					);
				});
				it('and updates', () => {
					sqlEquals(
						result[1].query,
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
WHERE ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
AND "pilot"."id" IN ((
	SELECT "pilot"."id"
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
	const { odata: keyOdata, bindings: keyBindings } = parseOperand(1);
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
						result.query,
						`\
SELECT ${aliasPilotCanFlyPlaneFieldsStr}
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
WHERE ${sql}
AND "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)`,
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
		sql: '(STRPOS("pilot"."name", $1) - 1) IS NOT NULL AND (STRPOS("pilot"."name", $1) - 1) = ($2)',
	});
});
run(() => {
	operandTest(createMethodCall('substring', 'name', 1), 'eq', "'ete'", {
		sql: '(SUBSTRING("pilot"."name", $1 + 1)) IS NOT NULL AND (SUBSTRING("pilot"."name", $1 + 1)) = ($2)',
	});
});
run(() => {
	operandTest(createMethodCall('substring', 'name', 1, 2), 'eq', "'et'", {
		sql: '(SUBSTRING("pilot"."name", $1 + 1, $2)) IS NOT NULL AND (SUBSTRING("pilot"."name", $1 + 1, $2)) = ($3)',
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
		sql: '(TRIM(("pilot"."name" || $1))) IS NOT NULL AND (TRIM(("pilot"."name" || $1))) = ($2)',
	});
});
run(function () {
	const concat = createMethodCall('concat', 'name', "'%20'");
	operandTest(concat, 'eq', "'Pete%20'", {
		sql: '(("pilot"."name" || $1)) IS NOT NULL AND (("pilot"."name" || $1)) = ($2)',
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
			sql: '(REPLACE("pilot"."name", $1, $2)) IS NOT NULL AND (REPLACE("pilot"."name", $1, $2)) = ($3)',
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND ("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
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
				result.query,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
WHERE EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND ("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE (EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND ("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
)
OR ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
OR ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
OR ("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?)
OR ("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?))`,
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE NOT (
	(EXISTS (
		SELECT 1
		FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
			"plane" AS "pilot.pilot-can fly-plane.plane"
		WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
		AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
		AND ("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
	)
	OR ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
	OR ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
	OR ("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?)
	OR ("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?))
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE NOT EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND NOT (
		("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
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
				result.query,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot"
WHERE NOT EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND NOT (
		("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND EXISTS (
	SELECT 1
	FROM "plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND ("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
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
				result.query,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND EXISTS (
	SELECT 1
	FROM "plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND ("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND NOT EXISTS (
	SELECT 1
	FROM "plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND NOT (
		("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
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
				result.query,
				`\
SELECT COUNT(*) AS "$count"
FROM "pilot",
	"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
AND NOT EXISTS (
	SELECT 1
	FROM "plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND NOT (
		("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE (EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND ("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
)
OR ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
OR ("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?)
OR ("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?)
OR ("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?))`,
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND ("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
)
AND NOT(("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?))
AND NOT(("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?))
AND NOT(("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?))
AND NOT(("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?))`,
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE EXISTS (
	SELECT 1
	FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
		"plane" AS "pilot.pilot-can fly-plane.plane"
	WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
	AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
	AND ("pilot.pilot-can fly-plane.plane"."name") IS NOT NULL AND ("pilot.pilot-can fly-plane.plane"."name") = (?)
)
AND NOT(("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?))
AND NOT(("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?))
AND NOT(("pilot"."id") IS NOT NULL AND ("pilot"."id") = (?))
AND NOT(("pilot"."name") IS NOT NULL AND ("pilot"."name") = (?))`,
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
		[['Bind', ['team', 'favourite_colour']]].concat(bindings),
		{ favourite_colour: favouriteColour },
		(result, sqlEquals) => {
			it('should insert into team where "' + odata + '"', () => {
				sqlEquals(
					result.query,
					`\
INSERT INTO "team" ("favourite colour")
SELECT "$insert"."favourite colour"
FROM (
	SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(NULL AS TIMESTAMP) AS "modified at", CAST(? AS INTEGER) AS "favourite colour"
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
				result.query,
				`\
SELECT ${teamFieldsStr}
FROM "team",
	"pilot" AS "team.includes-pilot",
	"pilot-can fly-plane" AS "team.includes-pilot.pilot-can fly-plane",
	"plane" AS "team.includes-pilot.pilot-can fly-plane.plane"
WHERE "team"."favourite colour" = "team.includes-pilot"."is on-team"
AND "team.includes-pilot"."id" = "team.includes-pilot.pilot-can fly-plane"."pilot"
AND "team.includes-pilot.pilot-can fly-plane"."can fly-plane" = "team.includes-pilot.pilot-can fly-plane.plane"."id"
AND ${sql}`,
			);
		});
	});
});

run(function () {
	const odata = "now() sub created_at lt duration'P1D'";
	test(`/pilot?$filter=${odata}`, 'GET', [], (result, sqlEquals) => {
		it('should select from pilot where "' + odata + '"', () => {
			sqlEquals(
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE CURRENT_TIMESTAMP - DATE_TRUNC('milliseconds', "pilot"."created at") < INTERVAL '1 0:0:0.0'`,
			);
		});
	});
});

run(function () {
	const odata = 'now() add now()';
	test(`/pilot?$filter=${odata}`, 'GET', [], (result, sqlEquals) => {
		it(
			'should fail to add current_timestamp to current_timestamp where "' +
				odata +
				'"',
			() => {
				expect(result).to.be.empty;
				expect(sqlEquals).to.be.undefined;
			},
		);
	});
});

run(function () {
	const odata = "created_at add duration'P1D' gt now()";
	test(`/pilot?$filter=${odata}`, 'GET', [], (result, sqlEquals) => {
		it('should select from pilot where "' + odata + '"', () => {
			sqlEquals(
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE DATE_TRUNC('milliseconds', "pilot"."created at") + INTERVAL '1 0:0:0.0' > CURRENT_TIMESTAMP`,
			);
		});
	});
});

run(function () {
	const odata = "totalseconds(duration'P1D') gt 1";
	test(`/pilot?$filter=${odata}`, 'GET', [['Bind', 0]], (result, sqlEquals) => {
		it('should select from pilot where "' + odata + '"', () => {
			sqlEquals(
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE EXTRACT(EPOCH FROM INTERVAL '1 0:0:0.0') > $1`,
			);
		});
	});
});
