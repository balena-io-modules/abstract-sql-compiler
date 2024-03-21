import * as _ from 'lodash';
import type {
	AbstractSqlQuery,
	AbstractSqlType,
	AddDateDurationNode,
	AddDateNumberNode,
	AliasNode,
	AndNode,
	AnyNode,
	AverageNode,
	CastNode,
	CharacterLengthNode,
	CountNode,
	CrossJoinNode,
	DateTruncNode,
	EngineInstance,
	EqualsNode,
	ExistsNode,
	ExtractJSONPathAsTextNode,
	FieldsNode,
	FromNode,
	FromTypeNodes,
	FullJoinNode,
	GreaterThanNode,
	GreaterThanOrEqualNode,
	HavingNode,
	InnerJoinNode,
	InNode,
	IsDistinctFromNode,
	IsNotDistinctFromNode,
	LeftJoinNode,
	LessThanNode,
	LessThanOrEqualNode,
	LfRuleInfo,
	NotEqualsNode,
	NotExistsNode,
	NotInNode,
	NotNode,
	OrNode,
	RightJoinNode,
	SelectNode,
	SelectQueryNode,
	SubtractDateDateNode,
	SubtractDateDurationNode,
	SubtractDateNumberNode,
	SumNode,
	TableNode,
	TextArrayNode,
	ToJSONNode,
	UnionQueryNode,
	WhereNode,
} from './AbstractSQLCompiler';
import {
	isAliasNode,
	isFromNode,
	isSelectNode,
	isSelectQueryNode,
	isTableNode,
	isWhereNode,
} from './AbstractSQLCompiler';
import { AbstractSQLOptimiser } from './AbstractSQLOptimiser';
import { isAbstractSqlQuery } from './AbstractSQLRules2SQL';

export interface ReferencedFields {
	[alias: string]: string[];
}

export interface ModifiedFields {
	table: string;
	action: keyof RuleReferencedFields[string];
	fields?: string[];
}

export const getReferencedFields: EngineInstance['getReferencedFields'] = (
	ruleBody,
) => {
	const referencedFields = getRuleReferencedFields(ruleBody);

	return _.mapValues(referencedFields, ({ update }) => _.uniq(update));
};

