import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

type AbstractSqlQuery = AbstractSQLCompiler.AbstractSqlQuery;

const ruleSE = 'It is necessary that each pilot ...';
const generateModel = (
	ruleBody: AbstractSqlQuery,
): AbstractSQLCompiler.AbstractSqlModel => ({
	synonyms: {},
	relationships: {},
	tables: {
		pilot: {
			name: 'pilot',
			resourceName: 'pilot',
			idField: 'id',
			fields: [
				{
					fieldName: 'id',
					dataType: 'Serial',
					required: true,
					index: 'PRIMARY KEY',
				},
				{ fieldName: 'licence', dataType: 'Integer', required: true },
				{ fieldName: 'age', dataType: 'Integer', required: true },
			],
			indexes: [],
			primitive: false,
		},
		plane: {
			name: 'plane',
			resourceName: 'plane',
			idField: 'id',
			fields: [
				{
					fieldName: 'id',
					dataType: 'Serial',
					required: true,
					index: 'PRIMARY KEY',
				},
			],
			indexes: [],
			primitive: false,
		},
	},
	rules: [['Rule', ['Body', ruleBody], ['StructuredEnglish', ruleSE]]],
	lfInfo: {
		rules: { [ruleSE]: { root: { table: 'pilot', alias: 'pilot.0' } } },
	},
});
const compileRule = (
	ruleBody: AbstractSqlQuery,
	modifyModel?: (model: AbstractSQLCompiler.AbstractSqlModel) => void,
) => {
	const model = generateModel(ruleBody);
	modifyModel?.(model);
	const [rule] = AbstractSQLCompiler.postgres.compileSchema(model).rules;
	return rule;
};

const fromPilot: AbstractSqlQuery = [
	'From',
	['Alias', ['Table', 'pilot'], 'pilot.0'],
];
const isUnderage: AbstractSqlQuery = [
	'LessThan',
	['ReferencedField', 'pilot.0', 'age'],
	['Number', 18],
];
const noUnderagePilots: AbstractSqlQuery = [
	'NotExists',
	['SelectQuery', ['Select', []], fromPilot, ['Where', isUnderage]],
];

describe('rule narrowing', () => {
	describe('query forms', () => {
		it('should narrow rules that only select from tables with a where', () => {
			const rule = compileRule(noUnderagePilots);
			expect(rule.bindings).to.deep.equal([['Bind', 'pilot']]);
			expect(rule.sql).to.equal(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."age" < 18
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) AS "result";`);
		});

		it('should not narrow rules that group the rows', () => {
			// No licence is held by more than one pilot, which can only be seen by comparing
			// the affected pilots against all of the other pilots
			const rule = compileRule([
				'NotExists',
				[
					'SelectQuery',
					['Select', []],
					fromPilot,
					['GroupBy', [['ReferencedField', 'pilot.0', 'licence']]],
					['Having', ['GreaterThanOrEqual', ['Count', '*'], ['Number', 2]]],
				],
			]);
			expect(rule.bindings).to.deep.equal([]);
			expect(rule.sql).to.equal(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.0"
	GROUP BY "pilot.0"."licence"
	HAVING COUNT(*) >= 2
) AS "result";`);
		});

		it('should not narrow rules that skip rows', () => {
			// At most one pilot is underage
			const rule = compileRule([
				'NotExists',
				[
					'SelectQuery',
					['Select', []],
					fromPilot,
					['Where', isUnderage],
					['Offset', ['Number', 1]],
				],
			]);
			expect(rule.bindings).to.deep.equal([]);
			expect(rule.sql).to.equal(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."age" < 18
	OFFSET 1
) AS "result";`);
		});

		it('should not narrow rules that join', () => {
			// Joins are not narrowed since an outer join can add rows for which the table is null
			const rule = compileRule([
				'Equals',
				[
					'SelectQuery',
					['Select', [['Count', '*']]],
					fromPilot,
					['CrossJoin', ['Alias', ['Table', 'plane'], 'plane.1']],
					['Where', isUnderage],
				],
				['Number', 0],
			]);
			expect(rule.bindings).to.deep.equal([]);
			expect(rule.sql).to.equal(`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	CROSS JOIN "plane" AS "plane.1"
	WHERE "pilot.0"."age" < 18
) = 0 AS "result";`);
		});

		it('should not narrow rules that compare something other than a count of rows to 0', () => {
			// The ages of all of the pilots add up to 0
			const rule = compileRule([
				'Equals',
				[
					'SelectQuery',
					['Select', [['Sum', ['ReferencedField', 'pilot.0', 'age']]]],
					fromPilot,
				],
				['Number', 0],
			]);
			expect(rule.bindings).to.deep.equal([]);
			expect(rule.sql).to.equal(`\
SELECT (
	SELECT SUM("pilot.0"."age")
	FROM "pilot" AS "pilot.0"
) = 0 AS "result";`);
		});
	});

	describe('id fields', () => {
		const setPilotIdField =
			(fieldName: string, dataType: string) =>
			({ tables: { pilot } }: AbstractSQLCompiler.AbstractSqlModel) => {
				pilot.idField = fieldName;
				pilot.fields[0] = {
					fieldName,
					dataType,
					required: true,
					index: 'PRIMARY KEY',
				};
			};

		it('should narrow by the id field of the table', () => {
			const rule = compileRule(
				noUnderagePilots,
				setPilotIdField('badge number', 'Integer'),
			);
			expect(rule.bindings).to.deep.equal([['Bind', 'pilot']]);
			expect(rule.sql).to.equal(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."age" < 18
	AND ($1 = '{}'
	OR "pilot.0"."badge number" = ANY(CAST($1 AS INTEGER[])))
) AS "result";`);
		});

		it('should narrow by big integer ids without truncating them', () => {
			const rule = compileRule(
				noUnderagePilots,
				setPilotIdField('id', 'Big Serial'),
			);
			expect(rule.bindings).to.deep.equal([['Bind', 'pilot']]);
			expect(rule.sql).to.equal(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."age" < 18
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS BIGINT[])))
) AS "result";`);
		});

		it('should not narrow tables with an id field that is not an integer', () => {
			const rule = compileRule(
				noUnderagePilots,
				setPilotIdField('callsign', 'Short Text'),
			);
			expect(rule.bindings).to.deep.equal([]);
			expect(rule.sql).to.equal(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."age" < 18
) AS "result";`);
		});
	});
});
