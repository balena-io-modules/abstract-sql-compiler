import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

describe('drop schema', () => {
	it('should drop triggers and circular foreign keys before the tables', () => {
		const { dropSchema } = AbstractSQLCompiler.postgres.compileSchema({
			synonyms: {},
			relationships: {},
			functions: {
				set_modified: {
					type: 'trigger',
					body: 'RETURN NEW;',
					language: 'plpgsql',
				},
			},
			tables: {
				a: {
					name: 'a',
					resourceName: 'a',
					idField: 'id',
					fields: [
						{
							fieldName: 'id',
							dataType: 'Serial',
							required: true,
							index: 'PRIMARY KEY',
						},
						{
							fieldName: 'b',
							dataType: 'ForeignKey',
							references: { resourceName: 'b', fieldName: 'id' },
						},
					],
					indexes: [],
					primitive: false,
					triggers: [
						{
							operation: 'UPDATE',
							fnName: 'set_modified',
							level: 'ROW',
							when: 'BEFORE',
						},
					],
				},
				b: {
					name: 'b',
					resourceName: 'b',
					idField: 'id',
					fields: [
						{
							fieldName: 'id',
							dataType: 'Serial',
							required: true,
							index: 'PRIMARY KEY',
						},
						{
							fieldName: 'a',
							dataType: 'ForeignKey',
							references: { resourceName: 'a', fieldName: 'id' },
						},
					],
					indexes: [],
					primitive: false,
				},
			},
			rules: [],
			lfInfo: { rules: {} },
		});
		expect(dropSchema).to.deep.equal([
			'ALTER TABLE "b" DROP CONSTRAINT IF EXISTS "b_a_fkey";',
			'DROP TRIGGER "a_set_modified" ON "a";',
			'DROP TABLE "a";',
			'DROP TABLE "b";',
			'DROP FUNCTION "set_modified"();',
		]);
	});
});
