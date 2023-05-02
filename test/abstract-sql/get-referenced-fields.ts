import { expect } from 'chai';
import * as AbstractSqlCompiler from '../../src/AbstractSQLCompiler';

describe('getReferencedFields', () => {
	it('should work with selected fields', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'table', 'field2'],
					],
				],
				['From', ['Table', 'table']],
			]),
		).to.deep.equal({ table: ['field1', 'field2'] });
	});

	it('should work with filtered fields', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				['Select', []],
				['From', ['Table', 'table']],
				[
					'Where',
					[
						'Equals',
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'table', 'field2'],
					],
				],
			]),
		).to.deep.equal({ table: ['field1', 'field2'] });
	});

	it('should work with selected fields from an aliased table', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'atable', 'field1'],
						['ReferencedField', 'atable', 'field2'],
					],
				],
				['From', ['Alias', ['Table', 'table'], 'atable']],
			]),
		).to.deep.equal({
			table: ['field1', 'field2'],
		});
	});

	it('should work with filtered fields from an aliased table', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				['Select', []],
				['From', ['Alias', ['Table', 'table'], 'atable']],
				[
					'Where',
					[
						'Equals',
						['ReferencedField', 'atable', 'field1'],
						['ReferencedField', 'atable', 'field2'],
					],
				],
			]),
		).to.deep.equal({
			table: ['field1', 'field2'],
		});
	});

	it('should work with selected fields from multiple tables', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'table2', 'field2'],
					],
				],
				['From', ['Table', 'table']],
				['From', ['Table', 'table2']],
			]),
		).to.deep.equal({ table: ['field1'], table2: ['field2'] });
	});

	it('should work with filtered fields', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				['Select', []],
				['From', ['Table', 'table']],
				['From', ['Table', 'table2']],
				[
					'Where',
					[
						'Equals',
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'table2', 'field2'],
					],
				],
			]),
		).to.deep.equal({ table: ['field1'], table2: ['field2'] });
	});

	it('should work with selected fields from multiple aliased tables', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'atable', 'field1'],
						['ReferencedField', 'atable2', 'field2'],
					],
				],
				['From', ['Alias', ['Table', 'table'], 'atable']],
				['From', ['Alias', ['Table', 'table2'], 'atable2']],
			]),
		).to.deep.equal({
			table: ['field1'],
			table2: ['field2'],
		});
	});

	it('should work with filtered fields from multiple aliased tables', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				['Select', []],
				['From', ['Alias', ['Table', 'table'], 'atable']],
				['From', ['Alias', ['Table', 'table2'], 'atable2']],
				[
					'Where',
					[
						'Equals',
						['ReferencedField', 'atable', 'field1'],
						['ReferencedField', 'atable2', 'field2'],
					],
				],
			]),
		).to.deep.equal({
			table: ['field1'],
			table2: ['field2'],
		});
	});

	it('should work with selected fields from a table with multiple aliases', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'atable', 'field1'],
						['ReferencedField', 'atable2', 'field2'],
					],
				],
				['From', ['Alias', ['Table', 'table'], 'atable']],
				['From', ['Alias', ['Table', 'table'], 'atable2']],
			]),
		).to.deep.equal({
			table: ['field1', 'field2'],
		});
	});

	it('should work with filtered fields from multiple aliased tables', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				['Select', []],
				['From', ['Alias', ['Table', 'table'], 'atable']],
				['From', ['Alias', ['Table', 'table'], 'atable2']],
				[
					'Where',
					[
						'Equals',
						['ReferencedField', 'atable', 'field1'],
						['ReferencedField', 'atable2', 'field2'],
					],
				],
			]),
		).to.deep.equal({
			table: ['field1', 'field2'],
		});
	});

	it('should work with selected and filtered fields', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'table', 'field2'],
					],
				],
				['From', ['Table', 'table']],
				[
					'Where',
					[
						'Equals',
						['ReferencedField', 'table', 'field3'],
						['ReferencedField', 'table', 'field4'],
					],
				],
			]),
		).to.deep.equal({ table: ['field1', 'field2', 'field3', 'field4'] });
	});

	it('should work with the same field selected multiple times', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'table', 'field1'],
					],
				],
				['From', ['Table', 'table']],
			]),
		).to.deep.equal({ table: ['field1'] });
	});

	it('should work with the same field filtered multiple times', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				['Select', []],
				['From', ['Table', 'table']],
				[
					'Where',
					[
						'Equals',
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'table', 'field1'],
					],
				],
			]),
		).to.deep.equal({ table: ['field1'] });
	});

	it('should work with select queries in the select', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'table', 'field2'],
						[
							'Alias',
							[
								'SelectQuery',
								['Select', []],
								['From', ['Table', 'table']],
								[
									'Where',
									[
										'Equals',
										['ReferencedField', 'table', 'field5'],
										['ReferencedField', 'table', 'field6'],
									],
								],
							],
							'afield',
						],
					],
				],
				['From', ['Table', 'table']],
				[
					'Where',
					[
						'Equals',
						['ReferencedField', 'table', 'field3'],
						['ReferencedField', 'table', 'field4'],
					],
				],
			]),
		).to.deep.equal({
			table: ['field1', 'field2', 'field5', 'field6', 'field3', 'field4'],
		});
	});

	it('should work with select queries in the from', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				['Select', [['ReferencedField', 'table', 'field1']]],
				['From', ['Table', 'table']],
				[
					'From',
					[
						'Alias',
						[
							'SelectQuery',
							['Select', [['ReferencedField', 'table2', 'field2']]],
							['From', ['Table', 'table2']],
							[
								'Where',
								[
									'Equals',
									['ReferencedField', 'table', 'field3'],
									['ReferencedField', 'table2', 'field4'],
								],
							],
						],
						'atable2',
					],
				],
			]),
		).to.deep.equal({
			table: ['field1', 'field3'],
			table2: ['field2', 'field4'],
		});
	});

	it('should work with select queries in the from', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'atable2', 'afield2'],
					],
				],
				['From', ['Table', 'table']],
				[
					'From',
					[
						'Alias',
						[
							'SelectQuery',
							[
								'Select',
								[['Alias', ['ReferencedField', 'table2', 'field2'], 'afield2']],
							],
							['From', ['Table', 'table2']],
							[
								'Where',
								[
									'Equals',
									['ReferencedField', 'table', 'field3'],
									['ReferencedField', 'table2', 'field4'],
								],
							],
						],
						'atable2',
					],
				],
			]),
		).to.deep.equal({
			table: ['field1', 'field3'],
			table2: ['field2', 'field4'],
		});
	});

	it('should work with select queries in the select and from', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'atable2', 'afield2'],
						[
							'Alias',
							[
								'SelectQuery',
								['Select', [['ReferencedField', 'table3', 'field5']]],
								['From', ['Table', 'table3']],
								[
									'Where',
									[
										'Equals',
										['ReferencedField', 'table', 'field6'],
										['ReferencedField', 'table3', 'field7'],
									],
								],
							],
							'afield',
						],
					],
				],
				['From', ['Table', 'table']],
				[
					'From',
					[
						'Alias',
						[
							'SelectQuery',
							[
								'Select',
								[['Alias', ['ReferencedField', 'table2', 'field2'], 'afield2']],
							],
							['From', ['Table', 'table2']],
							[
								'Where',
								[
									'Equals',
									['ReferencedField', 'table', 'field3'],
									['ReferencedField', 'table2', 'field4'],
								],
							],
						],
						'atable2',
					],
				],
			]),
		).to.deep.equal({
			table: ['field1', 'field6', 'field3'],
			table2: ['field2', 'field4'],
			table3: ['field5', 'field7'],
		});
	});

	it('should work with nested select queries in the from', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'aatable2', 'aafield2'],
					],
				],
				['From', ['Table', 'table']],
				[
					'From',
					[
						'Alias',
						[
							'SelectQuery',
							[
								'Select',
								[
									[
										'Alias',
										['ReferencedField', 'atable2', 'afield2'],
										'aafield2',
									],
								],
							],
							[
								'From',
								[
									'Alias',
									[
										'SelectQuery',
										[
											'Select',
											[
												[
													'Alias',
													['ReferencedField', 'table2', 'field2'],
													'afield2',
												],
												[
													'Alias',
													['ReferencedField', 'table', 'field5'],
													'afield5',
												],
												[
													'Alias',
													['ReferencedField', 'table3', 'field6'],
													'afield6',
												],
											],
										],
										['From', ['Table', 'table3']],
										[
											'Where',
											[
												'Equals',
												['ReferencedField', 'table2', 'field7'],
												['ReferencedField', 'table3', 'field8'],
											],
										],
									],
									'atable2',
								],
							],
							['From', ['Table', 'table2']],
							[
								'Where',
								[
									'Equals',
									['ReferencedField', 'table', 'field3'],
									['ReferencedField', 'table2', 'field4'],
								],
							],
						],
						'aatable2',
					],
				],
			]),
		).to.deep.equal({
			table: ['field1', 'field5', 'field3'],
			table2: ['field2', 'field7', 'field4'],
			table3: ['field6', 'field8'],
		});
	});

	it('should work with nested select queries in the select', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						[
							'Alias',
							[
								'SelectQuery',
								[
									'Select',
									[
										[
											'Alias',
											[
												'SelectQuery',
												[
													'Select',
													[
														[
															'Alias',
															['ReferencedField', 'table2', 'field2'],
															'afield2',
														],
														[
															'Alias',
															['ReferencedField', 'table', 'field5'],
															'afield5',
														],
														[
															'Alias',
															['ReferencedField', 'table3', 'field6'],
															'afield6',
														],
													],
												],
												['From', ['Table', 'table3']],
												[
													'Where',
													[
														'Equals',
														['ReferencedField', 'table2', 'field7'],
														['ReferencedField', 'table3', 'field8'],
													],
												],
											],
											'aafield2',
										],
									],
								],
								['From', ['Table', 'table2']],
								[
									'Where',
									[
										'Equals',
										['ReferencedField', 'table', 'field3'],
										['ReferencedField', 'table2', 'field4'],
									],
								],
							],
							'aafield2',
						],
					],
				],
				['From', ['Table', 'table']],
			]),
		).to.deep.equal({
			table: ['field1', 'field5', 'field3'],
			table2: ['field2', 'field7', 'field4'],
			table3: ['field6', 'field8'],
		});
	});

	it('should work with from select query with select query in its select', () => {
		expect(
			AbstractSqlCompiler.postgres.getReferencedFields([
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'aatable2', 'aafield2'],
					],
				],
				['From', ['Table', 'table']],
				[
					'From',
					[
						'Alias',
						[
							'SelectQuery',
							[
								'Select',
								[
									[
										'Alias',
										[
											'SelectQuery',
											[
												'Select',
												[
													[
														'Alias',
														['ReferencedField', 'table2', 'field2'],
														'afield2',
													],
													[
														'Alias',
														['ReferencedField', 'table', 'field5'],
														'afield5',
													],
													[
														'Alias',
														['ReferencedField', 'table3', 'field6'],
														'afield6',
													],
												],
											],
											['From', ['Table', 'table3']],
											[
												'Where',
												[
													'Equals',
													['ReferencedField', 'table2', 'field7'],
													['ReferencedField', 'table3', 'field8'],
												],
											],
										],
										'atable2',
									],
								],
							],
							['From', ['Table', 'table2']],
							[
								'Where',
								[
									'Equals',
									['ReferencedField', 'table', 'field3'],
									['ReferencedField', 'table2', 'field4'],
								],
							],
						],
						'aatable2',
					],
				],
			]),
		).to.deep.equal({
			table: ['field1', 'field5', 'field3'],
			table2: ['field2', 'field7', 'field4'],
			table3: ['field6', 'field8'],
		});
	});
});
