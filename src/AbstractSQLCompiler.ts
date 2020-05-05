export const enum Engines {
	postgres = 'postgres',
	mysql = 'mysql',
	websql = 'websql',
}

import { AbstractSQLOptimiser } from './AbstractSQLOptimiser';
import {
	AbstractSQLRules2SQL,
	Binding,
	SqlResult,
} from './AbstractSQLRules2SQL';
export { Binding, SqlResult } from './AbstractSQLRules2SQL';
import sbvrTypes = require('@resin/sbvr-types');
import * as Promise from 'bluebird';
import * as _ from 'lodash';

export type NullNode = ['Null'];
export type DateNode = ['Date', Date];
export type DurationNode = [
	'Duration',
	{
		negative?: boolean;
		day?: number;
		hour?: number;
		minute?: number;
		second?: number;
	},
];

// The extends array hacks in the node types are because otherwise we get issues with circular refs
export interface OneArgNodeType<T, X> extends Array<T | X> {
	0: T;
	1: X;
	length: 2;
}
export interface TwoArgNodeType<T, X> extends Array<T | X> {
	0: T;
	1: X;
	2: X;
	length: 3;
}
export interface ThreeArgNodeType<T, X> extends Array<T | X> {
	0: T;
	1: X;
	2: X;
	3: X;
	length: 4;
}
export interface OneTwoArgNodeType<T, X, Y>
	extends Array<T | X | Y | undefined> {
	0: T;
	1: X;
	2?: Y;
	length: 2 | 3;
}
export interface VarArgNodeType<T, X> extends Array<T | X | undefined> {
	0: T;
	1?: X;
	2?: X;
	3?: X;
	4?: X;
	5?: X;
	6?: X;
	7?: X;
	8?: X;
	9?: X;
	10?: X;
	11?: X;
	12?: X;
	13?: X;
	14?: X;
	15?: X;
	16?: X;
	17?: X;
	18?: X;
	19?: X;
	20?: X;
	21?: X;
}
export interface TwoVarArgNodeType<T, X, Y>
	extends Array<T | X | Y | undefined> {
	0: T;
	1?: X;
	2?: Y;
	3?: Y;
	4?: Y;
	5?: Y;
	6?: Y;
	7?: Y;
	8?: Y;
	9?: Y;
	10?: Y;
	11?: Y;
	12?: Y;
	13?: Y;
	14?: Y;
	15?: Y;
	16?: Y;
	17?: Y;
	18?: Y;
	19?: Y;
	20?: Y;
	21?: Y;
}

export type BooleanNode = ['Boolean', boolean];
export interface EqualsNode extends TwoArgNodeType<'Equals', AbstractSqlType> {}
export interface NotEqualsNode
	extends TwoArgNodeType<'NotEquals', AbstractSqlType> {}
export interface GreaterThanNode
	extends TwoArgNodeType<'GreaterThan', AbstractSqlType> {}
export interface GreaterThanOrEqualNode
	extends TwoArgNodeType<'GreaterThanOrEqual', AbstractSqlType> {}
export interface LessThanNode
	extends TwoArgNodeType<'LessThan', AbstractSqlType> {}
export interface LessThanOrEqualNode
	extends TwoArgNodeType<'LessThanOrEqual', AbstractSqlType> {}
export interface InNode
	extends TwoVarArgNodeType<
		'In',
		FieldNode | ReferencedFieldNode,
		AbstractSqlType
	> {}
export interface ExistsNode extends OneArgNodeType<'Exists', AbstractSqlType> {}
export interface NotNode extends OneArgNodeType<'Not', BooleanTypeNodes> {}
export interface AndNode extends VarArgNodeType<'And', BooleanTypeNodes> {}
export interface OrNode extends VarArgNodeType<'Or', BooleanTypeNodes> {}
export type BooleanTypeNodes =
	| BooleanNode
	| EqualsNode
	| NotEqualsNode
	| GreaterThanNode
	| GreaterThanOrEqualNode
	| LessThanNode
	| LessThanOrEqualNode
	| InNode
	| ExistsNode
	| NotNode
	| AndNode
	| OrNode
	| UnknownTypeNodes;

