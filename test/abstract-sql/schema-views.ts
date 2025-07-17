import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

it('a table with a static definition should not produce a view', () => {
	expect(
		AbstractSQLCompiler.postgres.compileSchema({
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
					],
					indexes: [],
					primitive: false,
					definition: { abstractSql: ['Table', 'other table'] },
				},
			},
			rules: [],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
);`,
		]);
});

it('a table with a view definition should produce a view', () => {
	expect(
		AbstractSQLCompiler.postgres.compileSchema({
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
					],
					indexes: [],
					primitive: false,
					viewDefinition: { abstractSql: ['Table', 'other table'] },
				},
			},
			rules: [],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE OR REPLACE VIEW "test" AS (
	SELECT *
	FROM "other table"
);`,
		]);
});
