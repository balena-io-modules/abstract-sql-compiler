import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

type Table = AbstractSQLCompiler.AbstractSqlTable;
const table = (name: string, references: Table['fields'][number]): Table => ({
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
		references,
	],
	indexes: [],
	primitive: false,
});
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
const generateModel = (
	tables: Table[],
): AbstractSQLCompiler.AbstractSqlModel => ({
	synonyms: {},
	relationships: {},
	tables: Object.fromEntries(tables.map((t) => [t.name, t])),
	rules: [],
	lfInfo: { rules: {} },
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

describe('informative references forming a cycle', () => {
	for (const order of [
		[a, b],
		[b, a],
	]) {
		it(`should not create a foreign key or a circular dependency when defined in the order ${order.map((t) => t.name).join(', ')}`, () => {
			expect(AbstractSQLCompiler.postgres.compileSchema(generateModel(order)))
				.to.have.property('createSchema')
				.that.deep.equals(expectedSchema('IF NOT EXISTS '));
		});
	}

	it('should not be treated as a circular dependency on websql', () => {
		expect(AbstractSQLCompiler.websql.compileSchema(generateModel([a, b])))
			.to.have.property('createSchema')
			.that.deep.equals(
				expectedSchema('').map((s) =>
					s.replaceAll(
						'SERIAL NOT NULL PRIMARY KEY',
						'INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT',
					),
				),
			);
	});
});
