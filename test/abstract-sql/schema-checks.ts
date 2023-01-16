import * as AbstractSQLCompiler from '../..';
import { expect } from 'chai';

it('an empty abstractSql model should produce an empty schema', () => {
	expect(
		AbstractSQLCompiler.postgres.compileSchema({
			synonyms: {},
			relationships: {},
			tables: {},
			rules: [],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.is.an('array').that.is.empty;
});

it('a single table abstractSql model should produce an appropriate schema', () => {
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
							index: 'PRIMARY KEY',
						},
					],
					indexes: [],
					primitive: false,
				},
			},
			rules: [],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
);`,
		]);
});

it('an abstractSql model with a check on a field should produce an appropriate schema', () => {
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
							index: 'PRIMARY KEY',
							checks: [['GreaterThan', ['Field', 'id'], ['Number', 0]]],
						},
					],
					indexes: [],
					primitive: false,
				},
			},
			rules: [],
			lfInfo: { rules: {} },
		}),
	)
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL CHECK ("id" > 0) PRIMARY KEY
);`,
		]);
});

describe('check constraints on table level', () => {
	it('with just the abstractSql should produce an appropriate schema', () => {
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
								index: 'PRIMARY KEY',
							},
						],
						indexes: [],
						primitive: false,
						checks: [
							{ abstractSql: ['GreaterThan', ['Field', 'id'], ['Number', 0]] },
						],
					},
				},
				rules: [],
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
,	CHECK ("id" > 0)
);`,
			]);
	});

	it('with description and name should produce an appropriate schema', () => {
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
								index: 'PRIMARY KEY',
							},
						],
						indexes: [],
						primitive: false,
						checks: [
							{
								description: 'id must be positive',
								name: 'positive id',
								abstractSql: ['GreaterThan', ['Field', 'id'], ['Number', 0]],
							},
						],
					},
				},
				rules: [],
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "test" (
	"id" INTEGER NULL PRIMARY KEY
,	-- id must be positive
CONSTRAINT "positive id" CHECK ("id" > 0)
);`,
			]);
	});
});
