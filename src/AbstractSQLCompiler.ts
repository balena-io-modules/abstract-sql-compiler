export const enum Engines {
	/* eslint-disable @typescript-eslint/no-shadow -- this is fine since we only assign plain string values to the enum items */
	postgres = 'postgres',
	mysql = 'mysql',
	websql = 'websql',
	/* eslint-enable @typescript-eslint/no-shadow */
}

import { AbstractSQLOptimiser } from './AbstractSQLOptimiser';
import type { Binding, SqlResult } from './AbstractSQLRules2SQL';
import { AbstractSQLRules2SQL } from './AbstractSQLRules2SQL';
export { Binding, SqlResult } from './AbstractSQLRules2SQL';
import type { SbvrType } from '@balena/sbvr-types';
import sbvrTypes from '@balena/sbvr-types';
import * as _ from 'lodash';
import { optimizeSchema, generateRuleSlug } from './AbstractSQLSchemaOptimiser';
import type {
	ReferencedFields,
	RuleReferencedFields,
	ModifiedFields,
} from './referenced-fields';
import {
	getReferencedFields,
	getRuleReferencedFields,
	getModifiedFields,
	insertAffectedIdsBinds,
} from './referenced-fields';

export type { ReferencedFields, RuleReferencedFields, ModifiedFields };

export type NullNode = ['Null'];
export type DateNode = ['Date', Date | number | string];
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
export type StrictDurationTypeNodes = DurationNode;
export type DurationTypeNodes = StrictDurationTypeNodes | UnknownTypeNodes;

export type BooleanNode = ['Boolean', boolean];
export type EqualsNode = ['Equals', AnyTypeNodes, AnyTypeNodes];
export type NotEqualsNode = ['NotEquals', AnyTypeNodes, AnyTypeNodes];
export type IsDistinctFromNode = ['IsDistinctFrom', AnyTypeNodes, AnyTypeNodes];
export type IsNotDistinctFromNode = [
	'IsNotDistinctFrom',
	AnyTypeNodes,
	AnyTypeNodes,
];
export type GreaterThanNode = ['GreaterThan', AnyTypeNodes, AnyTypeNodes];
export type GreaterThanOrEqualNode = [
	'GreaterThanOrEqual',
	AnyTypeNodes,
	AnyTypeNodes,
];
export type LessThanNode = ['LessThan', AnyTypeNodes, AnyTypeNodes];
export type LessThanOrEqualNode = [
	'LessThanOrEqual',
	AnyTypeNodes,
	AnyTypeNodes,
];
export type BetweenNode = ['Between', AnyTypeNodes, AnyTypeNodes, AnyTypeNodes];
export type LikeNode = ['Like', AnyTypeNodes, AnyTypeNodes];
export type InNode = [
	'In',
	FieldNode | ReferencedFieldNode,
	AnyTypeNodes,
	...AnyTypeNodes[],
];
export type NotInNode = [
	'NotIn',
	FieldNode | ReferencedFieldNode,
	AnyTypeNodes,
	...AnyTypeNodes[],
];
export type NotExistsNode = ['NotExists', AnyTypeNodes];
export type ExistsNode = ['Exists', AnyTypeNodes];
export type NotNode = ['Not', BooleanTypeNodes];
export type AndNode = ['And', ...BooleanTypeNodes[]];
export type OrNode = ['Or', ...BooleanTypeNodes[]];
export type StartsWithNode = ['StartsWith', TextTypeNodes, TextTypeNodes];
export type EndsWithNode = ['EndsWith', TextTypeNodes, TextTypeNodes];
export type ContainsNode = ['Contains', TextTypeNodes, TextTypeNodes];
export type StrictBooleanTypeNodes =
	| BooleanNode
	| EqualsNode
	| NotEqualsNode
	| IsDistinctFromNode
	| IsNotDistinctFromNode
	| GreaterThanNode
	| GreaterThanOrEqualNode
	| LessThanNode
	| LessThanOrEqualNode
	| BetweenNode
	| LikeNode
	| InNode
	| NotInNode
	| ExistsNode
	| NotExistsNode
	| NotNode
	| AndNode
	| OrNode
	| StartsWithNode
	| EndsWithNode
	| ContainsNode;