export interface RuleReferencedFields {
	[alias: string]: {
		create: string[];
		update: string[];
		delete: string[];
	};
}
enum IsSafe {
	Insert = 'ins',
	Delete = 'del',
	Unknown = '',
}
type RuleReferencedScope = {
	[aliasName: string]: {
		tableName: string;
		isSafe: IsSafe;
	};
};
const getRuleReferencedScope = (
	rulePart: AbstractSqlQuery,
	scope: RuleReferencedScope,
	isSafe: IsSafe,
): { scope: RuleReferencedScope; currentlyScopedAliases: string[] } => {
	const currentlyScopedAliases: string[] = [];
	scope = { ...scope };
	const fromNodes = rulePart.filter(isFromNode);
	fromNodes.forEach((node) => {
		const nested = node[1];
		if (nested[0] === 'Alias') {
			const [, from, alias] = nested;
			if (typeof alias !== 'string') {
				throw new Error('Cannot handle non-string aliases');
			}
			currentlyScopedAliases.push(alias);
			switch (from[0]) {
				case 'Table':
					scope[alias] = { tableName: from[1], isSafe };
					break;
				case 'SelectQuery':
					// Ignore SelectQuery in the From as we'll handle any fields it selects
					// when we recurse in. With true scope handling however we could prune
					// fields that don't affect the end result and avoid false positives
					scope[alias] = { tableName: '', isSafe };
					break;
				default:
					throw new Error(`Cannot handle aliased ${from[0]} nodes`);
			}
		} else if (nested[0] === 'Table') {
			currentlyScopedAliases.push(nested[1]);
			scope[nested[1]] = { tableName: nested[1], isSafe };
		} else {
			throw Error(`Unsupported FromNode for scoping: ${nested[0]}`);
		}
	});
	return { scope, currentlyScopedAliases };
};
const addReference = (
	referencedFields: RuleReferencedFields,
	scope: RuleReferencedScope,
	aliasName: string,
	fieldName: string,
) => {
	const a = scope[aliasName];
	// The scoped tableName is empty in the case of an aliased from query
	// and those fields will be covered when we recurse into them
	if (a.tableName !== '') {
		referencedFields[a.tableName] ??= {
			create: [],
			update: [],
			delete: [],
		};
		if (a.isSafe !== IsSafe.Insert) {
			referencedFields[a.tableName].create.push(fieldName);
		}
		if (a.isSafe !== IsSafe.Delete) {
			referencedFields[a.tableName].delete.push(fieldName);
		}
		referencedFields[a.tableName].update.push(fieldName);
	}
};
const $getRuleReferencedFields = (
	referencedFields: RuleReferencedFields,
	rulePart: AbstractSqlQuery,
	isSafe: IsSafe,
	{
		scope,
		currentlyScopedAliases,
	}: ReturnType<typeof getRuleReferencedScope> = {
		scope: {},
		currentlyScopedAliases: [],
	},
) => {
	if (!Array.isArray(rulePart)) {
		return;
	}
	switch (rulePart[0]) {
		case 'SelectQuery':
			// Update the current scope before trying to resolve field references
			({ scope, currentlyScopedAliases } = getRuleReferencedScope(
				rulePart,
				scope,
				isSafe,
			));
			rulePart.forEach((node: AbstractSqlQuery) => {
				$getRuleReferencedFields(referencedFields, node, isSafe, {
					scope,
					currentlyScopedAliases,
				});
			});
			return;
		case 'ReferencedField': {
			const [, aliasName, fieldName] = rulePart;
			if (typeof aliasName !== 'string' || typeof fieldName !== 'string') {
				throw new Error(`Invalid ReferencedField: ${rulePart}`);
			}
			addReference(referencedFields, scope, aliasName, fieldName);
			return;
		}
		case 'Field': {
			const [, fieldName] = rulePart;
			if (typeof fieldName !== 'string') {
				throw new Error(`Invalid ReferencedField: ${rulePart}`);
			}
			for (const aliasName of Object.keys(scope)) {
				// We assume any unreferenced field can come from any of the scoped tables
				addReference(referencedFields, scope, aliasName, fieldName);
			}
			return;
		}
		case 'Not':
		case 'NotExists':
			// When hitting a `Not` we invert the safety rule
			if (isSafe === IsSafe.Insert) {
				isSafe = IsSafe.Delete;
			} else if (isSafe === IsSafe.Delete) {
				isSafe = IsSafe.Insert;
			}
		// eslint-disable-next-line no-fallthrough -- Fallthrough
		case 'Where':
		case 'And':
		case 'Exists':
			rulePart.forEach((node: AbstractSqlQuery) => {
				$getRuleReferencedFields(referencedFields, node, isSafe, {
					scope,
					currentlyScopedAliases,
				});
			});
			return;
		case 'Having':
			scope = { ...scope };
			for (const key of Object.keys(scope)) {
				// Treat all entries under a `HAVING` as unknown since it can include counts in such a way
				// that our expectations of safety do not hold
				scope[key] = { ...scope[key], isSafe: IsSafe.Unknown };
			}
			rulePart.forEach((node: AbstractSqlQuery) => {
				$getRuleReferencedFields(referencedFields, node, isSafe, {
					scope,
					currentlyScopedAliases,
				});
			});
			return;
		case 'Count':
			if (rulePart[1] !== '*') {
				throw new Error(
					'Only COUNT(*) is supported for rule referenced fields',
				);
			}
			for (const aliasName of currentlyScopedAliases) {
				// We use '' as it means that only operations that affect every field will match against it
				addReference(referencedFields, scope, aliasName, '');
			}
			return;
		default:
			rulePart.forEach((node: AbstractSqlQuery) => {
				$getRuleReferencedFields(referencedFields, node, IsSafe.Unknown, {
					scope,
					currentlyScopedAliases,
				});
			});
	}
};
export const getRuleReferencedFields: EngineInstance['getRuleReferencedFields'] =
	(ruleBody) => {
		ruleBody = AbstractSQLOptimiser(ruleBody);
		const referencedFields: RuleReferencedFields = {};
		if (
			ruleBody[0] === 'Equals' &&
			_.isEqual(ruleBody[2], ['Number', 0]) &&
			isSelectQueryNode(ruleBody[1])
		) {
			const select = ruleBody[1].find(isSelectNode) as SelectNode;
			select[1] = [];
			$getRuleReferencedFields(referencedFields, ruleBody[1], IsSafe.Delete);
		} else {
			$getRuleReferencedFields(referencedFields, ruleBody, IsSafe.Insert);
		}
		for (const tableName of Object.keys(referencedFields)) {
			const tableRefs = referencedFields[tableName];
			for (const method of Object.keys(tableRefs) as Array<
				keyof typeof tableRefs
			>) {
				tableRefs[method] = _.uniq(tableRefs[method]);
			}
		}

		return referencedFields;
	};