export type NumberNode = ['Number', number];
export type CountNode = ['Count', '*'];
export type AverageNode = ['Average', NumberTypeNodes];
export type SumNode = ['Sum', NumberTypeNodes];
export type NumberTypeNodes =
	| NumberNode
	| CountNode
	| AverageNode
	| SumNode
	| UnknownTypeNodes;

export type FieldNode = ['Field', string];
export type ReferencedFieldNode = ['ReferencedField', string, string];
export type BindNode = ['Bind', string, string?];
export interface CastNode
	extends TwoVarArgNodeType<'Cast', AbstractSqlType, string> {}
export interface CoalesceNode
	extends TwoVarArgNodeType<'Coalesce', UnknownTypeNodes, UnknownTypeNodes> {}
export type UnknownTypeNodes =
	| FieldNode
	| ReferencedFieldNode
	| BindNode
	| CastNode
	| CoalesceNode
	| AbstractSqlQuery;

export type TextNode = ['Text', string];
export interface ConcatenateNode
	extends VarArgNodeType<'Concatenate', TextTypeNodes> {}
export type LikeNode = ['Like', '*'];
export interface ReplaceNode
	extends ThreeArgNodeType<'Replace', TextTypeNodes> {}
export type TextTypeNodes =
	| ConcatenateNode
	| LikeNode
	| ReplaceNode
	| UnknownTypeNodes;

export type SelectQueryNode = [
	'SelectQuery',
	...Array<
		| SelectNode
		| FromNode
		| InnerJoinNode
		| LeftJoinNode
		| RightJoinNode
		| FullJoinNode
		| CrossJoinNode
		| WhereNode
		| GroupByNode
		| OrderByNode
		| LimitNode
		| OffsetNode
	>
];
export interface UnionQueryNode
	extends VarArgNodeType<'UnionQuery', UnionQueryNode | SelectQueryNode> {}

type FromTypeNodes =
	| SelectQueryNode
	| UnionQueryNode
	| TableNode
	| AliasNode<SelectQueryNode | UnionQueryNode | TableNode>;

export interface SelectNode
	extends OneArgNodeType<'Select', AbstractSqlType[]> {}
export interface FromNode extends OneArgNodeType<'From', FromTypeNodes> {}
export interface InnerJoinNode
	extends OneTwoArgNodeType<'Join', FromTypeNodes, OnNode> {}
export interface LeftJoinNode
	extends OneTwoArgNodeType<'LeftJoin', FromTypeNodes, OnNode> {}
export interface RightJoinNode
	extends OneTwoArgNodeType<'RightJoin', FromTypeNodes, OnNode> {}
export interface FullJoinNode
	extends OneTwoArgNodeType<'FullJoin', FromTypeNodes, OnNode> {}
export interface CrossJoinNode
	extends OneArgNodeType<'CrossJoin', FromTypeNodes> {}
export type OnNode = ['On', BooleanTypeNodes];
export type TableNode = ['Table', string];
export type WhereNode = ['Where', BooleanTypeNodes];
export type GroupByNode = [
	'GroupBy',
	Array<['ASC' | 'DESC', FieldNode | ReferencedFieldNode]>,
];
export type OrderByNode = [
	'OrderBy',
	...Array<['ASC' | 'DESC', FieldNode | ReferencedFieldNode]>
];
export type LimitNode = ['Limit', NumberTypeNodes];
export type OffsetNode = ['Offset', NumberTypeNodes];
export type FieldsNode = ['Fields', string[]];
export type ValuesNode = [
	'Values',
	SelectQueryNode | UnionQueryNode | ValuesNodeTypes[],
];
export type ValuesNodeTypes =
	| 'Default'
	| NullNode
	| BindNode
	| TextNode
	| NumberNode;

