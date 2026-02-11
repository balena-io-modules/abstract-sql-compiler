import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { generateRuleSlug } from '../../out/abstract-sql-schema-optimizer.js';
import { expect } from 'chai';

const generateSchema = (
	abstractSqlModel: AbstractSQLCompiler.AbstractSqlModel,
) =>
	AbstractSQLCompiler.postgres.compileSchema(
		AbstractSQLCompiler.postgres.optimizeSchema(abstractSqlModel),
	);

it('should identify and convert a conditional uniqueness rule on primitive fields to a partial UNIQUE INDEX', () => {
	const schema = {
		synonyms: {},
		relationships: {},
		tables: {
			test: {
				name: 'test',
				resourceName: 'test',
				idField: 'id',
				fields: [
					{
						dataType: 'Short Text',
						fieldName: 'name',
						required: true,
					},
					{
						dataType: 'Short Text',
						fieldName: 'status',
						required: false,
						checks: [
							[
								'In',
								['Field', 'status'],
								['Text', 'running'],
								['Text', 'failed'],
								['Text', 'succeeded'],
							],
						],
					},
					{
						fieldName: 'is invalidated',
						dataType: 'Boolean',
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
						'NotExists',
						[
							'SelectQuery',
							['Select', [['ReferencedField', 'test.1', 'name']]],
							['From', ['Alias', ['Table', 'test'], 'test.1']],
							[
								'Where',
								[
									'And',
									[
										'Equals',
										['Text', 'succeeded'],
										['ReferencedField', 'test.1', 'status'],
									],
									['Exists', ['ReferencedField', 'test.1', 'status']],
									[
										'Equals',
										['ReferencedField', 'test.1', 'is invalidated'],
										['Boolean', false],
									],
									[
										'GreaterThanOrEqual',
										[
											'SelectQuery',
											['Select', [['Count', '*']]],
											['From', ['Alias', ['Table', 'test'], 'test.3']],
											[
												'Where',
												[
													'And',
													[
														'Equals',
														['Text', 'succeeded'],
														['ReferencedField', 'test.3', 'status'],
													],
													['Exists', ['ReferencedField', 'test.3', 'status']],
													[
														'Equals',
														['ReferencedField', 'test.3', 'is invalidated'],
														['Boolean', false],
													],
													[
														'Equals',
														['ReferencedField', 'test.3', 'name'],
														['ReferencedField', 'test.1', 'name'],
													],
												],
											],
										],
										['Number', 2],
									],
								],
							],
						],
					],
				],
				[
					'StructuredEnglish',
					'It is necessary that each name that is of a test that has a status that is equal to "succeeded" and is not invalidated, is of at most one test that has a status that is equal to "succeeded" and is not invalidated.',
				],
			],
		],
		lfInfo: {
			rules: {
				'It is necessary that each name that is of a test that has a status that is equal to "succeeded" and is not invalidated, is of at most one test that has a status that is equal to "succeeded" and is not invalidated.':
					{
						root: {
							table: 'test',
							alias: 'test.1',
						},
					},
			},
		},
	} satisfies AbstractSQLCompiler.AbstractSqlModel;
	// compute the index auto-generated name upfront to ensure that that the generated name
	// is not affected by any possible modifications that generateSchema() might do to the rule definition.
	const expectedIndexName = generateRuleSlug('test', schema.rules[0][1][1]);
	expect(generateSchema(schema))
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"name" VARCHAR(255) NOT NULL
,	"status" VARCHAR(255) NULL CHECK ("status" IN ('running', 'failed', 'succeeded'))
,	"is invalidated" BOOLEAN DEFAULT FALSE NOT NULL
);`,
			`\
-- It is necessary that each name that is of a test that has a status that is equal to "succeeded" and is not invalidated, is of at most one test that has a status that is equal to "succeeded" and is not invalidated.
CREATE UNIQUE INDEX IF NOT EXISTS "${expectedIndexName}"
ON "test" ("name")
WHERE ('succeeded' = "status"
AND "status" IS NOT NULL
AND "is invalidated" = FALSE);`,
		]);
	expect(expectedIndexName).to.equal(
		'test$/DBLtT/ool+lP1+AWWoT22t3zgmd7DSVqrLe0dZiwbw=',
	);
});

it('should identify and convert a conditional uniqueness rule on primitive fields to a partial UNIQUE INDEX and not include unnecessary NULL checks in the WHERE clause', () => {
	const schema = {
		synonyms: {},
		relationships: {},
		tables: {
			test: {
				name: 'test',
				resourceName: 'test',
				idField: 'id',
				fields: [
					{
						dataType: 'Short Text',
						fieldName: 'name',
						// marked as optional to make sure a NULL check
						// doesn't get added to the indexed fields
						required: false,
					},
					{
						dataType: 'Short Text',
						fieldName: 'status',
						// marked as required to confirm that no unnecessary NULL check
						// gets added to the index's predicate
						required: true,
						checks: [
							[
								'In',
								['Field', 'status'],
								['Text', 'running'],
								['Text', 'failed'],
								['Text', 'succeeded'],
							],
						],
					},
					{
						fieldName: 'is invalidated',
						dataType: 'Boolean',
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
						'NotExists',
						[
							'SelectQuery',
							['Select', [['ReferencedField', 'test.1', 'name']]],
							['From', ['Alias', ['Table', 'test'], 'test.1']],
							[
								'Where',
								[
									'And',
									[
										'Equals',
										['Text', 'succeeded'],
										['ReferencedField', 'test.1', 'status'],
									],
									['Exists', ['ReferencedField', 'test.1', 'status']],
									[
										'Equals',
										['ReferencedField', 'test.1', 'is invalidated'],
										['Boolean', false],
									],
									[
										'GreaterThanOrEqual',
										[
											'SelectQuery',
											['Select', [['Count', '*']]],
											['From', ['Alias', ['Table', 'test'], 'test.3']],
											[
												'Where',
												[
													'And',
													[
														'Equals',
														['Text', 'succeeded'],
														['ReferencedField', 'test.3', 'status'],
													],
													['Exists', ['ReferencedField', 'test.3', 'status']],
													[
														'Equals',
														['ReferencedField', 'test.3', 'is invalidated'],
														['Boolean', false],
													],
													[
														'Equals',
														['ReferencedField', 'test.3', 'name'],
														['ReferencedField', 'test.1', 'name'],
													],
												],
											],
										],
										['Number', 2],
									],
								],
							],
						],
					],
				],
				[
					'StructuredEnglish',
					'It is necessary that each name that is of a test that has a status that is equal to "succeeded" and is not invalidated, is of at most one test that has a status that is equal to "succeeded" and is not invalidated.',
				],
			],
		],
		lfInfo: {
			rules: {
				'It is necessary that each name that is of a test that has a status that is equal to "succeeded" and is not invalidated, is of at most one test that has a status that is equal to "succeeded" and is not invalidated.':
					{
						root: {
							table: 'test',
							alias: 'test.1',
						},
					},
			},
		},
	} satisfies AbstractSQLCompiler.AbstractSqlModel;
	// compute the index auto-generated name upfront to ensure that that the generated name
	// is not affected by any possible modifications that generateSchema() might do to the rule definition.
	const expectedIndexName = generateRuleSlug('test', schema.rules[0][1][1]);
	expect(generateSchema(schema))
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "test" (
	"name" VARCHAR(255) NULL
,	"status" VARCHAR(255) NOT NULL CHECK ("status" IN ('running', 'failed', 'succeeded'))
,	"is invalidated" BOOLEAN DEFAULT FALSE NOT NULL
);`,
			`\
-- It is necessary that each name that is of a test that has a status that is equal to "succeeded" and is not invalidated, is of at most one test that has a status that is equal to "succeeded" and is not invalidated.
CREATE UNIQUE INDEX IF NOT EXISTS "${expectedIndexName}"
ON "test" ("name")
WHERE ('succeeded' = "status"
AND "is invalidated" = FALSE);`,
		]);
	expect(expectedIndexName).to.equal(
		'test$/DBLtT/ool+lP1+AWWoT22t3zgmd7DSVqrLe0dZiwbw=',
	);
});

