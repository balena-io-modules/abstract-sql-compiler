import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

it('a table with a computed fn definition should produce a corresponding fn create statement', () => {
	const sqlModel = {
		synonyms: {},
		relationships: {},
		tables: {
			test: {
				name: 'test',
				resourceName: 'test',
				idField: 'id',
				fields: [
					{
						fieldName: 'id',
						dataType: 'Integer',
						index: 'PRIMARY KEY',
					},
					{
						fieldName: 'computed',
						dataType: 'Boolean',
						computed: {
							parallel: 'SAFE',
							volatility: 'IMMUTABLE',
							definition: ['Boolean', true],
						},
					},
				],
				indexes: [],
				primitive: false,
			},
		},
		rules: [],
		lfInfo: { rules: {} },
	} satisfies AbstractSQLCompiler.AbstractSqlModel;
	expect(AbstractSQLCompiler.postgres.compileSchema(sqlModel))
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
);`,
			`\
DO $$
BEGIN
	CREATE FUNCTION "fn_test_computed"("test" "test")
	RETURNS BOOLEAN AS $fn$
SELECT TRUE
	$fn$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
EXCEPTION WHEN duplicate_function THEN
	NULL;
END;
$$;`,
		]);
	expect(sqlModel)
		.have.property('tables')
		.that.has.property('test')
		.that.has.property('definition')
		.that.deep.equals({
			abstractSql: [
				'SelectQuery',
				[
					'Select',
					[
						['Field', '*'],
						[
							'Alias',
							['FnCall', 'fn_test_computed', ['ReferencedField', 'test', '*']],
							'computed',
						],
					],
				],
				['From', ['Table', 'test']],
			],
		});
});

describe('computed fn definitions', () => {
	const compileComputedFn = (
		definition: AbstractSQLCompiler.AnyTypeNodes,
	): string => {
		const { createSchema } = AbstractSQLCompiler.postgres.compileSchema({
			synonyms: {},
			relationships: {},
			tables: {
				test: {
					name: 'test',
					resourceName: 'test',
					idField: 'id',
					fields: [
						{
							fieldName: 'id',
							dataType: 'Integer',
							index: 'PRIMARY KEY',
						},
						{
							fieldName: 'computed',
							dataType: 'Integer',
							computed: {
								parallel: 'SAFE',
								volatility: 'IMMUTABLE',
								definition,
							},
						},
					],
					indexes: [],
					primitive: false,
				},
			},
			rules: [],
			lfInfo: { rules: {} },
		});
		return createSchema[1];
	};

	it('should omit the FROM for qualified field references so postgres can inline the fn', () => {
		expect(
			compileComputedFn([
				'Add',
				['ReferencedField', 'test', 'id'],
				['Number', 1],
			]),
		).to.equal(`\
DO $$
BEGIN
	CREATE FUNCTION "fn_test_computed"("test" "test")
	RETURNS INTEGER AS $fn$
SELECT "test"."id" + 1
	$fn$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
EXCEPTION WHEN duplicate_function THEN
	NULL;
END;
$$;`);
	});

	it('should alias the parameter as a table when there are unqualified field references', () => {
		expect(compileComputedFn(['Add', ['Field', 'id'], ['Number', 1]])).to
			.equal(`\
DO $$
BEGIN
	CREATE FUNCTION "fn_test_computed"("test" "test")
	RETURNS INTEGER AS $fn$
SELECT "id" + 1
FROM (
	SELECT "test".*
) AS "test"
	$fn$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
EXCEPTION WHEN duplicate_function THEN
	NULL;
END;
$$;`);
	});

	it('should alias the parameter as a table when there are unqualified field references in a subquery', () => {
		expect(
			compileComputedFn([
				'SelectQuery',
				['Select', [['Count', '*']]],
				['From', ['Alias', ['Table', 'other'], 'o']],
				[
					'Where',
					['Equals', ['ReferencedField', 'o', 'test'], ['Field', 'id']],
				],
			]),
		).to.equal(`\
DO $$
BEGIN
	CREATE FUNCTION "fn_test_computed"("test" "test")
	RETURNS INTEGER AS $fn$
SELECT (
	SELECT COUNT(*)
	FROM "other" AS "o"
	WHERE "o"."test" = "id"
)
FROM (
	SELECT "test".*
) AS "test"
	$fn$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;
EXCEPTION WHEN duplicate_function THEN
	NULL;
END;
$$;`);
	});
});