export type BooleanTypeNodes = StrictBooleanTypeNodes | UnknownTypeNodes;

export type YearNode = ['Year', DateTypeNodes];
export type MonthNode = ['Month', DateTypeNodes];
export type DayNode = ['Day', DateTypeNodes];
export type HourNode = ['Hour', DateTypeNodes];
export type MinuteNode = ['Minute', DateTypeNodes];
export type SecondNode = ['Second', DateTypeNodes];
export type FractionalsecondsNode = ['Fractionalseconds', DateTypeNodes];
export type ExtractNumericDateTypeNodes =
	| YearNode
	| MonthNode
	| DayNode
	| HourNode
	| MinuteNode
	| SecondNode
	| FractionalsecondsNode;
export type TotalsecondsNode = ['Totalseconds', DurationTypeNodes];

export type IntegerNode = ['Integer', number];
export type RealNode = ['Real', number];
export type NumberNode = ['Number', number];
export type AddNode = ['Add', NumberTypeNodes, NumberTypeNodes];
export type SubtractNode = ['Subtract', NumberTypeNodes, NumberTypeNodes];
export type MultiplyNode = ['Multiply', NumberTypeNodes, NumberTypeNodes];
export type DivideNode = ['Divide', NumberTypeNodes, NumberTypeNodes];
export type StrPosNode = ['StrPos', TextTypeNodes, TextTypeNodes];
export type RoundNode = ['Round', NumberTypeNodes];
export type FloorNode = ['Floor', NumberTypeNodes];
export type CeilingNode = ['Ceiling', NumberTypeNodes];
export type CountNode = ['Count', '*'];
export type AverageNode = ['Average', NumberTypeNodes];
export type SumNode = ['Sum', NumberTypeNodes];
export type CharacterLengthNode = ['CharacterLength', TextTypeNodes];
export type BitwiseAndNode = ['BitwiseAnd', NumberTypeNodes, NumberTypeNodes];
export type BitwiseShiftRightNode = [
	'BitwiseShiftRight',
	NumberTypeNodes,
	NumberTypeNodes,
];
export type StrictNumberTypeNodes =
	| NumberNode
	| IntegerNode
	| RealNode
	| AddNode
	| SubtractNode
	| MultiplyNode
	| DivideNode
	| StrPosNode
	| ExtractNumericDateTypeNodes
	| TotalsecondsNode
	| RoundNode
	| FloorNode
	| CeilingNode
	| CountNode
	| AverageNode
	| SumNode
	| BitwiseAndNode
	| BitwiseShiftRightNode
	| CharacterLengthNode
	| SubtractDateDateNode;
export type NumberTypeNodes = StrictNumberTypeNodes | UnknownTypeNodes;

export type FieldNode = ['Field', string];
export type ReferencedFieldNode = ['ReferencedField', string, string];
export type DateTruncNode = ['DateTrunc', TextTypeNodes, DateTypeNodes];
export type ToDateNode = ['ToDate', DateTypeNodes];
export type ToTimeNode = ['ToTime', DateTypeNodes];
export type CurrentTimestampNode = ['CurrentTimestamp'];
export type CurrentDateNode = ['CurrentDate'];
export type StrictDateTypeNodes =
	| DateNode
	| ToDateNode
	| ToTimeNode
	| CurrentTimestampNode
	| CurrentDateNode
	| DateTruncNode
	| SubtractDateNumberNode
	| SubtractDateDurationNode
	| AddDateTypeNodes;
export type DateTypeNodes = StrictDateTypeNodes | UnknownTypeNodes;

