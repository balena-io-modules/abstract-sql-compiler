import { expect } from 'chai';
import * as AbstractSqlCompiler from '../../src/AbstractSQLCompiler';

describe('getRuleReferencedFields', () => {
	it('should work with single table NOT EXISTS', () => {
		expect(
			AbstractSqlCompiler.postgres.getRuleReferencedFields([
				'Not',
				[
					'Exists',
					[
						'SelectQuery',
						['Select', []],
						['From', ['Alias', ['Table', 'test'], 'test.0']],
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
			]),
		).to.deep.equal({
			test: {
				create: ['id'],
				update: ['id'],
				delete: [],
			},
		});
	});
	it('should work with single table COUNT(*) = 0', () => {
		expect(
			AbstractSqlCompiler.postgres.getRuleReferencedFields([
				'Equals',
				[
					'SelectQuery',
					['Select', [['Count', '*']]],
					['From', ['Alias', ['Table', 'test'], 'test.0']],
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
				['Number', 0],
			]),
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
										['ReferencedField', 'test.1', 'id'],
										['ReferencedField', 'test.0', 'id'],
									],
									['Exists', ['ReferencedField', 'test.0', 'id']],
								],
							],
						],
					],
				],
			]),
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
					['From', ['Alias', ['Table', 'test'], 'test.0']],
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
			]),
		).to.deep.equal({
			test: {
				create: [],
				update: ['id'],
				delete: ['id'],
			},
		});
	});

	it('should work with single table SELECT EXISTS for `Field`s', () => {
		expect(
			AbstractSqlCompiler.postgres.getRuleReferencedFields([
				'Exists',
				[
					'SelectQuery',
					['Select', []],
					['From', ['Alias', ['Table', 'test'], 'test.0']],
					[
						'Where',
						[
							'Not',
							[
								'And',
								['LessThan', ['Integer', 0], ['Field', 'id']],
								['Exists', ['Field', 'id']],
							],
						],
					],
				],
			]),
		).to.deep.equal({
			test: {
				create: [],
				update: ['id'],
				delete: ['id'],
			},
		});
	});

	it('should work with single table SELECT NOT EXISTS for COUNT(*)', () => {
		expect(
			AbstractSqlCompiler.postgres.getRuleReferencedFields([
				'NotExists',
				[
					'SelectQuery',
					['Select', [['Count', '*']]],
					['From', ['Table', 'test']],
				],
			]),
		).to.deep.equal({
			test: {
				create: [''],
				update: [''],
				delete: [],
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
						['From', ['Alias', ['Table', 'test'], 'test.0']],
						[
							'Where',
							[
								'Not',
								[
									'Exists',
									[
										'SelectQuery',
										['Select', []],
										['From', ['Alias', ['Table', 'test2'], 'test2.0']],
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
			]),
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

	it('should work with multiple FROMs for `Field`s', () => {
		expect(
			AbstractSqlCompiler.postgres.getRuleReferencedFields([
				'Not',
				[
					'Exists',
					[
						'SelectQuery',
						['Select', []],
						['From', ['Alias', ['Table', 'test'], 'test.0']],
						['From', ['Alias', ['Table', 'test2'], 'test2.0']],
						['Where', ['Equals', ['Field', 'id'], ['Field', 'test']]],
					],
				],
			]),
		).to.deep.equal({
			test: {
				// We assume any unreferenced field can come from any of the scoped tables
				create: ['id', 'test'],
				update: ['id', 'test'],
				delete: [],
			},
			test2: {
				create: ['id', 'test'],
				update: ['id', 'test'],
				delete: [],
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
						['From', ['Alias', ['Table', 'test'], 'test.0']],
						[
							'Where',
							[
								'Not',
								[
									'Exists',
									[
										'SelectQuery',
										['Select', [['Count', '*']]],
										['From', ['Alias', ['Table', 'test2'], 'test2.0']],
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
			]),
		).to.deep.equal({
			test: {
				create: ['id'],
				update: ['id'],
				delete: [],
			},
			test2: {
				create: [],
				update: ['', 'test'],
				delete: ['', 'test'],
			},
		});
	});

	it('HAVING clauses should not be subject to the operation typecheck optimization', () => {
		expect(
			AbstractSqlCompiler.postgres.getRuleReferencedFields([
				'NotExists',
				[
					'SelectQuery',
					['Select', []],
					['From', ['Table', 'test']],
					['GroupBy', [['ReferencedField', 'test', 'field']]],
					['Having', ['GreaterThanOrEqual', ['Count', '*'], ['Number', 2]]],
				],
			]),
		).to.deep.equal({
			test: {
				create: ['field', ''],
				update: ['field', ''],
				delete: [''],
			},
		});
	});
});
