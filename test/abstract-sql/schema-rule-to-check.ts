import * as AbstractSQLCompiler from '../..';
import { expect } from 'chai';

const generateSchema = (
	abstractSqlModel: AbstractSQLCompiler.AbstractSqlModel,
) =>
	AbstractSQLCompiler.postgres.compileSchema(
		AbstractSQLCompiler.postgres.optimizeSchema(abstractSqlModel),
	);

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
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					[
						'StructuredEnglish',
						'It is necessary that each test has an id that is greater than 0.',
					],
				],
			],
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
,	-- It is necessary that each test has an id that is greater than 0.
CONSTRAINT "test$hkEwz3pzAqalNu6crijhhdWJ0ffUvqRGK8rMkQbViPg=" CHECK (0 < "id"
AND \"id\" IS NOT NULL)
);`,
		]);
});

it('should optimize null checks for a required field', () => {
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
							required: true,
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
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					[
						'StructuredEnglish',
						'It is necessary that each test has an id that is greater than 0.',
					],
				],
			],
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NOT NULL PRIMARY KEY
,	-- It is necessary that each test has an id that is greater than 0.
CONSTRAINT "test$TIITyGYLwuTGGJjwAk8awbiE/hnw6y8rue+hQ8Pp7as=" CHECK (0 < "id")
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
							required: true,
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
											'test_table_with_very_very_long_name',
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
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test_table_with_very_very_long_name" (
	"id" INTEGER NOT NULL PRIMARY KEY
,	-- It is necessary that each test_table_with_very_very_long_name has an id that is greater than 0.
CONSTRAINT "test_table_with_very_very_long$/rDs8gDAB2Zoc7woBPozVMLKpx9jNTNa" CHECK (0 < "id")
);`,
		]);
});