// Date operations return different types dependent on the operand types
// here we explicitly type the different nodes by the input types
// timestamp, datetime, date are use synonymous here and all are simplified under date node
// returns integer
export type SubtractDateDateNode = [
	'SubtractDateDate',
	DateTypeNodes,
	DateTypeNodes,
];
// returns date
export type SubtractDateNumberNode = [
	'SubtractDateNumber',
	DateTypeNodes,
	NumberTypeNodes,
];
// returns date (timestamp)
export type SubtractDateDurationNode = [
	'SubtractDateDuration',
	DateTypeNodes,
	DurationNode,
];
export type AddDateTypeNodes = AddDateNumberNode | AddDateDurationNode;
// returns date
export type AddDateNumberNode = [
	'AddDateNumber',
	DateTypeNodes,
	NumberTypeNodes,
];
// return date
export type AddDateDurationNode = [
	'AddDateDuration',
	DateTypeNodes,
	DurationNode,
];

export type WhenNode = ['When', BooleanTypeNodes, AnyTypeNodes];
export type ElseNode = ['Else', AnyTypeNodes];
export type CaseNode =
	| ['Case', ...WhenNode[]]
	| ['Case', ...WhenNode[], ElseNode];

export type BindNode = ['Bind', number | string] | ['Bind', string, string];
export type CastNode = ['Cast', AnyTypeNodes, string];
export type CoalesceNode = [
	'Coalesce',
	AnyTypeNodes,
	AnyTypeNodes,
	...AnyTypeNodes[],
];
export type AnyNode = ['Any', AnyTypeNodes, string];
export type UnknownTypeNodes =
	| SelectQueryNode
	| UnionQueryNode
	| NullNode
	| FieldNode
	| ReferencedFieldNode
	| BindNode
	| CastNode
	| CaseNode
	| CoalesceNode
	| AnyNode;

export type ToJSONNode = ['ToJSON', AnyTypeNodes];
export type AggregateJSONNode = [
	'AggregateJSON',
	FieldNode | ReferencedFieldNode,
];
export type StrictJSONTypeNodes = AggregateJSONNode | ToJSONNode;
export type JSONTypeNodes = StrictJSONTypeNodes | UnknownTypeNodes;

export type EmbeddedTextNode = ['EmbeddedText', string];
export type TextNode = ['Text', string];
export type ConcatenateNode = [
	'Concatenate',
	TextTypeNodes,
	...TextTypeNodes[],
];
export type ConcatenateWithSeparatorNode = [
	'ConcatenateWithSeparator',
	TextTypeNodes,
	TextTypeNodes,
	...TextTypeNodes[],
];
export type LowerNode = ['Lower', TextTypeNodes];
export type UpperNode = ['Upper', TextTypeNodes];
export type TrimNode = ['Trim', TextTypeNodes];
export type SubstringNode = [
	'Substring',
	TextTypeNodes,
	NumberTypeNodes,
	NumberTypeNodes?,
];
export type RightNode = ['Right', TextTypeNodes, NumberTypeNodes];
export type ReplaceNode = [
	'Replace',
	TextTypeNodes,
	TextTypeNodes,
	TextTypeNodes,
];
export type ExtractJSONPathAsTextNode = [
	'ExtractJSONPathAsText',
	JSONTypeNodes,
	TextArrayTypeNodes,
];
export type EscapeForLikeNode = ['EscapeForLike', TextTypeNodes];
export type StrictTextArrayTypeNodes = TextArrayNode;
export type TextArrayTypeNodes = StrictTextArrayTypeNodes | UnknownTypeNodes;
export type TextArrayNode = ['TextArray', ...TextTypeNodes[]];
export type StrictTextTypeNodes =
	| TextNode
	| EmbeddedTextNode
	| ConcatenateNode
	| ConcatenateWithSeparatorNode
	| LowerNode
	| UpperNode
	| TrimNode
	| SubstringNode
	| RightNode
	| ReplaceNode
	| ExtractJSONPathAsTextNode
	| EscapeForLikeNode;
export type TextTypeNodes = StrictTextTypeNodes | UnknownTypeNodes;

export type JoinTypeNodes =
	| InnerJoinNode
	| LeftJoinNode
	| RightJoinNode
	| FullJoinNode
	| CrossJoinNode;