const checkQuery = (query: AbstractSqlQuery): ModifiedFields | undefined => {
	const queryType = query[0];
	if (!['InsertQuery', 'UpdateQuery', 'DeleteQuery'].includes(queryType)) {
		return;
	}

	const froms = query.filter(isFromNode);
	if (froms.length !== 1) {
		return;
	}

	let table = froms[0][1];
	if (isAliasNode(table)) {
		table = table[1];
	}

	let tableName: string;
	if (isTableNode(table)) {
		tableName = table[1];
	} else if (typeof table === 'string') {
		// Deprecated: Remove this when we drop implicit tables
		tableName = table;
	} else {
		return;
	}

	if (queryType === 'InsertQuery') {
		return { table: tableName, action: 'create' };
	}
	if (queryType === 'DeleteQuery') {
		return { table: tableName, action: 'delete' };
	}

	const fields = _<FieldsNode | AbstractSqlType>(query)
		.filter((v): v is FieldsNode => v != null && v[0] === 'Fields')
		.flatMap((v) => v[1])
		.value();
	return { table: tableName, action: 'update', fields };
};
export const getModifiedFields: EngineInstance['getModifiedFields'] = (
	abstractSqlQuery: AbstractSqlQuery,
) => {
	if (abstractSqlQuery[0] === 'UpsertQuery') {
		return abstractSqlQuery.slice(1).map(checkQuery);
	} else if (Array.isArray(abstractSqlQuery[0])) {
		return abstractSqlQuery.map(checkQuery);
	} else {
		return checkQuery(abstractSqlQuery);
	}
};

// TS requires this to be a funtion declaration
function assertAbstractSqlIsNotLegacy(
	abstractSql: AbstractSqlType,
): asserts abstractSql is AbstractSqlQuery {
	if (!isAbstractSqlQuery(abstractSql)) {
		throw new Error(
			'cannot introspect into the string form of AbstractSqlQuery',
		);
	}
}

// Find how many times an abstract sql fragment selects from the given table
// TODO:
// - Not all abstract sql nodes are supported here yet but hopefully nothing
//   important is missing atm
// - Create missing node types
const countTableSelects = (
	abstractSql: AbstractSqlQuery,
	table: string,
): number => {
	assertAbstractSqlIsNotLegacy(abstractSql);
	let sum = 0;
	switch (abstractSql[0]) {
		// Unary nodes
		case 'Alias':
		case 'Any':
		case 'Average':
		case 'Cast':
		case 'CharacterLength':
		case 'CrossJoin':
		case 'Exists':
		case 'From':
		case 'Having':
		case 'Not':
		case 'NotExists':
		case 'Sum':
		case 'ToJSON':
		case 'Where': {
			const unaryOperation = abstractSql as
				| AliasNode<FromTypeNodes>
				| AnyNode
				| AverageNode
				| CastNode
				| CharacterLengthNode
				| CrossJoinNode
				| ExistsNode
				| FromNode
				| HavingNode
				| NotExistsNode
				| NotNode
				| SumNode
				| ToJSONNode
				| WhereNode;
			assertAbstractSqlIsNotLegacy(unaryOperation[1]);

			return countTableSelects(unaryOperation[1], table);
		}
		// `COUNT` is an unary function but we only support the `COUNT(*)` form
		case 'Count': {
			const countNode = abstractSql as CountNode;
			if (countNode[1] !== '*') {
				throw new Error('Only COUNT(*) is supported');
			}

			return 0;
		}
		// Binary nodes
		case 'AddDateDuration':
		case 'AddDateNumber':
		case 'DateTrunc':
		case 'Equals':
		case 'ExtractJSONPathAsText':
		case 'GreaterThan':
		case 'GreaterThanOrEqual':
		case 'IsDistinctFrom':
		case 'IsNotDistinctFrom':
		case 'LessThan':
		case 'LessThanOrEqual':
		case 'NotEquals':
		case 'SubtractDateDate':
		case 'SubtractDateDuration':
		case 'SubtractDateNumber': {
			const binaryOperation = abstractSql as
				| AddDateDurationNode
				| AddDateNumberNode
				| DateTruncNode
				| EqualsNode
				| ExtractJSONPathAsTextNode
				| GreaterThanNode
				| GreaterThanOrEqualNode
				| IsDistinctFromNode
				| IsNotDistinctFromNode
				| LessThanNode
				| LessThanOrEqualNode
				| NotEqualsNode
				| SubtractDateDateNode
				| SubtractDateDurationNode
				| SubtractDateNumberNode;
			const leftOperand = binaryOperation[1];
			assertAbstractSqlIsNotLegacy(leftOperand);
			const rightOperand = binaryOperation[2];
			assertAbstractSqlIsNotLegacy(rightOperand);

			return (
				countTableSelects(leftOperand, table) +
				countTableSelects(rightOperand, table)
			);
		}
		// Binary nodes with optional `ON` second argument
		case 'FullJoin':
		case 'Join':
		case 'LeftJoin':
		case 'RightJoin': {
			const joinNode = abstractSql as
				| FullJoinNode
				| InnerJoinNode
				| LeftJoinNode
				| RightJoinNode;
			assertAbstractSqlIsNotLegacy(joinNode[1]);
			if (joinNode[2] !== undefined) {
				assertAbstractSqlIsNotLegacy(joinNode[2][1]);
				sum = countTableSelects(joinNode[2][1], table);
			}

			return sum + countTableSelects(joinNode[1], table);
		}
		// n-ary nodes
		case 'And':
		case 'Or':
		case 'SelectQuery':
		case 'TextArray':
		case 'UnionQuery': {
			const selectQueryNode = abstractSql as
				| AndNode
				| OrNode
				| SelectQueryNode
				| TextArrayNode
				| UnionQueryNode;
			for (const arg of selectQueryNode.slice(1)) {
				assertAbstractSqlIsNotLegacy(arg);
				sum += countTableSelects(arg, table);
			}

			return sum;
		}
		// n-ary nodes but the slice starts at the third argument
		case 'In':
		case 'NotIn': {
			const inNode = abstractSql as InNode | NotInNode;
			for (const arg of inNode.slice(2)) {
				assertAbstractSqlIsNotLegacy(arg);
				sum += countTableSelects(arg, table);
			}

			return sum;
		}
		// n-ary-like node
		case 'Select': {
			const selectNode = abstractSql as SelectNode;
			for (const arg of selectNode[1]) {
				assertAbstractSqlIsNotLegacy(arg);
				sum += countTableSelects(arg, table);
			}

			return sum;
		}
		// Uninteresting atomic nodes
		case 'Boolean':
		case 'Date':
		case 'Duration':
		case 'EmbeddedText':
		case 'GroupBy':
		case 'Integer':
		case 'Null':
		case 'Number':
		case 'ReferencedField':
		case 'Text':
			return 0;

		// The atomic node we're looking for: a table selection
		case 'Table': {
			const tableNode = abstractSql as TableNode;

			if (tableNode[1] === table) {
				return 1;
			} else {
				return 0;
			}
		}
		default:
			throw new Error(`unknown abstract sql type: ${abstractSql[0]}`);
	}
};

