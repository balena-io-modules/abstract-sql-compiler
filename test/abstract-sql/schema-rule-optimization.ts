import * as AbstractSQLCompiler from '../..';
import { expect } from 'chai';

const generateSchema = (
	abstractSqlModel: AbstractSQLCompiler.AbstractSqlModel,
) => AbstractSQLCompiler.postgres.optimizeSchema(abstractSqlModel);

it('should convert a basic rule to a check', () => {
	expect(
		generateSchema({
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
				},
			},
			rules: [
				[
					'Rule',
					[
						'Body',
						[
							'Not',
							[
								'Exists',
								[
									'SelectQuery',
									['Select', []],
									['From', ['Alias', ['Table', 'test'], 'test.0']],
									['From', ['Alias', ['Table', 'test'], 'test.1']],
									[
										'Where',
										[
											'Not',
											[
												'And',
												[
													'And',
													[
														'LessThan',
														['Integer', 0],
														['ReferencedField', 'test.0', 'id'],
													],
													['Exists', ['ReferencedField', 'test.0', 'id']],
												],
												[
													'And',
													[
														'LessThan',
														['Integer', 0],
														['ReferencedField', 'test.1', 'id'],
													],
													['Exists', ['ReferencedField', 'test.1', 'id']],
												],
											],
										],
									],
								],
							],
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					['StructuredEnglish', 'Test rule abstract sql optimization'],
				],
			],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('rules')
		.that.deep.equals([
			[
				'Rule',
				[
					'Body',
					[
						'NotExists',
						[
							'SelectQuery',
							['Select', []],
							['From', ['Alias', ['Table', 'test'], 'test.0']],
							['From', ['Alias', ['Table', 'test'], 'test.1']],
							[
								'Where',
								[
									'Not',
									[
										'And',
										[
											'LessThan',
											['Integer', 0],
											['ReferencedField', 'test.0', 'id'],
										],
										['Exists', ['ReferencedField', 'test.0', 'id']],
										[
											'LessThan',
											['Integer', 0],
											['ReferencedField', 'test.1', 'id'],
										],
										['Exists', ['ReferencedField', 'test.1', 'id']],
									],
								],
							],
						],
					],
				] as AbstractSQLCompiler.AbstractSqlQuery,
				['StructuredEnglish', 'Test rule abstract sql optimization'],
			],
		]);
});
