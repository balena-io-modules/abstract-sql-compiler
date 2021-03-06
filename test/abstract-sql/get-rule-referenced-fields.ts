import { expect } from 'chai';
import * as AbstractSqlCompiler from '../../src/AbstractSQLCompiler';

describe('getRuleReferencedFields', () => {
	it('should work with single table SELECT NOT EXISTS', () => {
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

	it('should work with multi table SELECT NOT EXISTS', () => {
		expect(
			AbstractSqlCompiler.postgres.getRuleReferencedFields([
				'Not',
				[
					'Exists',
					[
						'SelectQuery',
						['Select', []],
						['From', ['test', 'test.0']],
						['From', ['test', 'test.1']],
						[
							'Where',
							[
								'Not',
								[
									'And',
									[
										'LessThan',
										['ReferencedField', 'test.1', 'id'],
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

	it('should work with single table SELECT EXISTS', () => {
		expect(
			AbstractSqlCompiler.postgres.getRuleReferencedFields([
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
			] as AbstractSqlCompiler.AbstractSqlQuery),
		).to.deep.equal({
			test: {
				create: [],
				update: ['id'],
				delete: ['id'],
			},
		});
	});

	it('should work with nested NOT EXISTS', () => {
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
									'Exists',
									[
										'SelectQuery',
										['Select', []],
										['From', ['test2', 'test2.0']],
										[
											'Where',
											[
												'Equals',
												['ReferencedField', 'test.0', 'id'],
												['ReferencedField', 'test2.0', 'test'],
											],
										],
									],
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
			test2: {
				create: [],
				update: ['test'],
				delete: ['test'],
			},
		});
	});
});
