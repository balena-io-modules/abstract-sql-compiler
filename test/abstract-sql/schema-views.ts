import * as AbstractSQLCompiler from '../..';
import { expect } from 'chai';

it('a table with a static definition should produce a view', () => {
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
CREATE OR REPLACE VIEW "test" AS (
	SELECT *
	FROM "other table"
);`,
		]);
});
