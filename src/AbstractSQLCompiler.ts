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
import * as _ from 'lodash';
import * as Promise from 'bluebird';

export type NullNode = ['Null'];
export type DateNode = ['Date', Date];
export type DurationNode = [
	'Duration',
	{
		negative?: boolean;
		day?: Number;
		hour?: Number;
		minute?: Number;
		second?: Number;
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

export type NumberNode = ['Number', Number];
export type CountNode = ['Count', '*'];
export type NumberTypeNodes = NumberNode | CountNode | UnknownTypeNodes;

export type FieldNode = ['Field', string];
export type ReferencedFieldNode = ['ReferencedField', string, string];
export type BindNode = ['Bind', string, string?];
export interface CastNode
	extends TwoVarArgNodeType<'Cast', AbstractSqlType, string> {}
export type UnknownTypeNodes =
	| FieldNode
	| ReferencedFieldNode
	| BindNode
	| CastNode
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
		| WhereNode
		| GroupByNode
		| OrderByNode
		| LimitNode
		| OffsetNode
	>,
];
export interface UnionQueryNode
	extends VarArgNodeType<'UnionQuery', UnionQueryNode | SelectQueryNode> {}

export interface SelectNode
	extends OneArgNodeType<'Select', AbstractSqlType[]> {}
export interface FromNode
	extends OneArgNodeType<
		'From',
		| SelectQueryNode
		| UnionQueryNode
		| TableNode
		| AliasNode<SelectQueryNode | UnionQueryNode | TableNode>
	> {}
export type TableNode = ['Table', string];
export type WhereNode = ['Where', BooleanTypeNodes];
export type GroupByNode = [
	'GroupBy',
	Array<['ASC' | 'DESC', FieldNode | ReferencedFieldNode]>,
];
export type OrderByNode = [
	'OrderBy',
	...Array<['ASC' | 'DESC', FieldNode | ReferencedFieldNode]>,
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
export type RelationshipMapping = [string, [string, string]];
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
	) => any;
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
	{ dataType, required, index, defaultValue }: AbstractSqlField,
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
	if (index == null) {
		index = '';
	} else if (index !== '') {
		index = ' ' + index;
	}
	const dbType: typeof sbvrTypes[typeof dataType]['types'][typeof engine] = _.get(
		sbvrTypes,
		[dataType, 'types', engine],
	);
	if (dbType != null) {
		if (_.isFunction(dbType)) {
			return dbType(requiredStr, index);
		}
		return dbType + defaultValue + requiredStr + index;
	} else {
		throw new Error(`Unknown data type '${dataType}' for engine: ${engine}`);
	}
};

type Scope = _.Dictionary<string>;

const getScope = (rulePart: AbstractSqlQuery, scope: Scope): Scope => {
	scope = { ...scope };
	const fromNodes = rulePart.filter(node => node[0] === 'From') as FromNode[];
	fromNodes.forEach(node => {
		const nested = node[1];
		if (nested[0] === 'Alias') {
			const [, from, alias] = nested;
			if (!_.isString(alias)) {
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
	if (!_.isArray(rulePart)) {
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
			let [, tableName, fieldName] = rulePart;
			if (!_.isString(tableName) || !_.isString(fieldName)) {
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
const getReferencedFields: EngineInstance['getReferencedFields'] = ruleBody => {
	ruleBody = AbstractSQLOptimiser(ruleBody);
	const referencedFields: ReferencedFields = {};
	$getReferencedFields(referencedFields, ruleBody);

	return _.mapValues(referencedFields, _.uniq);
};

const checkQuery = (query: AbstractSqlQuery): ModifiedFields | undefined => {
	const queryType = query[0];
	if (!_.includes(['InsertQuery', 'UpdateQuery', 'DeleteQuery'], queryType)) {
		return;
	}

	const froms = _.filter(query, n => n[0] === 'From') as FromNode[];
	if (froms.length !== 1) {
		return;
	}

	const table = froms[0][1];
	let tableName: string;
	if (table[0] === 'Table') {
		tableName = table[1];
	} else if (_.isString(table)) {
		// Deprecated: Remove this when we drop implicit tables
		tableName = table;
	} else {
		return;
	}

	if (queryType in ['InsertQuery', 'DeleteQuery']) {
		return { table: tableName };
	}

	const fields = _<FieldsNode | AbstractSqlType>(query)
		.filter((v): v is FieldsNode => v != null && v[0] === 'Fields')
		.flatMap(v => v[1])
		.value() as string[];
	return { table: tableName, fields };
};
const getModifiedFields: EngineInstance['getModifiedFields'] = (
	abstractSqlQuery: AbstractSqlQuery,
) => {
	if (_.isArray(abstractSqlQuery[0])) {
		return _.map(abstractSqlQuery, checkQuery);
	} else {
		return checkQuery(abstractSqlQuery);
	}
};

const compileRule = (abstractSQL: AbstractSqlQuery, engine: Engines) => {
	abstractSQL = AbstractSQLOptimiser(abstractSQL);
	return AbstractSQLRules2SQL(abstractSQL, engine);
};

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
CREATE OR REPLACE FUNCTION "${fnName}"()
RETURNS TRIGGER AS $$
BEGIN
	${fnDefinition.body}
END;
$$ LANGUAGE ${fnDefinition.language};`);
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
		if (_.isString(table)) {
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
					_.includes(['ForeignKey', 'ConceptType'], dataType) &&
					references != null
				) {
					foreignKeys.push({ fieldName, references });
					depends.push(references.resourceName);
					hasDependants[references.resourceName] = true;
				}
			}
		}

		for (const { fieldName, references } of foreignKeys) {
			const referencedTable = abstractSqlModel.tables[references.resourceName];
			createSqlElements.push(
				`FOREIGN KEY ("${fieldName}") REFERENCES "${referencedTable.name}" ("${references.fieldName}")`,
			);
		}
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
				const triggerName = `${table.name}_${trigger.fnName}`;
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
	dropSchemaStatements = dropSchemaStatements.reverse();

	const ruleStatements: SqlRule[] = _.map(
		abstractSqlModel.rules,
		(rule): SqlRule => {
			const ruleBodyNode = _.find(rule, { 0: 'Body' }) as [
				'Body',
				AbstractSqlQuery,
			];
			if (ruleBodyNode == null || _.isString(ruleBodyNode)) {
				throw new Error('Invalid rule');
			}
			const ruleBody = ruleBodyNode[1];
			if (_.isString(ruleBody)) {
				throw new Error('Invalid rule');
			}
			const ruleSENode = _.find(rule, { 0: 'StructuredEnglish' }) as [
				'StructuredEnglish',
				string,
			];
			if (ruleSENode == null) {
				throw new Error('Invalid structured English');
			}
			const ruleSE = ruleSENode[1];
			if (!_.isString(ruleSE)) {
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
		compileRule: _.partial(compileRule, _, engine),
		dataTypeValidate,
		getReferencedFields,
		getModifiedFields,
	};
};
export const postgres = generateExport(Engines.postgres, true);
export const mysql = generateExport(Engines.mysql, true);
export const websql = generateExport(Engines.websql, false);