export type SelectQueryStatementNode =
	| SelectNode
	| FromNode
	| JoinTypeNodes
	| WhereNode
	| GroupByNode
	| HavingNode
	| OrderByNode
	| LimitNode
	| OffsetNode;
export type SelectQueryNode = ['SelectQuery', ...SelectQueryStatementNode[]];
export type UnionQueryNode = [
	'UnionQuery',
	// eslint-disable-next-line @typescript-eslint/array-type -- Typescript fails on a circular reference when prettier changes this to an `Array<T>` form
	...(UnionQueryNode | SelectQueryNode)[],
];
export type InsertQueryNode = [
	'InsertQuery',
	...Array<FromNode | FieldsNode | ValuesNode | WhereNode>,
];
export type UpdateQueryNode = [
	'UpdateQuery',
	...Array<FromNode | FieldsNode | ValuesNode | WhereNode>,
];
export type DeleteQueryNode = ['DeleteQuery', ...Array<FromNode | WhereNode>];
export type UpsertQueryNode = ['UpsertQuery', InsertQueryNode, UpdateQueryNode];

/**
 * This interface allows adding to the valid set of FromTypeNodes using interface merging, eg
 * declare module '@balena/abstract-sql-compiler' {
 * 	interface FromTypeNode {
 * 		MyNode: MyNode;
 * 	}
 * }
 */
export interface FromTypeNode {
	SelectQueryNode: SelectQueryNode;
	UnionQueryNode: UnionQueryNode;
	TableNode: TableNode;
	ResourceNode: ResourceNode;
}
/**
 * This is not currently understood by the abstract-sql-compiler but is a placeholder for future support
 */
export type ResourceNode = ['Resource', string];

export type FromTypeNodes =
	| FromTypeNode[keyof FromTypeNode]
	| AliasNode<FromTypeNode[keyof FromTypeNode]>;

/**
 * @deprecated `FromTypeNodes` already includes aliased versions
 */
export type AliasableFromTypeNodes = FromTypeNodes;

export type SelectNode = ['Select', AnyTypeNodes[]];
export type FromNode = ['From', FromTypeNodes];
export type InnerJoinNode = ['Join', FromTypeNodes, OnNode?];
export type LeftJoinNode = ['LeftJoin', FromTypeNodes, OnNode?];
export type RightJoinNode = ['RightJoin', FromTypeNodes, OnNode?];
export type FullJoinNode = ['FullJoin', FromTypeNodes, OnNode?];
export type CrossJoinNode = ['CrossJoin', FromTypeNodes];
export type OnNode = ['On', BooleanTypeNodes];
export type TableNode = ['Table', string];
export type WhereNode = ['Where', BooleanTypeNodes];
export type GroupByNode = ['GroupBy', Array<FieldNode | ReferencedFieldNode>];
export type HavingNode = ['Having', BooleanTypeNodes];
type OrderBy = ['ASC' | 'DESC', AnyTypeNodes];
export type OrderByNode = ['OrderBy', ...OrderBy[]];
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
	| EmbeddedTextNode
	| NumberNode
	| IntegerNode
	| RealNode
	| BooleanNode;

export type AliasNode<T> = ['Alias', T, string];

export type AnyTypeNodes =
	| DateTypeNodes
	| BooleanTypeNodes
	| NumberTypeNodes
	| TextTypeNodes
	| JSONTypeNodes
	| TextArrayTypeNodes
	| UnknownTypeNodes
	| DurationNode
	| InsertQueryNode
	| UpdateQueryNode
	| DeleteQueryNode
	| UpsertQueryNode
	| ValuesNode
	| SelectQueryStatementNode
	| FromTypeNodes
	| UnknownNode;

export type AbstractSqlType = string | string[] | AnyTypeNodes;

