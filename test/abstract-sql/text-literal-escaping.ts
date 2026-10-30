import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';
import test from './test.ts';

describe('string literal escaping', () => {
	test(
		['SelectQuery', ['Select', [['EmbeddedText', "it's"]]]],
		(result, sqlEquals) => {
			it('should escape quotes in embedded text', () => {
				sqlEquals(result, "SELECT 'it''s'");
			});
		},
	);

	it('should escape quotes in text when binds are disabled, eg for a check generated from an enum definition', () => {
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
								fieldName: 'name',
								dataType: 'Short Text',
								checks: [
									[
										'In',
										['Field', 'name'],
										['Text', "O'Brien"],
										['Text', 'Smith'],
									],
								],
							},
						],
						indexes: [],
						primitive: false,
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
	"name" VARCHAR(255) NULL CHECK ("name" IN ('O''Brien', 'Smith'))
);`,
			]);
	});
});
