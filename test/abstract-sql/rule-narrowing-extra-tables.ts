import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

type Tables = AbstractSQLCompiler.AbstractSqlModel['tables'];
type AbstractSqlQuery = AbstractSQLCompiler.AbstractSqlQuery;

const ruleSE = 'It is necessary that each pilot that flies a plane, ...';
const serialId = (fieldName = 'id'): AbstractSQLCompiler.AbstractSqlField => ({
	fieldName,
	dataType: 'Serial',
	required: true,
	index: 'PRIMARY KEY',
});
const getTables = (): Tables => ({
	pilot: {
		name: 'pilot',
		resourceName: 'pilot',
		idField: 'id',
		fields: [
			serialId(),
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
			{ fieldName: 'is based at-airport', dataType: 'Integer' },
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
	airport: {
		name: 'airport',
		resourceName: 'airport',
		idField: 'id',
		fields: [serialId()],
		indexes: [],
		primitive: false,
	},
});

const compileRule = (
	ruleBody: AbstractSqlQuery,
	modifyModel?: (model: AbstractSQLCompiler.AbstractSqlModel) => void,
) => {
	const model: AbstractSQLCompiler.AbstractSqlModel = {
		synonyms: {},
		relationships: {},
		tables: getTables(),
		rules: [['Rule', ['Body', ruleBody], ['StructuredEnglish', ruleSE]]],
		lfInfo: {
			rules: { [ruleSE]: { root: { table: 'pilot', alias: 'pilot.0' } } },
		},
	};
	modifyModel?.(model);
	const [rule] = AbstractSQLCompiler.postgres.compileSchema(model).rules;
	return rule;
};

const addPlaneTrigger = (
	model: AbstractSQLCompiler.AbstractSqlModel,
	trigger: Omit<AbstractSQLCompiler.Trigger, 'fnName' | 'operation'>,
) => {
	model.functions = {
		plane_trigger: {
			type: 'trigger',
			body: 'RETURN NEW;',
			language: 'plpgsql',
		},
	};
	model.tables.plane.triggers = [
		{ operation: 'UPDATE', fnName: 'plane_trigger', ...trigger },
	];
};

// SELECT NOT EXISTS (
// 	SELECT 1
// 	FROM "pilot" AS "pilot.0", "plane" AS "plane.1" <extraNodes>
// 	WHERE "pilot.0"."flies-plane" = "plane.1"."code"
// 	AND "pilot.0"."age" > "plane.1"."seats"
// 	<extraConditions>
// )
const pilotAndPlaneQuery = ({
	extraNodes = [],
	extraConditions = [],
}: {
	extraNodes?: AbstractSqlQuery[];
	extraConditions?: AbstractSqlQuery[];
} = {}) =>
	[
		'SelectQuery',
		['Select', []],
		['From', ['Alias', ['Table', 'pilot'], 'pilot.0']],
		['From', ['Alias', ['Table', 'plane'], 'plane.1']],
		...extraNodes,
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
					['ReferencedField', 'pilot.0', 'age'],
					['ReferencedField', 'plane.1', 'seats'],
				],
				...extraConditions,
			],
		],
	] as AbstractSqlQuery;

