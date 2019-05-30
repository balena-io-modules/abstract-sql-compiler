import * as AbstractSqlCompiler from '../../src/AbstractSQLCompiler';
import { expect } from 'chai';

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
			atable: ['field1', 'field2'],
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
			atable: ['field1', 'field2'],
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
			atable: ['field1'],
			table2: ['field2'],
			atable2: ['field2'],
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
			atable: ['field1'],
			table2: ['field2'],
			atable2: ['field2'],
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
			atable: ['field1'],
			atable2: ['field2'],
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
			atable: ['field1'],
			atable2: ['field2'],
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
});