export type UnknownNode = AbstractSqlQuery;
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
		type?: string;
	};
	defaultValue?: string;
	computed?: AbstractSqlQuery;
	checks?: BooleanTypeNodes[];
}
export interface Trigger {
	operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE';
	fnName: string;
	level: 'ROW' | 'STATEMENT';
	when: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
}
export interface Index {
	type: string;
	fields: string[];
	name?: string;
	/** For rules converted to partial unique indexes this holds the actual rule expression */
	description?: string;
	distinctNulls?: boolean;
	predicate?: BooleanTypeNodes;
}
export interface Check {
	description?: string;
	name?: string;
	abstractSql: BooleanTypeNodes;
}
export interface BindVars extends Array<any> {
	[key: string]: any;
}
export interface Definition {
	binds?: BindVars;
	abstractSql: FromTypeNodes;
}
export interface AbstractSqlTable {
	name: string;
	resourceName: string;
	idField: string;
	fields: AbstractSqlField[];
	indexes: Index[];
	primitive: false | string;
	triggers?: Trigger[];
	checks?: Check[];
	definition?: Definition;
	modifyFields?: AbstractSqlTable['fields'];
	modifyName?: AbstractSqlTable['name'];
}
export interface SqlRule {
	sql: string;
	bindings: Binding[];
	structuredEnglish: string;
	referencedFields?: ReferencedFields | undefined;
	ruleReferencedFields?: RuleReferencedFields | undefined;
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
export interface RelationshipLeafNode {
	$: RelationshipMapping;
}
export interface RelationshipInternalNode {
	[resourceName: string]: Relationship;
}
export type Relationship = RelationshipLeafNode | RelationshipInternalNode;
export interface AbstractSqlModel {
	synonyms: {
		[synonym: string]: string;
	};
	relationships: {
		[resourceName: string]: RelationshipInternalNode;
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
	lfInfo: {
		rules: {
			[key: string]: LfRuleInfo;
		};
	};
}
export interface LfRuleInfo {
	root: {
		table: string;
		alias: string;
	};
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

export interface EngineInstance {
	compileSchema: (abstractSqlModel: AbstractSqlModel) => SqlModel;
	compileRule: (
		abstractSQL: AbstractSqlQuery,
	) => SqlResult | [SqlResult, SqlResult];
	dataTypeValidate: (
		value: any,
		field: Pick<AbstractSqlField, 'dataType' | 'required'>,
	) => Promise<any>;
	getReferencedFields: (ruleBody: AbstractSqlQuery) => ReferencedFields;
	/**
	 * This gets referenced fields for a query that is expected to always return true and only return fields that could change it to false
	 */
	getRuleReferencedFields: (ruleBody: AbstractSqlQuery) => RuleReferencedFields;
	getModifiedFields: (
		abstractSqlQuery: AbstractSqlQuery,
	) => undefined | ModifiedFields | Array<undefined | ModifiedFields>;
}

const validateTypes = _.mapValues(sbvrTypes, ({ validate }) => validate);

const dataTypeValidate: EngineInstance['dataTypeValidate'] = async (
	value,
	field,
) => {
	// In case one of the validation types throws an error.
	const { dataType, required = false } = field;
	// Without the `: SbvrType['validate']` widening TS complains that
	// "none of those signatures are compatible with each other".
	const validateFn: SbvrType['validate'] =
		validateTypes[dataType as keyof typeof sbvrTypes];
	if (validateFn != null) {
		return validateFn(value, required);
	} else {
		return new Error('is an unsupported type: ' + dataType);
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
	const dbType =
		sbvrTypes?.[dataType as keyof typeof sbvrTypes]?.types?.[engine];
	if (dbType != null) {
		if (typeof dbType === 'function') {
			return dbType(requiredStr, index);
		}
		return dbType + defaultValue + requiredStr + checksString + index;
	} else {
		throw new Error(`Unknown data type '${dataType}' for engine: ${engine}`);
	}
};

export const isAliasNode = <T>(
	n: AliasNode<T> | AbstractSqlType,
): n is AliasNode<T> => n[0] === 'Alias';
export const isFromNode = (n: AbstractSqlType): n is FromNode =>
	n[0] === 'From';
export const isTableNode = (n: AbstractSqlType): n is TableNode =>
	n[0] === 'Table';
export const isResourceNode = (n: AbstractSqlType): n is ResourceNode =>
	n[0] === 'Resource';
export const isSelectQueryNode = (n: AbstractSqlType): n is SelectQueryNode =>
	n[0] === 'SelectQuery';
export const isSelectNode = (n: AbstractSqlType): n is SelectNode =>
	n[0] === 'Select';
export const isWhereNode = (n: AbstractSqlType): n is WhereNode =>
	n[0] === 'Where';

/**
 *
 * @param n The abstract sql to check
 * @param checkNodeTypeFn A function that checks if a given node is the correct type
 */
const containsNode = (
	n: AnyTypeNodes,
	checkNodeTypeFn: (n: AnyTypeNodes) => boolean,
): boolean => {
	if (checkNodeTypeFn(n)) {
		return true;
	}
	for (const p of n) {
		if (Array.isArray(p) && containsNode(p as AnyTypeNodes, checkNodeTypeFn)) {
			return true;
		}
	}
	return false;
};

export function compileRule(
	abstractSQL: UpsertQueryNode,
	engine: Engines,
	noBinds: true,
): [string, string];
export function compileRule(
	abstractSQL: AbstractSqlQuery,
	engine: Engines,
	noBinds: true,
): string;
export function compileRule(
	abstractSQL: UpsertQueryNode,
	engine: Engines,
	noBinds?: false,
): [SqlResult, SqlResult];
export function compileRule(
	abstractSQL:
		| SelectQueryNode
		| UnionQueryNode
		| InsertQueryNode
		| UpdateQueryNode
		| DeleteQueryNode,
	engine: Engines,
	noBinds?: false,
): SqlResult;
export function compileRule(
	abstractSQL: AbstractSqlQuery,
	engine: Engines,
	noBinds?: false,
): SqlResult | [SqlResult, SqlResult];
export function compileRule(
	abstractSQL: AbstractSqlQuery,
	engine: Engines,
	noBinds?: boolean,
): SqlResult | [SqlResult, SqlResult] | string;
export function compileRule(
	abstractSQL: AbstractSqlQuery,
	engine: Engines,
	noBinds = false,
): SqlResult | [SqlResult, SqlResult] | string | [string, string] {
	abstractSQL = AbstractSQLOptimiser(abstractSQL, noBinds);
	return AbstractSQLRules2SQL(abstractSQL, engine, noBinds);
}

const compileSchema = (
	abstractSqlModel: AbstractSqlModel,
	engine: Engines,
	ifNotExists: boolean,
): SqlModel => {
	abstractSqlModel = optimizeSchema(abstractSqlModel, false);

	let ifNotExistsStr = '';
	let orReplaceStr = '';
	if (ifNotExists) {
		ifNotExistsStr = 'IF NOT EXISTS ';
		orReplaceStr = 'OR REPLACE ';
	}

	const createSchemaStatements: string[] = [];
	const alterSchemaStatements: string[] = [];
	let dropSchemaStatements: string[] = [];

	const fns: _.Dictionary<true> = {};
	if (abstractSqlModel.functions) {
		for (const fnName of Object.keys(abstractSqlModel.functions)) {
			const fnDefinition = abstractSqlModel.functions[fnName];
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
		}
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
	Object.keys(abstractSqlModel.tables).forEach((resourceName) => {
		const table = abstractSqlModel.tables[resourceName];
		if (typeof table === 'string') {
			return;
		}
		const { definition } = table;
		if (definition != null) {
			if (definition.binds != null && definition.binds.length > 0) {
				// If there are any binds then it's a dynamic definition and cannot become a view
				return;
			}
			let definitionAbstractSql = definition.abstractSql;
			// If there are any resource nodes then it's a dynamic definition and cannot become a view
			if (containsNode(definitionAbstractSql, isResourceNode)) {
				return;
			}
			if (isTableNode(definitionAbstractSql)) {
				// If the definition is a table node we need to wrap it in a select query for the view creation
				definitionAbstractSql = [
					'SelectQuery',
					['Select', [['Field', '*']]],
					['From', definitionAbstractSql],
				];
			}
			schemaDependencyMap[table.resourceName] = {
				resourceName,
				primitive: table.primitive,
				createSQL: [
					`\
CREATE ${orReplaceStr}VIEW "${table.name}" AS (
${compileRule(definitionAbstractSql as AbstractSqlQuery, engine, true).replace(
	/^/gm,
	'	',
)}
);`,
				],
				dropSQL: [`DROP VIEW "${table.name}";`],
				depends: [],
			};
			return;
		}
		const foreignKeys: string[] = [];
		const depends: string[] = [];
		const createSqlElements: string[] = [];
		const createIndexes: string[] = [];

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
						if (references.type !== 'informative') {
							foreignKeys.push(fkDefinition);
						}
						depends.push(references.resourceName);
						hasDependants[references.resourceName] = true;
					}
				}
			}
		}

		createSqlElements.push(...foreignKeys);
		for (const index of table.indexes) {
			let nullsSql = '';
			if (index.distinctNulls != null) {
				nullsSql =
					index.distinctNulls === false
						? ` NULLS NOT DISTINCT`
						: ` NULLS DISTINCT`;
			}
			// Non-partial indexes are added directly to the CREATE TABLE statement
			if (index.predicate == null) {
				createSqlElements.push(
					index.type + nullsSql + '("' + index.fields.join('", "') + '")',
				);
				continue;
			}
			if (index.name == null) {
				throw new Error('No name provided for partial index');
			}
			const comment = index.description
				? `-- ${index.description.replaceAll(/\r?\n/g, '\n-- ')}\n`
				: '';
			const whereSql = compileRule(
				index.predicate as AbstractSqlQuery,
				engine,
				true,
			);
			createIndexes.push(`\
${comment}\
CREATE ${index.type} INDEX IF NOT EXISTS "${index.name}"
ON "${table.name}" ("${index.fields.join('", "')}")${nullsSql}
WHERE (${whereSql});`);
		}

		if (table.checks) {
			for (const check of table.checks) {
				const comment = check.description
					? `-- ${check.description.split(/\r?\n/).join('\n-- ')}\n`
					: '';
				const constraintName = check.name ? `CONSTRAINT "${check.name}" ` : '';
				const sql = compileRule(
					check.abstractSql as AbstractSqlQuery,
					engine,
					true,
				);
				createSqlElements.push(`\
${comment}${constraintName}CHECK (${sql})`);
			}
		}

		const createTriggers: string[] = [];
		const dropTriggers: string[] = [];
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
				...createIndexes,
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
					Object.prototype.hasOwnProperty.call(schemaDependencyMap, dependency)
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
	if (Object.keys(schemaDependencyMap).length > 0) {
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
			insertAffectedIdsBinds(ruleBody, abstractSqlModel.lfInfo.rules[ruleSE]);
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
			let ruleReferencedFields: RuleReferencedFields | undefined;
			try {
				ruleReferencedFields = getRuleReferencedFields(ruleBody);
			} catch (e) {
				console.warn('Error fetching rule referenced fields', e);
			}

			return {
				structuredEnglish: ruleSE,
				sql: ruleSQL,
				bindings: ruleBindings,
				referencedFields,
				ruleReferencedFields,
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
		optimizeSchema,
		generateRuleSlug,
		compileSchema: (abstractSqlModel: AbstractSqlModel) =>
			compileSchema(abstractSqlModel, engine, ifNotExists),
		compileRule: (abstractSQL: AbstractSqlQuery) =>
			compileRule(abstractSQL, engine, false),
		dataTypeValidate,
		getReferencedFields,
		getRuleReferencedFields,
		getModifiedFields,
	};
};
export const postgres = generateExport(Engines.postgres, true);
export const mysql = generateExport(Engines.mysql, true);
export const websql = generateExport(Engines.websql, false);