describe('rule narrowing of tables other than the root', () => {
	it('should narrow the tables with integer ids that are selected once in the top level FROM', () => {
		const rule = compileRule([
			'NotExists',
			pilotAndPlaneQuery({
				extraNodes: [['From', ['Alias', ['Table', 'licence'], 'licence.2']]],
				extraConditions: [
					[
						'Equals',
						['ReferencedField', 'pilot.0', 'has-licence'],
						['ReferencedField', 'licence.2', 'serial'],
					],
				],
			}),
		]);
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
	AND "pilot.0"."age" > "plane.1"."seats"
	AND "pilot.0"."has-licence" = "licence.2"."serial"
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
	AND ($2 = '{}'
	OR "plane.1"."code" = ANY(CAST($2 AS INTEGER[])))
) AS "result";`);
	});

	it('should narrow the other tables of a `(SELECT COUNT(*) ...) = 0` rule', () => {
		const query = pilotAndPlaneQuery();
		query[1] = ['Select', [['Count', '*']]];
		const rule = compileRule(['Equals', query, ['Number', 0]]);
		expect(rule.bindings).to.deep.equal([
			['Bind', 'pilot'],
			['Bind', 'plane'],
		]);
	});

	it('should still narrow the other tables when the root table is selected more than once', () => {
		const rule = compileRule([
			'NotExists',
			pilotAndPlaneQuery({
				extraConditions: [
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
			}),
		]);
		// The root table (pilot) is selected from twice so it must not be narrowed, but the plane can
		expect(rule.bindings).to.deep.equal([['Bind', 'plane']]);
	});

	it('should narrow the other tables that have `BEFORE ... ROW` triggers, which only adjust the modified row', () => {
		const rule = compileRule(['NotExists', pilotAndPlaneQuery()], (model) => {
			addPlaneTrigger(model, { when: 'BEFORE', level: 'ROW' });
		});
		expect(rule.bindings).to.deep.equal([
			['Bind', 'pilot'],
			['Bind', 'plane'],
		]);
	});

	describe('should not narrow the other tables', () => {
		it('of a `(SELECT COUNT(*) ...) = 1` rule, where whether there is a violation depends on all rows', () => {
			const query = pilotAndPlaneQuery();
			query[1] = ['Select', [['Count', '*']]];
			const rule = compileRule(['Equals', query, ['Number', 1]]);
			expect(rule.bindings).to.not.deep.include(['Bind', 'plane']);
		});

		it('of a rule that aggregates something other than `COUNT(*)`', () => {
			const query = pilotAndPlaneQuery();
			query[1] = ['Select', [['Sum', ['ReferencedField', 'plane.1', 'seats']]]];
			const rule = compileRule(['Equals', query, ['Number', 0]]);
			expect(rule.bindings).to.not.deep.include(['Bind', 'plane']);
		});

		it('of a rule with a top level join, where a table can be null', () => {
			const rule = compileRule([
				'NotExists',
				pilotAndPlaneQuery({
					extraNodes: [
						[
							'LeftJoin',
							['Alias', ['Table', 'airport'], 'airport.2'],
							[
								'On',
								[
									'Equals',
									['ReferencedField', 'plane.1', 'is based at-airport'],
									['ReferencedField', 'airport.2', 'id'],
								],
							],
						],
					],
				}),
			]);
			expect(rule.bindings).to.not.deep.include(['Bind', 'plane']);
			expect(rule.bindings).to.not.deep.include(['Bind', 'airport']);
		});

		it('of a rule that selects from a view, which can depend on any table', () => {
			const rule = compileRule(
				[
					'NotExists',
					pilotAndPlaneQuery({
						extraConditions: [
							[
								'NotExists',
								[
									'SelectQuery',
									['Select', []],
									['From', ['Alias', ['Table', 'hangar'], 'hangar.2']],
									[
										'Where',
										[
											'Equals',
											['ReferencedField', 'hangar.2', 'id'],
											['ReferencedField', 'plane.1', 'is based at-airport'],
										],
									],
								],
							],
						],
					}),
				],
				({ tables }) => {
					tables.hangar = {
						name: 'hangar',
						resourceName: 'hangar',
						idField: 'id',
						fields: [serialId()],
						indexes: [],
						primitive: false,
						viewDefinition: { abstractSql: ['Table', 'airport'] },
					};
				},
			);
			expect(rule.bindings).to.not.deep.include(['Bind', 'plane']);
		});

		it('of a rule that references a computed field, which can depend on any table', () => {
			const rule = compileRule(
				[
					'NotExists',
					pilotAndPlaneQuery({
						extraConditions: [
							[
								'Equals',
								['ReferencedField', 'plane.1', 'is full'],
								['Boolean', true],
							],
						],
					}),
				],
				({ tables }) => {
					tables.plane.fields.push({
						fieldName: 'is full',
						dataType: 'Boolean',
						computed: {
							parallel: 'SAFE',
							volatility: 'STABLE',
							definition: ['Boolean', true],
						},
					});
				},
			);
			expect(rule.bindings).to.not.deep.include(['Bind', 'plane']);
		});

		it('that have triggers other than `BEFORE ... ROW` ones, which could modify rows other than the affected ones', () => {
			for (const trigger of [
				{ when: 'AFTER', level: 'ROW' },
				{ when: 'BEFORE', level: 'STATEMENT' },
			] as const) {
				const rule = compileRule(
					['NotExists', pilotAndPlaneQuery()],
					(model) => {
						addPlaneTrigger(model, trigger);
					},
				);
				// The root table (pilot) is still narrowed
				expect(rule.bindings).to.deep.equal([['Bind', 'pilot']]);
			}
		});
	});
});