export type AliasNode<T> = ['Alias', T, string];

export type AbstractSqlType =
	| string
	| NullNode
	| DateNode
	| BooleanTypeNodes
	| NumberTypeNodes
	| TextTypeNodes
	| UnknownTypeNodes
	| DurationNode
	| AbstractSqlQuery
	| SelectQueryNode
	| SelectNode
	| ValuesNode;
export interface AbstractSqlQuery extends Array<AbstractSqlType> {
	0: string;
}

export interface AbstractSqlField {
	fieldName: string;
	dataType: string;
	required?: boolean;
	index?: string;
	references?: {
		resourceName: string;
		fieldName: string;
	};
	defaultValue?: string;
	necessity: boolean;
	computed?: AbstractSqlQuery;
	checks?: BooleanTypeNodes[];
}
export interface Trigger {
	operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE';
	fnName: string;
	level: 'ROW' | 'STATEMENT';
	when: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
}
export interface AbstractSqlTable {
	name: string;
	resourceName: string;
	idField: string;
	fields: AbstractSqlField[];
	indexes: Array<{
		type: string;
		fields: string[];
	}>;
	primitive: false | string;
	triggers?: Trigger[];
}
export interface ReferencedFields {
	[alias: string]: string[];
}
export interface SqlRule {
	sql: string;
	bindings: Binding[];
	structuredEnglish: string;
	referencedFields?: ReferencedFields;
}
/**
 * The RelationshipMapping can either describe a relationship to another term, or
 * a relationship to a local term (since simple terms are also defined and referenced).
 * A local term basically describes the fields of the term that are available.
 *
 *   - RelationshipMapping[0] is the local field
 *
 * If this relationship points to a foreign term (a different table)
 *
 *   - RelationshipMapping[1] is the reference to the other resource, that joins this resource
 *   - RelationshipMapping[1][0] is the name of the other resource (or the other table)
 *   - RelationshipMapping[1][1] is the name of the field on the other resource
 */
export type RelationshipMapping = [string, [string, string]?];
export interface Relationship {
	$: RelationshipMapping;
	// TODO: This should action be just Relationship, but we can't declare that in typescript currently
	[resourceName: string]: Relationship | RelationshipMapping;
}
export interface AbstractSqlModel {
	synonyms: {
		[synonym: string]: string;
	};
	relationships: {
		[resourceName: string]: Relationship;
	};
	tables: {
		[resourceName: string]: AbstractSqlTable;
	};
	rules: AbstractSqlQuery[];
	functions?: _.Dictionary<{
		type: 'trigger';
		body: string;
		language: 'plpgsql';
	}>;
}
export interface SqlModel {
	synonyms: {
		[synonym: string]: string;
	};
	relationships: {
		[resourceName: string]: Relationship;
	};
	tables: {
		[resourceName: string]: AbstractSqlTable;
	};
	rules: SqlRule[];
	createSchema: string[];
	dropSchema: string[];
}

export interface ModifiedFields {
	table: string;
	fields?: string[];
}

export interface EngineInstance {
	compileSchema: (abstractSqlModel: AbstractSqlModel) => SqlModel;
	compileRule: (abstractSQL: AbstractSqlQuery) => SqlResult | SqlResult[];
	dataTypeValidate: (
		value: any,
		field: Pick<AbstractSqlField, 'dataType' | 'required'>,
	) => Promise<any>;
	getReferencedFields: (ruleBody: AbstractSqlQuery) => ReferencedFields;
	getModifiedFields: (
		abstractSqlQuery: AbstractSqlQuery,
	) => undefined | ModifiedFields | Array<undefined | ModifiedFields>;
}

const validateTypes = _.mapValues(sbvrTypes, ({ validate }) => validate);

