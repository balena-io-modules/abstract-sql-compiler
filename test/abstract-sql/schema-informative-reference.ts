import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

type Table = AbstractSQLCompiler.AbstractSqlTable;
const table = (
	name: string,
	field: Table['fields'][number],
	primitive: Table['primitive'] = false,
): Table => ({
	name,
	resourceName: name,
	idField: 'id',
	fields: [
		{
			fieldName: 'id',
			dataType: 'Serial',
			required: true,
			index: 'PRIMARY KEY',
		},
		field,
	],
	indexes: [],
	primitive,
});
const generateModel = (
	tables: Table[],
): AbstractSQLCompiler.AbstractSqlModel => ({
	synonyms: {},
	relationships: {},
	tables: Object.fromEntries(tables.map((t) => [t.name, t])),
	rules: [],
	lfInfo: { rules: {} },
});

describe('generate informative reference schema', () => {
	it('reference type informative produces just a column without foreign key / constraint', () => {
		expect(
			AbstractSQLCompiler.postgres.compileSchema({
				tables: {
					term: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'term',
						indexes: [],
						idField: 'id',
						resourceName: 'term',
					},
					'term history': {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-term',
								required: true,
								references: {
									resourceName: 'term',
									fieldName: 'id',
									type: 'informative',
								},
							},
						],
						primitive: false,
						name: 'term history',
						indexes: [],
						idField: 'id',
						resourceName: 'term history',
					},
				},
				relationships: {},
				rules: [],
				synonyms: {},
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"modified at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"modified at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
);`,
			]);
	});

	it('reference type informative produces just a column without foreign key / constraint - mixed mode', () => {
		expect(
			AbstractSQLCompiler.postgres.compileSchema({
				tables: {
					term: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'term',
						indexes: [],
						idField: 'id',
						resourceName: 'term',
					},
					termterm: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'termterm',
						indexes: [],
						idField: 'id',
						resourceName: 'termterm',
					},
					'term history': {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-term',
								required: true,
								references: {
									resourceName: 'term',
									fieldName: 'id',
									type: 'informative',
								},
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-termterm',
								required: true,
								references: {
									resourceName: 'termterm',
									fieldName: 'id',
								},
							},
						],
						primitive: false,
						name: 'term history',
						indexes: [],
						idField: 'id',
						resourceName: 'term history',
					},
				},
				relationships: {},
				rules: [],
				synonyms: {},
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"modified at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "termterm" (
	"created at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"modified at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"modified at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
,	"references-termterm" INTEGER NOT NULL
,	FOREIGN KEY ("references-termterm") REFERENCES "termterm" ("id")
);`,
			]);
	});
	it('reference type strict produces a column foreign key / constraint', () => {
		expect(
			AbstractSQLCompiler.postgres.compileSchema({
				tables: {
					term: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'term',
						indexes: [],
						idField: 'id',
						resourceName: 'term',
					},
					'term history': {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-term',
								required: true,
								references: {
									resourceName: 'term',
									fieldName: 'id',
									type: 'strict',
								},
							},
						],
						primitive: false,
						name: 'term history',
						indexes: [],
						idField: 'id',
						resourceName: 'term history',
					},
				},
				relationships: {},
				rules: [],
				synonyms: {},
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"modified at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"modified at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
,	FOREIGN KEY ("references-term") REFERENCES "term" ("id")
);`,
			]);
	});

	it('reference type undefined produces a column foreign key / constraint', () => {
		expect(
			AbstractSQLCompiler.postgres.compileSchema({
				tables: {
					term: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'term',
						indexes: [],
						idField: 'id',
						resourceName: 'term',
					},
					'term history': {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMPTZ',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-term',
								required: true,
								references: {
									resourceName: 'term',
									fieldName: 'id',
								},
							},
						],
						primitive: false,
						name: 'term history',
						indexes: [],
						idField: 'id',
						resourceName: 'term history',
					},
				},
				relationships: {},
				rules: [],
				synonyms: {},
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"modified at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"modified at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMPTZ NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
,	FOREIGN KEY ("references-term") REFERENCES "term" ("id")
);`,
			]);
	});

	it('reference type informative still creates a primitive table it references', () => {
		const schema = AbstractSQLCompiler.postgres.compileSchema(
			generateModel([
				table(
					'name',
					{ fieldName: 'value', dataType: 'Short Text', required: true },
					'Short Text',
				),
				table('a', {
					fieldName: 'name',
					dataType: 'ForeignKey',
					references: {
						resourceName: 'name',
						fieldName: 'id',
						type: 'informative',
					},
				}),
			]),
		);
		expect(schema)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "name" (
	"id" SERIAL NOT NULL PRIMARY KEY
,	"value" VARCHAR(255) NOT NULL
);`,
				`\
CREATE TABLE IF NOT EXISTS "a" (
	"id" SERIAL NOT NULL PRIMARY KEY
,	"name" INTEGER NULL
);`,
			]);
		expect(schema)
			.to.have.property('dropSchema')
			.that.deep.equals(['DROP TABLE "a";', 'DROP TABLE "name";']);
	});

	describe('forming a cycle', () => {
		// `a` has a real foreign key to `b`, whilst `b` only has an informative reference back to `a`
		const a = table('a', {
			fieldName: 'b',
			dataType: 'ForeignKey',
			references: { resourceName: 'b', fieldName: 'id' },
		});
		const b = table('b', {
			fieldName: 'a',
			dataType: 'ForeignKey',
			references: { resourceName: 'a', fieldName: 'id', type: 'informative' },
		});

		const expectedSchema = (ifNotExists: string) => [
			`\
CREATE TABLE ${ifNotExists}"b" (
	"id" SERIAL NOT NULL PRIMARY KEY
,	"a" INTEGER NULL
);`,
			`\
CREATE TABLE ${ifNotExists}"a" (
	"id" SERIAL NOT NULL PRIMARY KEY
,	"b" INTEGER NULL
,	FOREIGN KEY ("b") REFERENCES "b" ("id")
);`,
		];
		const expectedDropSchema = ['DROP TABLE "a";', 'DROP TABLE "b";'];

		for (const order of [
			[a, b],
			[b, a],
		]) {
			it(`should not create a foreign key or a circular dependency when defined in the order ${order.map((t) => t.name).join(', ')}`, () => {
				const schema = AbstractSQLCompiler.postgres.compileSchema(
					generateModel(order),
				);
				expect(schema)
					.to.have.property('createSchema')
					.that.deep.equals(expectedSchema('IF NOT EXISTS '));
				expect(schema)
					.to.have.property('dropSchema')
					.that.deep.equals(expectedDropSchema);
			});
		}

		it('should not be treated as a circular dependency on websql', () => {
			const schema = AbstractSQLCompiler.websql.compileSchema(
				generateModel([a, b]),
			);
			expect(schema)
				.to.have.property('createSchema')
				.that.deep.equals(
					expectedSchema('').map((s) =>
						s.replaceAll(
							'SERIAL NOT NULL PRIMARY KEY',
							'INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT',
						),
					),
				);
			expect(schema)
				.to.have.property('dropSchema')
				.that.deep.equals(expectedDropSchema);
		});
	});
});