// TODO:
// - This function only narrows the root table of the rule. This is always
//   safe when the root table isn't selected from more than once and it is not
//   negated in the LF. Right now we conservatively check for the former but
//   not the second. The negative forms (e.g. it is forbidden that ...) are
//   not fully supported anyway.
// - Removing multiple candidates selecting from the same database table to
//   avoid visibility issues is too conservative. The correct criteria is to
//   just remove any that are present in at least 2 disjoint subqueries.
//   Because in this case the problem is that in those cases there is not a
//   single place in the query that has visibility inside both disjoint
//   subqueries and that is a requirement for adding the corrent binds for
//   narrowing.
// - We assume the ID column is named "id".
// - This is a very restricted implementation of narrowing which could be
//   expanded to cover more situations.
//
// This function modifies `abstractSql` in place.
export const insertAffectedIdsBinds = (
	abstractSql: AbstractSqlQuery,
	lfRuleInfo: LfRuleInfo,
) => {
	const rootTableSelectCount = countTableSelects(
		abstractSql,
		lfRuleInfo.root.table,
	);
	if (rootTableSelectCount !== 1) {
		return;
	}

	const narrowing: OrNode = [
		'Or',
		['Equals', ['Bind', lfRuleInfo.root.table], ['EmbeddedText', '{}']],
		[
			'Equals',
			['ReferencedField', lfRuleInfo.root.alias, 'id'],
			['Any', ['Bind', lfRuleInfo.root.table], 'Integer'],
		],
	];

	// Assume (but check) that the query is of the form:
	//
	// SELECT (SELECT COUNT(*) ...) = 0
	if (
		abstractSql[0] !== 'Equals' ||
		abstractSql[1][0] !== 'SelectQuery' ||
		abstractSql[2][0] !== 'Number'
	) {
		throw new Error(
			'Query is not of the form: SELECT (SELECT COUNT(*) ...) = 0',
		);
	}

	const selectQueryNode = abstractSql[1] as SelectQueryNode;
	const whereNode = selectQueryNode.slice(1).find(isWhereNode);
	if (whereNode === undefined) {
		selectQueryNode.push(['Where', narrowing]);
	} else {
		whereNode[1] = ['And', whereNode[1], narrowing];
	}
};