const dataTypeValidate: EngineInstance['dataTypeValidate'] = (value, field) => {
	// In case one of the validation types throws an error.
	const { dataType, required } = field;
	const validateFn = validateTypes[dataType];
	if (validateFn != null) {
		return validateFn(value, required);
	} else {
		return Promise.reject(new Error('is an unsupported type: ' + dataType));
	}
};

const dataTypeGen = (
	engine: Engines,
	{ dataType, required, index, defaultValue, checks }: AbstractSqlField,
): string => {
	let requiredStr;
	if (required) {
		requiredStr = ' NOT NULL';
	} else {
		requiredStr = ' NULL';
	}
	if (defaultValue != null) {
		defaultValue = ` DEFAULT ${defaultValue}`;
	} else {
		defaultValue = '';
	}
	let checksString = '';
	if (checks != null) {
		checksString = checks
			.map((check) => {
				return ` CHECK (${compileRule(
					check as AbstractSqlQuery,
					engine,
					true,
				)})`;
			})
			.join('');
	}
	if (index == null) {
		index = '';
	} else if (index !== '') {
		index = ' ' + index;
	}
	const dbType = sbvrTypes?.[dataType]?.types?.[engine];
	if (dbType != null) {
		if (typeof dbType === 'function') {
			return dbType(requiredStr, index);
		}
		return dbType + defaultValue + requiredStr + checksString + index;
	} else {
		throw new Error(`Unknown data type '${dataType}' for engine: ${engine}`);
	}
};

type Scope = _.Dictionary<string>;

const getScope = (rulePart: AbstractSqlQuery, scope: Scope): Scope => {
	scope = { ...scope };
	const fromNodes = rulePart.filter((node) => node[0] === 'From') as FromNode[];
	fromNodes.forEach((node) => {
		const nested = node[1];
		if (nested[0] === 'Alias') {
			const [, from, alias] = nested;
			if (typeof alias !== 'string') {
				throw new Error('Cannot handle non-string aliases');
			}
			switch (from[0]) {
				case 'Table':
					scope[alias] = from[1];
					break;
				case 'SelectQuery':
					// Ignore SelectQuery in the From as we'll handle any fields it selects
					// when we recurse in. With true scope handling however we could prune
					// fields that don't affect the end result and avoid false positives
					scope[alias] = '';
					break;
				default:
					throw new Error(`Cannot handle aliased ${from[0]} nodes`);
			}
		} else if (nested[0] === 'Table') {
			scope[nested[1]] = nested[1];
		} else {
			throw Error(`Unsupported FromNode for scoping: ${nested[0]}`);
		}
	});
	return scope;
};
const $getReferencedFields = (
	referencedFields: ReferencedFields,
	rulePart: AbstractSqlQuery,
	scope: Scope = {},
) => {
	if (!Array.isArray(rulePart)) {
		return;
	}
	switch (rulePart[0]) {
		case 'SelectQuery':
			// Update the current scope before trying to resolve field references
			scope = getScope(rulePart, scope);
			rulePart.forEach((node: AbstractSqlQuery) => {
				$getReferencedFields(referencedFields, node, scope);
			});
			break;
		case 'ReferencedField':
			let tableName = rulePart[1];
			const fieldName = rulePart[2];
			if (typeof tableName !== 'string' || typeof fieldName !== 'string') {
				throw new Error(`Invalid ReferencedField: ${rulePart}`);
			}
			tableName = scope[tableName];
			// The scoped tableName is empty in the case of an aliased from query
			// and those fields will be covered when we recurse into them
			if (tableName !== '') {
				if (referencedFields[tableName] == null) {
					referencedFields[tableName] = [];
				}
				referencedFields[tableName].push(fieldName);
			}
			return;
		case 'Field':
			throw new Error('Cannot find queried fields for unreferenced fields');
		default:
			rulePart.forEach((node: AbstractSqlQuery) => {
				$getReferencedFields(referencedFields, node, scope);
			});
	}
};
const getReferencedFields: EngineInstance['getReferencedFields'] = (
	ruleBody,
) => {
	ruleBody = AbstractSQLOptimiser(ruleBody);
	const referencedFields: ReferencedFields = {};
	$getReferencedFields(referencedFields, ruleBody);

	return _.mapValues(referencedFields, _.uniq);
};

