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
FROM (
	SELECT "test".*
) AS "test"
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
