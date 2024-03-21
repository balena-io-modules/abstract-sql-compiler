import * as AbstractSQLCompiler from '../..';
import { expect } from 'chai';

const generateSchema = (
	abstractSqlModel: AbstractSQLCompiler.AbstractSqlModel,
) =>
	AbstractSQLCompiler.postgres.compileSchema(
		AbstractSQLCompiler.postgres.optimizeSchema(abstractSqlModel),
	);

it('should convert a basic rule to a check using NOT EXISTS', () => {
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
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					[
						'StructuredEnglish',
						'It is necessary that each test has an id that is greater than 0.',
					],
				],
			],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
,	-- It is necessary that each test has an id that is greater than 0.
CONSTRAINT "test$hkEwz3pzAqalNu6crijhhdWJ0ffUvqRGK8rMkQbViPg=" CHECK (0 < "id"
AND "id" IS NOT NULL)
);`,
		]);
});

it('should convert a basic rule to a check using COUNT(*) = 0', () => {
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
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					[
						'StructuredEnglish',
						'It is necessary that each test has an id that is greater than 0.',
					],
				],
			],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
,	-- It is necessary that each test has an id that is greater than 0.
CONSTRAINT "test$qEORqfvLM2D8/gu0ZEVfvrnt19+uBo55ipVGKTdmu0k=" CHECK (0 < "id"
AND "id" IS NOT NULL)
);`,
		]);
});

it('should correctly shorten a converted check rule with a long name', () => {
	expect(
		generateSchema({
			synonyms: {},
			relationships: {},
			tables: {
				test_table_with_very_very_long_name: {
					name: 'test_table_with_very_very_long_name',
					resourceName: 'test_table_with_very_very_long_name',
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
									[
										'From',
										[
											'Alias',
											['Table', 'test_table_with_very_very_long_name'],
											'test_table_with_very_very_long_name.0',
										],
									],
									[
										'Where',
										[
											'Not',
											[
												'And',
												[
													'LessThan',
													['Integer', 0],
													[
														'ReferencedField',
														'test_table_with_very_very_long_name.0',
														'id',
													],
												],
												[
													'Exists',
													[
														'ReferencedField',
														'test_table_with_very_very_long_name.0',
														'id',
													],
												],
											],
										],
									],
								],
							],
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					[
						'StructuredEnglish',
						'It is necessary that each test_table_with_very_very_long_name has an id that is greater than 0.',
					],
				],
			],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test_table_with_very_very_long_name" (
	"id" INTEGER NULL PRIMARY KEY
,	-- It is necessary that each test_table_with_very_very_long_name has an id that is greater than 0.
CONSTRAINT "test_table_with_very_very_long$9z+XEkP4EI1mhDQ8SiLulo2NLmenGY1C" CHECK (0 < "id"
AND "id" IS NOT NULL)
);`,
		]);
});

it('should work with differing table/resource names using NOT EXISTS', () => {
	expect(
		generateSchema({
			synonyms: {},
			relationships: {},
			tables: {
				some_other_resource_name: {
					name: 'test',
					resourceName: 'some_other_resource_name',
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
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					[
						'StructuredEnglish',
						'It is necessary that each test has an id that is greater than 0.',
					],
				],
			],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
,	-- It is necessary that each test has an id that is greater than 0.
CONSTRAINT "test$hkEwz3pzAqalNu6crijhhdWJ0ffUvqRGK8rMkQbViPg=" CHECK (0 < "id"
AND "id" IS NOT NULL)
);`,
		]);
});

it('should work with differing table/resource names using COUNT(*) = 0', () => {
	expect(
		generateSchema({
			synonyms: {},
			relationships: {},
			tables: {
				some_other_resource_name: {
					name: 'test',
					resourceName: 'some_other_resource_name',
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
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					[
						'StructuredEnglish',
						'It is necessary that each test has an id that is greater than 0.',
					],
				],
			],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
,	-- It is necessary that each test has an id that is greater than 0.
CONSTRAINT "test$qEORqfvLM2D8/gu0ZEVfvrnt19+uBo55ipVGKTdmu0k=" CHECK (0 < "id"
AND "id" IS NOT NULL)
);`,
		]);
});