const checkQuery = (query: AbstractSqlQuery): ModifiedFields | undefined => {
	const queryType = query[0];
	if (!['InsertQuery', 'UpdateQuery', 'DeleteQuery'].includes(queryType)) {
		return;
	}

	const froms = query.filter((n) => n[0] === 'From') as FromNode[];
	if (froms.length !== 1) {
		return;
	}

	const table = froms[0][1];
	let tableName: string;
	if (table[0] === 'Table') {
		tableName = table[1];
	} else if (typeof table === 'string') {
		// Deprecated: Remove this when we drop implicit tables
		tableName = table;
	} else {
		return;
	}

	if (['InsertQuery', 'DeleteQuery'].includes(queryType)) {
		return { table: tableName };
	}

	const fields = _<FieldsNode | AbstractSqlType>(query)
		.filter((v): v is FieldsNode => v != null && v[0] === 'Fields')
		.flatMap((v) => v[1])
		.value() as string[];
	return { table: tableName, fields };
};
const getModifiedFields: EngineInstance['getModifiedFields'] = (
	abstractSqlQuery: AbstractSqlQuery,
) => {
	if (Array.isArray(abstractSqlQuery[0])) {
		return abstractSqlQuery.map(checkQuery);
	} else {
		return checkQuery(abstractSqlQuery);
	}
};

export function compileRule(
	abstractSQL: AbstractSqlQuery,
	engine: Engines,
	noBinds: true,
): string;
export function compileRule(
	abstractSQL: AbstractSqlQuery,
	engine: Engines,
	noBinds?: false,
): SqlResult | SqlResult[];
export function compileRule(
	abstractSQL: AbstractSqlQuery,
	engine: Engines,
	noBinds?: boolean,
): SqlResult | SqlResult[] | string;
export function compileRule(
	abstractSQL: AbstractSqlQuery,
	engine: Engines,
	noBinds = false,
): SqlResult | SqlResult[] | string {
	abstractSQL = AbstractSQLOptimiser(abstractSQL, noBinds);
	return AbstractSQLRules2SQL(abstractSQL, engine, noBinds);
}

