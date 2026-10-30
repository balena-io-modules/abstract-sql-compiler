import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

const ruleSE = 'test rule';
const optimize = (ruleBody: AbstractSQLCompiler.AbstractSqlQuery) =>
	AbstractSQLCompiler.postgres.optimizeSchema({
		synonyms: {},
		relationships: {},
		tables: {
			test: {
				name: 'test',
				resourceName: 'test',
				idField: 'id',
				fields: [
					{ fieldName: 'id', dataType: 'Integer', index: 'PRIMARY KEY' },
					{ fieldName: 'amount', dataType: 'Integer' },
				],
				indexes: [],
				primitive: false,
			},
		},
		rules: [['Rule', ['Body', ruleBody], ['StructuredEnglish', ruleSE]]],
		lfInfo: { rules: {} },
	});

const expectRuleToBeKept = (ruleBody: AbstractSQLCompiler.AbstractSqlQuery) => {
	const model = optimize(ruleBody);
	expect(model.tables.test.checks).to.equal(undefined);
	expect(model.rules).to.have.length(1);
};

describe('converting rules to check constraints', () => {
	it('should keep a rule without a where as a rule', () => {
		expectRuleToBeKept([
			'NotExists',
			[
				'SelectQuery',
				['Select', []],
				['From', ['Alias', ['Table', 'test'], 'test.0']],
			],
		]);
	});

	it('should keep a `(SELECT ...) = 0` rule that does not select COUNT(*) as a rule', () => {
		expectRuleToBeKept([
			'Equals',
			[
				'SelectQuery',
				['Select', [['Sum', ['ReferencedField', 'test.0', 'amount']]]],
				['From', ['Alias', ['Table', 'test'], 'test.0']],
				[
					'Where',
					['GreaterThan', ['ReferencedField', 'test.0', 'id'], ['Number', 5]],
				],
			],
			['Number', 0],
		]);
	});

	it('should keep a rule whose condition contains a subquery as a rule', () => {
		expectRuleToBeKept([
			'NotExists',
			[
				'SelectQuery',
				['Select', []],
				['From', ['Alias', ['Table', 'test'], 'test.0']],
				[
					'Where',
					[
						'Exists',
						[
							'SelectQuery',
							['Select', [['Number', 1]]],
							[
								'Where',
								[
									'Equals',
									['ReferencedField', 'test.0', 'amount'],
									['Number', 1],
								],
							],
						],
					],
				],
			],
		]);
	});

	it('should still convert a `(SELECT COUNT(*) ...) = 0` rule', () => {
		const model = optimize([
			'Equals',
			[
				'SelectQuery',
				['Select', [['Count', '*']]],
				['From', ['Alias', ['Table', 'test'], 'test.0']],
				[
					'Where',
					[
						'GreaterThan',
						['ReferencedField', 'test.0', 'amount'],
						['Number', 5],
					],
				],
			],
			['Number', 0],
		]);
		expect(model.rules).to.have.length(0);
		expect(model.tables.test.checks)
			.to.have.length(1)
			.and.to.have.nested.property('[0].abstractSql')
			.that.deep.equals([
				'Not',
				['GreaterThan', ['Field', 'amount'], ['Number', 5]],
			]);
	});
});