it('should identify and convert a conditional uniqueness rule on referenced fields to a partial UNIQUE INDEX', () => {
	const schema = {
		synonyms: {},
		relationships: {},
		tables: {
			parent: {
				name: 'parent',
				resourceName: 'parent',
				idField: 'id',
				fields: [
					{
						dataType: 'Serial',
						fieldName: 'id',
						required: true,
						index: 'PRIMARY KEY',
					},
				],
				primitive: false,
				indexes: [],
			},
			child: {
				name: 'child',
				resourceName: 'child',
				idField: 'id',
				fields: [
					{
						dataType: 'ForeignKey',
						fieldName: 'is of-parent',
						required: true,
						references: {
							resourceName: 'parent',
							fieldName: 'id',
						},
					},
					{
						dataType: 'Short Text',
						fieldName: 'name',
						required: true,
					},
					{
						fieldName: 'must be unique',
						dataType: 'Boolean',
						required: true,
					},
				],
				primitive: false,
				indexes: [],
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
							['From', ['Alias', ['Table', 'parent'], 'parent.0']],
							['From', ['Alias', ['Table', 'child'], 'child.1']],
							[
								'Where',
								[
									'And',
									[
										'Equals',
										['ReferencedField', 'child.1', 'must be unique'],
										['Boolean', true],
									],
									['Exists', ['ReferencedField', 'child.1', 'name']],
									[
										'Equals',
										['ReferencedField', 'child.1', 'is of-parent'],
										['ReferencedField', 'parent.0', 'id'],
									],
									[
										'GreaterThanOrEqual',
										[
											'SelectQuery',
											['Select', [['Count', '*']]],
											['From', ['Alias', ['Table', 'child'], 'child.4']],
											[
												'Where',
												[
													'And',
													[
														'Equals',
														['ReferencedField', 'child.4', 'must be unique'],
														['Boolean', true],
													],
													['Exists', ['ReferencedField', 'child.4', 'name']],
													[
														'Equals',
														['ReferencedField', 'child.4', 'name'],
														['ReferencedField', 'child.1', 'name'],
													],
													[
														'Equals',
														['ReferencedField', 'child.4', 'is of-parent'],
														['ReferencedField', 'parent.0', 'id'],
													],
												],
											],
										],
										['Number', 2],
									],
								],
							],
						],
						['Number', 0],
					],
				],
				[
					'StructuredEnglish',
					'It is necessary that each parent that has a child 1 that must be unique and has a name1, has at most one child2 that must be unique and has a name2 that is equal to the name1.',
				],
			],
		],
		lfInfo: {
			rules: {
				'It is necessary that each parent that has a child 1 that must be unique and has a name1, has at most one child2 that must be unique and has a name2 that is equal to the name1.':
					{
						root: {
							table: 'parent',
							alias: 'parent.0',
						},
					},
			},
		},
	} satisfies AbstractSQLCompiler.AbstractSqlModel;
	// compute the index auto-generated name upfront to ensure that that the generated name
	// is not affected by any possible modifications that generateSchema() might do to the rule definition.
	const expectedIndexName = generateRuleSlug('child', schema.rules[0][1][1]);
	expect(generateSchema(schema))
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "parent" (
	"id" SERIAL NOT NULL PRIMARY KEY
);`,
			`\