const compileSchema = (
	abstractSqlModel: AbstractSqlModel,
	engine: Engines,
	ifNotExists: boolean,
): SqlModel => {
	let ifNotExistsStr = '';
	if (ifNotExists) {
		ifNotExistsStr = 'IF NOT EXISTS ';
	}

	const createSchemaStatements: string[] = [];
	const alterSchemaStatements: string[] = [];
	let dropSchemaStatements: string[] = [];

	const fns: _.Dictionary<true> = {};
	if (abstractSqlModel.functions) {
		_.forEach(abstractSqlModel.functions, (fnDefinition, fnName) => {
			if (engine !== Engines.postgres) {
				throw new Error('Functions are only supported on postgres currently');
			}
			if (fnDefinition.language !== 'plpgsql') {
				throw new Error('Only plpgsql functions currently supported');
			}
			if (fnDefinition.type !== 'trigger') {
				throw new Error('Only trigger functions currently supported');
			}
			fns[fnName] = true;
			createSchemaStatements.push(`\
DO $$
BEGIN
	PERFORM '"${fnName}"()'::regprocedure;
EXCEPTION WHEN undefined_function THEN
	CREATE FUNCTION "${fnName}"()
	RETURNS TRIGGER AS $fn$
	BEGIN
		${fnDefinition.body}
	END;
	$fn$ LANGUAGE ${fnDefinition.language};
END;
$$;`);
			dropSchemaStatements.push(`DROP FUNCTION "${fnName}"();`);
		});
	}

	const hasDependants: {
		[dependant: string]: true;
	} = {};
	const schemaDependencyMap: {
		[resourceName: string]: {
			resourceName: string;
			primitive: AbstractSqlTable['primitive'];
			createSQL: string[];
			dropSQL: string[];
			depends: string[];
		};
	} = {};
	_.forOwn(abstractSqlModel.tables, (table, resourceName) => {
		if (typeof table === 'string') {
			return;
		}
		const foreignKeys = [];
		const depends = [];
		const createSqlElements = [];

		for (const field of table.fields) {
			const { fieldName, references, dataType, computed } = field;
			if (!computed) {
				createSqlElements.push(
					'"' + fieldName + '" ' + dataTypeGen(engine, field),
				);
				if (
					['ForeignKey', 'ConceptType'].includes(dataType) &&
					references != null
				) {
					const referencedTable =
						abstractSqlModel.tables[references.resourceName];
					const fkDefinition = `FOREIGN KEY ("${fieldName}") REFERENCES "${referencedTable.name}" ("${references.fieldName}")`;

					const schemaInfo = schemaDependencyMap[references.resourceName];
					if (schemaInfo && schemaInfo.depends.includes(table.resourceName)) {
						if (engine !== Engines.postgres) {
							throw new Error(
								'Circular dependencies are only supported on postgres currently',
							);
						}
						// It's a simple circular dependency so we switch it to an ALTER TABLE
						alterSchemaStatements.push(`\
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu USING (constraint_catalog, constraint_schema, constraint_name)
		JOIN information_schema.constraint_column_usage ccu USING (constraint_catalog, constraint_schema, constraint_name)
		WHERE constraint_type = 'FOREIGN KEY'
			AND tc.table_schema = CURRENT_SCHEMA()
			AND tc.table_name = '${table.name}'
			AND kcu.column_name = '${fieldName}'
			AND ccu.table_schema = CURRENT_SCHEMA()
			AND ccu.table_name = '${referencedTable.name}'
			AND ccu.column_name = '${references.fieldName}'
	) THEN
		ALTER TABLE "${table.name}"
		ADD CONSTRAINT "${table.name}_${fieldName}_fkey"
		${fkDefinition};
	END IF;
END;
$$;`);
					} else {
						foreignKeys.push(fkDefinition);
						depends.push(references.resourceName);
						hasDependants[references.resourceName] = true;
					}
				}
			}
		}

		createSqlElements.push(...foreignKeys);
		for (const index of table.indexes) {
			createSqlElements.push(
				index.type + '("' + index.fields.join('", "') + '")',
			);
		}

		const createTriggers = [];
		const dropTriggers = [];
		if (table.triggers) {
			for (const trigger of table.triggers) {
				if (!fns[trigger.fnName]) {
					throw new Error(`No such function '${trigger.fnName}' declared`);
				}
				// Trim the trigger name to a max of 63 characters
				const triggerName = `${table.name}_${trigger.fnName}`.slice(0, 63);
				createTriggers.push(`\
DO
$$
BEGIN
IF NOT EXISTS(
	SELECT 1
	FROM "information_schema"."triggers"
	WHERE "event_object_table" = '${table.name}'
	AND "trigger_name" = '${triggerName}'
) THEN
	CREATE TRIGGER "${triggerName}"
	${trigger.when} ${trigger.operation} ON "${table.name}"
	FOR EACH ${trigger.level}
	EXECUTE PROCEDURE "${trigger.fnName}"();
END IF;
END;
$$`);
				dropTriggers.push(`DROP TRIGGER "${triggerName}";`);
			}
		}

		schemaDependencyMap[table.resourceName] = {
			resourceName,
			primitive: table.primitive,
			createSQL: [
				`\
CREATE TABLE ${ifNotExistsStr}"${table.name}" (
	${createSqlElements.join('\n,\t')}
);`,
				...createTriggers,
			],
			dropSQL: [...dropTriggers, `DROP TABLE "${table.name}";`],
			depends,
		};
	});

	let resourceNames: string[] = [];
	while (
		resourceNames.length !==
			(resourceNames = Object.keys(schemaDependencyMap)).length &&
		resourceNames.length > 0
	) {
		for (const resourceName of resourceNames) {
			const schemaInfo = schemaDependencyMap[resourceName];
			let unsolvedDependency = false;
			for (const dependency of schemaInfo.depends) {
				// Self-dependencies are ok.
				if (
					dependency !== resourceName &&
					schemaDependencyMap.hasOwnProperty(dependency)
				) {
					unsolvedDependency = true;
					break;
				}
			}
			if (unsolvedDependency === false) {
				if (
					schemaInfo.primitive === false ||
					hasDependants[resourceName] != null
				) {
					if (schemaInfo.primitive !== false) {
						console.warn(
							"We're adding a primitive table??",
							schemaInfo.resourceName,
						);
					}
					createSchemaStatements.push(...schemaInfo.createSQL);
					dropSchemaStatements.push(...schemaInfo.dropSQL);
				}
				delete schemaDependencyMap[resourceName];
			}
		}
	}
	if (_.size(schemaDependencyMap) > 0) {
		console.error(
			'Failed to resolve all schema dependencies',
			schemaDependencyMap,
		);
		throw new Error('Failed to resolve all schema dependencies');
	}
	createSchemaStatements.push(...alterSchemaStatements);
	dropSchemaStatements = dropSchemaStatements.reverse();

	const ruleStatements: SqlRule[] = abstractSqlModel.rules.map(
		(rule): SqlRule => {
			const ruleBodyNode = rule.find((r) => r[0] === 'Body') as [
				'Body',
				AbstractSqlQuery,
			];
			if (ruleBodyNode == null || typeof ruleBodyNode === 'string') {
				throw new Error('Invalid rule');
			}
			const ruleBody = ruleBodyNode[1];
			if (typeof ruleBody === 'string') {
				throw new Error('Invalid rule');
			}
			const ruleSENode = rule.find((r) => r[0] === 'StructuredEnglish') as [
				'StructuredEnglish',
				string,
			];
			if (ruleSENode == null) {
				throw new Error('Invalid structured English');
			}
			const ruleSE = ruleSENode[1];
			if (typeof ruleSE !== 'string') {
				throw new Error('Invalid structured English');
			}
			const { query: ruleSQL, bindings: ruleBindings } = compileRule(
				ruleBody,
				engine,
			) as SqlResult;
			let referencedFields: ReferencedFields | undefined;
			try {
				referencedFields = getReferencedFields(ruleBody);
			} catch (e) {
				console.warn('Error fetching referenced fields', e);
			}

			return {
				structuredEnglish: ruleSE,
				sql: ruleSQL,
				bindings: ruleBindings,
				referencedFields,
			};
		},
	);

	return {
		synonyms: abstractSqlModel.synonyms,
		relationships: abstractSqlModel.relationships,
		tables: abstractSqlModel.tables,
		createSchema: createSchemaStatements,
		dropSchema: dropSchemaStatements,
		rules: ruleStatements,
	};
};

const generateExport = (engine: Engines, ifNotExists: boolean) => {
	return {
		compileSchema: _.partial(compileSchema, _, engine, ifNotExists),
		compileRule: (abstractSQL: AbstractSqlQuery) =>
			compileRule(abstractSQL, engine, false),
		dataTypeValidate,
		getReferencedFields,
		getModifiedFields,
	};
};
export const postgres = generateExport(Engines.postgres, true);
export const mysql = generateExport(Engines.mysql, true);
export const websql = generateExport(Engines.websql, false);
