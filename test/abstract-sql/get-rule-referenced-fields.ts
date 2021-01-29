import { expect } from 'chai';
import * as AbstractSqlCompiler from '../../src/AbstractSQLCompiler';

describe('getReferencedFields', () => {
	it('should work with selected fields', () => {
		expect(
			AbstractSqlCompiler.postgres.getRuleReferencedFields([
				'Not',
				[
					'Exists',
					[
						'SelectQuery',
						['Select', []],
						['From', ['test', 'test.0']],
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
								],
							],
						],
					],
				],
			] as AbstractSqlCompiler.AbstractSqlQuery),
		).to.deep.equal({
			test: {
				create: ['id'],
				update: ['id'],
				delete: [],
			},
		});
	});
});
