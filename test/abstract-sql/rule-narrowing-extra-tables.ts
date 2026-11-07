import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

const ruleSE = 'It is necessary that each pilot that flies a plane, ...';
const generateModel = (
	ruleBody: AbstractSQLCompiler.AbstractSqlQuery,
): AbstractSQLCompiler.AbstractSqlModel => ({
	synonyms: {},
	relationships: {},
	tables: {
		pilot: {
			name: 'pilot',
			resourceName: 'pilot',
			idField: 'id',
			fields: [
				{
					fieldName: 'id',
					dataType: 'Serial',
					required: true,
					index: 'PRIMARY KEY',
				},
				{ fieldName: 'age', dataType: 'Integer', required: true },
				{ fieldName: 'flies-plane', dataType: 'Integer', required: true },
				{ fieldName: 'has-licence', dataType: 'Short Text', required: true },
			],
			indexes: [],
			primitive: false,
		},
		plane: {
			name: 'plane',
			resourceName: 'plane',
			// An integer id field that is not named "id"
			idField: 'code',
			fields: [
				{
					fieldName: 'code',
					dataType: 'Integer',
					required: true,
					index: 'PRIMARY KEY',
				},
				{ fieldName: 'seats', dataType: 'Integer', required: true },
			],
			indexes: [],
			primitive: false,
		},
		licence: {
			name: 'licence',
			resourceName: 'licence',
			// A non integer id field, which can't be narrowed by an INTEGER[] of affected ids
			idField: 'serial',
			fields: [
				{
					fieldName: 'serial',
					dataType: 'Short Text',
					required: true,
					index: 'PRIMARY KEY',
				},
			],
			indexes: [],
			primitive: false,
		},
	},
	rules: [['Rule', ['Body', ruleBody], ['StructuredEnglish', ruleSE]]],
	lfInfo: {
		rules: { [ruleSE]: { root: { table: 'pilot', alias: 'pilot.0' } } },
	},
});

describe('rule narrowing of tables other than the root', () => {
	it('should narrow the tables with integer ids that are selected once in the top level FROM', () => {
		const [rule] = AbstractSQLCompiler.postgres.compileSchema(
			generateModel([
				'NotExists',
				[
					'SelectQuery',
					['Select', []],
					['From', ['Alias', ['Table', 'pilot'], 'pilot.0']],
					['From', ['Alias', ['Table', 'plane'], 'plane.1']],
					['From', ['Alias', ['Table', 'licence'], 'licence.2']],
					[
						'Where',
						[
							'And',
							[
								'Equals',
								['ReferencedField', 'pilot.0', 'flies-plane'],
								['ReferencedField', 'plane.1', 'code'],
							],
							[
								'Equals',
								['ReferencedField', 'pilot.0', 'has-licence'],
								['ReferencedField', 'licence.2', 'serial'],
							],
							[
								'GreaterThan',
								['ReferencedField', 'pilot.0', 'age'],
								['ReferencedField', 'plane.1', 'seats'],
							],
						],
					],
				],
			]),
		).rules;
		expect(rule.bindings).to.deep.equal([
			['Bind', 'pilot'],
			['Bind', 'plane'],
		]);
		expect(rule.sql).to.equal(`\
SELECT NOT EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.0",
		"plane" AS "plane.1",
		"licence" AS "licence.2"
	WHERE "pilot.0"."flies-plane" = "plane.1"."code"
	AND "pilot.0"."has-licence" = "licence.2"."serial"
	AND "pilot.0"."age" > "plane.1"."seats"
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
	AND ($2 = '{}'
	OR "plane.1"."code" = ANY(CAST($2 AS INTEGER[])))
) AS "result";`);
	});

	it('should still narrow the other tables when the root table is selected more than once', () => {
		const [rule] = AbstractSQLCompiler.postgres.compileSchema(
			generateModel([
				'NotExists',
				[
					'SelectQuery',
					['Select', []],
					['From', ['Alias', ['Table', 'pilot'], 'pilot.0']],
					['From', ['Alias', ['Table', 'plane'], 'plane.1']],
					[
						'Where',
						[
							'And',
							[
								'Equals',
								['ReferencedField', 'pilot.0', 'flies-plane'],
								['ReferencedField', 'plane.1', 'code'],
							],
							[
								'GreaterThan',
								[
									'SelectQuery',
									['Select', [['Count', '*']]],
									['From', ['Alias', ['Table', 'pilot'], 'pilot.2']],
									[
										'Where',
										[
											'Equals',
											['ReferencedField', 'pilot.2', 'flies-plane'],
											['ReferencedField', 'plane.1', 'code'],
										],
									],
								],
								['ReferencedField', 'plane.1', 'seats'],
							],
						],
					],
				],
			]),
		).rules;
		// The root table (pilot) is selected from twice so it must not be narrowed, but the plane can
		expect(rule.bindings).to.deep.equal([['Bind', 'plane']]);
		expect(rule.sql).to.not.include('"pilot.0"."id" = ANY(');
		expect(rule.sql).to.include(`\
	AND ($1 = '{}'
	OR "plane.1"."code" = ANY(CAST($1 AS INTEGER[])))`);
	});
});
