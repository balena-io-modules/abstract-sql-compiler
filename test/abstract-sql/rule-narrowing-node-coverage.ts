import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

const ruleSE =
	'It is necessary that each pilot has an age that is greater than 1';
const generateModel = (
	ruleBody: AbstractSQLCompiler.AbstractSqlQuery,
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
				{ fieldName: 'age', dataType: 'Integer', required: true },
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

describe('rule narrowing node coverage', () => {
	it('should narrow rules containing nodes that are not explicitly handled', () => {
		const [rule] = AbstractSQLCompiler.postgres.compileSchema(
			generateModel([
				'NotExists',
				[
					'SelectQuery',
					['Select', []],
					['From', ['Alias', ['Table', 'pilot'], 'pilot.0']],
					[
						'Where',
						[
							'Not',
							[
								'GreaterThan',
								['Add', ['ReferencedField', 'pilot.0', 'age'], ['Real', 0.5]],
								['Number', 1],
							],
						],
					],
				],
			]),
		).rules;
		expect(rule.bindings).to.deep.equal([['Bind', 'pilot']]);
		expect(rule.sql).to.equal(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.0"
	WHERE NOT (
		"pilot.0"."age" + 0.5 > 1
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) AS "result";`);
	});

	it('should count selects of the root table nested in nodes that are not explicitly handled', () => {
		const [rule] = AbstractSQLCompiler.postgres.compileSchema(
			generateModel([
				'NotExists',
				[
					'SelectQuery',
					['Select', []],
					['From', ['Alias', ['Table', 'pilot'], 'pilot.0']],
					[
						'Where',
						[
							'GreaterThan',
							[
								'Coalesce',
								[
									'SelectQuery',
									['Select', [['Count', '*']]],
									['From', ['Alias', ['Table', 'pilot'], 'pilot.1']],
								],
								['Number', 0],
							],
							['Number', 5],
						],
					],
				],
			]),
		).rules;
		// The root table is selected from twice so the rule must not be narrowed
		expect(rule.bindings).to.deep.equal([]);
		expect(rule.sql).to.not.include('ANY(');
	});
});
