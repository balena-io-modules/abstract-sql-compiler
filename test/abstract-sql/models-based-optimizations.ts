import * as AbstractSQLCompiler from '../..';
import { expect } from 'chai';

it('should optimize Exists for a non nullable field', () => {
	expect(
		AbstractSQLCompiler.postgres.compileSchema({
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
						{
							fieldName: 'num',
							dataType: 'Integer',
							required: true,
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
									['Where', ['Exists', ['ReferencedField', 'test.0', 'id']]],
								],
							],
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					['StructuredEnglish', 'Test rule'],
				],
			],
		}),
	).to.have.nested.property('rules[0].sql').that.equals(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "test" AS "test.0"
	WHERE true
) AS "result";`);
});

it('should optimize NotExists for a non nullable field', () => {
	expect(
		AbstractSQLCompiler.postgres.compileSchema({
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
						{
							fieldName: 'num',
							dataType: 'Integer',
							required: true,
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
									['Where', ['NotExists', ['ReferencedField', 'test.0', 'id']]],
								],
							],
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					['StructuredEnglish', 'Test rule'],
				],
			],
		}),
	).to.have.nested.property('rules[0].sql').that.equals(`\
SELECT 1 AS "result";`);
});

it('should optimize IsDistinctFrom for two non nullable fields', () => {
	expect(
		AbstractSQLCompiler.postgres.compileSchema({
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
						{
							fieldName: 'num',
							dataType: 'Integer',
							required: true,
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
											'IsDistinctFrom',
											['ReferencedField', 'test.0', 'id'],
											['ReferencedField', 'test.0', 'num'],
										],
									],
								],
							],
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					['StructuredEnglish', 'Test rule'],
				],
			],
		}),
	).to.have.nested.property('rules[0].sql').that.equals(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "test" AS "test.0"
	WHERE "test.0"."id" != "test.0"."num"
) AS "result";`);
});

it('should optimize IsNotDistinctFrom for two non nullable fields', () => {
	expect(
		AbstractSQLCompiler.postgres.compileSchema({
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
						{
							fieldName: 'num',
							dataType: 'Integer',
							required: true,
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
											'IsNotDistinctFrom',
											['ReferencedField', 'test.0', 'id'],
											['ReferencedField', 'test.0', 'num'],
										],
									],
								],
							],
						],
					] as AbstractSQLCompiler.AbstractSqlQuery,
					['StructuredEnglish', 'Test rule'],
				],
			],
		}),
	).to.have.nested.property('rules[0].sql').that.equals(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "test" AS "test.0"
	WHERE "test.0"."id" = "test.0"."num"
) AS "result";`);
});