CREATE TABLE IF NOT EXISTS "child" (
	"is of-parent" INTEGER NOT NULL
,	"name" VARCHAR(255) NOT NULL
,	"must be unique" BOOLEAN DEFAULT FALSE NOT NULL
,	FOREIGN KEY ("is of-parent") REFERENCES "parent" ("id")
);`,
			`\
-- It is necessary that each parent that has a child 1 that must be unique and has a name1, has at most one child2 that must be unique and has a name2 that is equal to the name1.
CREATE UNIQUE INDEX IF NOT EXISTS "${expectedIndexName}"
ON "child" ("is of-parent", "name")
WHERE ("must be unique" = TRUE);`,
		]);
	expect(expectedIndexName).to.equal(
		'child$g+bFnJdVbfsu97AT3NVBKhKxUgMWDreZ391TgCScha4=',
	);
});

it('should identify and convert a conditional uniqueness rule on referenced fields to a partial UNIQUE INDEX regardless of the order of the params to the EqualsNodes', () => {
	const schema = {
		synonyms: {},
		relationships: {
			parent: {
				owns: {
					child: {
						$: ['id', ['child', 'belongs to-parent']],
					},
				},
			},
		},
		tables: {
			parent: {
				name: 'parent',
				resourceName: 'parent',
				idField: 'id',
				fields: [
					{
						dataType: 'Serial',
						fieldName: 'id',
						required: true,
						index: 'PRIMARY KEY',
					},
				],
				primitive: false,
				indexes: [],
			},
			child: {
				name: 'child',
				resourceName: 'child',
				idField: 'id',
				fields: [
					{
						dataType: 'ForeignKey',
						fieldName: 'belongs to-parent',
						required: true,
						references: {
							resourceName: 'parent',
							fieldName: 'id',
						},
					},
					{
						dataType: 'Integer',
						fieldName: 'first key',
						required: true,
					},
					{
						dataType: 'Integer',
						fieldName: 'second key',
						required: true,
					},
					{
						dataType: 'Integer',
						fieldName: 'optional key',
						required: false,
					},
				],
				primitive: false,
				indexes: [],
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
							['From', ['Alias', ['Table', 'parent'], 'parent.0']],
							['From', ['Alias', ['Table', 'child'], 'child.1']],
							[
								'Where',
								[
									'And',
									['Exists', ['ReferencedField', 'child.1', 'optional key']],
									[
										'Equals',
										['ReferencedField', 'child.1', 'belongs to-parent'],
										['ReferencedField', 'parent.0', 'id'],
									],
									[
										'GreaterThanOrEqual',
										[
											'SelectQuery',
											['Select', [['Count', '*']]],
											['From', ['Alias', ['Table', 'child'], 'child.3']],
											[
												'Where',
												[
													'And',
													[
														'Equals',
														['ReferencedField', 'child.1', 'first key'],
														['ReferencedField', 'child.3', 'first key'],
													],
													[
														'Exists',
														['ReferencedField', 'child.3', 'first key'],
													],
													[
														'Equals',
														['ReferencedField', 'child.1', 'second key'],
														['ReferencedField', 'child.3', 'second key'],
													],
													[
														'Exists',
														['ReferencedField', 'child.3', 'second key'],
													],
													[
														'Equals',
														['ReferencedField', 'child.1', 'optional key'],
														['ReferencedField', 'child.3', 'optional key'],
													],
													[
														'Exists',
														['ReferencedField', 'child.3', 'optional key'],
													],
													[
														'Equals',
														['ReferencedField', 'child.3', 'belongs to-parent'],
														['ReferencedField', 'parent.0', 'id'],
													],
												],
											],
										],
										['Number', 2],
									],
								],
							],
						],
						['Number', 0],
					],
				],
				[
					'StructuredEnglish',
					'It is necessary that each parent that owns a child1 that has an optional key, owns at most one child2 that has a first key that is of the child1 and has a second key that is of the child1 and has an optional key that is of the child1.',
				],
			],
		],
		lfInfo: {
			rules: {
				'It is necessary that each parent that owns a child1 that has an optional key, owns at most one child2 that has a first key that is of the child1 and has a second key that is of the child1 and has an optional key that is of the child1.':
					{
						root: {
							table: 'parent',
							alias: 'parent.0',
						},
					},
			},
		},
	} satisfies AbstractSQLCompiler.AbstractSqlModel;
	// compute the index auto-generated name upfront to ensure that that the generated name
	// is not affected by any possible modifications that generateSchema() might do to the rule definition.
	const expectedIndexName = generateRuleSlug('child', schema.rules[0][1][1]);
	expect(generateSchema(schema))
		.to.have.property('createSchema')
		.that.deep.equals([
			`\
CREATE TABLE IF NOT EXISTS "parent" (
	"id" SERIAL NOT NULL PRIMARY KEY
);`,
			`\
CREATE TABLE IF NOT EXISTS "child" (
	"belongs to-parent" INTEGER NOT NULL
,	"first key" INTEGER NOT NULL
,	"second key" INTEGER NOT NULL
,	"optional key" INTEGER NULL
,	FOREIGN KEY ("belongs to-parent") REFERENCES "parent" ("id")
);`,
			`\
-- It is necessary that each parent that owns a child1 that has an optional key, owns at most one child2 that has a first key that is of the child1 and has a second key that is of the child1 and has an optional key that is of the child1.
CREATE UNIQUE INDEX IF NOT EXISTS "${expectedIndexName}"
ON "child" ("belongs to-parent", "first key", "second key", "optional key")
WHERE ("optional key" IS NOT NULL);`,
		]);
	expect(expectedIndexName).to.equal(
		'child$2pSl7vw7IjAvHFu1U50UXWTumZ9g3ASd/mWNxEnqW5Q=',
	);
});
