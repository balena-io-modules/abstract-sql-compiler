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
	NumberNode,
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
} from './abstract-sql-compiler.js';
import {
	isAliasNode,
	isFieldNode,
	isFromNode,
	isReferencedFieldNode,
	isSelectNode,
	isSelectQueryNode,
	isTableNode,
	isWhereNode,
} from './abstract-sql-compiler.js';
import { AbstractSQLOptimizer } from './abstract-sql-optimizer.js';
import { isAbstractSqlQuery } from './abstract-sql-rules-to-sql.js';

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

	const result: { [key: string]: string[] } = {};
	for (const key of Object.keys(referencedFields)) {
		result[key] = [...new Set(referencedFields[key].update)];
	}
	return result;
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
		ruleBody = AbstractSQLOptimizer(ruleBody);
		const referencedFields: RuleReferencedFields = {};
		if (
			ruleBody[0] === 'Equals' &&
			ruleBody[2][0] === 'Number' &&
			ruleBody[2][1] === 0 &&
			isSelectQueryNode(ruleBody[1])
		) {
			const select = ruleBody[1].find(isSelectNode)!;
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
				tableRefs[method] = [...new Set(tableRefs[method])];
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

	const fields = query
		.filter((v): v is FieldsNode => v?.[0] === 'Fields')
		.flatMap((v) => v[1]);
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

// Find how many times an abstract sql fragment selects from the given table.
// Nodes that aren't explicitly handled have all of their arguments searched, which
// can only ever over count (eg a `Table` used as a type), and over counting is safe
// as it just means that we won't narrow
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
		case 'Lower':
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
				FullJoinNode | InnerJoinNode | LeftJoinNode | RightJoinNode;
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
				AndNode | OrNode | SelectQueryNode | TextArrayNode | UnionQueryNode;
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
		case 'Bind':
		case 'Boolean':
		case 'Date':
		case 'Duration':
		case 'EmbeddedText':
		case 'Field':
		case 'GroupBy':
		case 'Integer':
		case 'Null':
		case 'Number':
		case 'Real':
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
			// This includes index 0 in case this is a list of nodes rather than a node
			for (const arg of abstractSql) {
				if (isAbstractSqlQuery(arg)) {
					sum += countTableSelects(arg, table);
				}
			}

			return sum;
	}
};

const getAffectedIdsNarrowing = (
	table: string,
	alias: string,
	idField: string,
): OrNode => [
	'Or',
	['Equals', ['Bind', table], ['EmbeddedText', '{}']],
	[
		'Equals',
		['ReferencedField', alias, idField],
		['Any', ['Bind', table], 'Integer'],
	],
];

export interface NarrowingModelInfo {
	/**
	 * Returns the id field of the given table if its affected ids can be used to narrow rules, or `undefined`
	 * otherwise, eg when the ids can't be bound as an INTEGER[], or when the table has triggers that could modify
	 * rows other than the affected ones (ie triggers other than `BEFORE ... ROW` ones).
	 */
	getNarrowableIdField: (tableName: string) => string | undefined;
	/** Returns whether the given table is a view, whose rows depend on the tables that it selects from */
	isView: (tableName: string) => boolean;
	/** Returns whether the given field is computed, whose value can depend on other rows and tables */
	isComputedField: (tableName: string, fieldName: string) => boolean;
}

// Whether the rule references a view or a computed field, which can depend on
// tables that the rule does not directly select from
const dependsOnUnselectedTables = (
	abstractSql: AbstractSqlQuery,
	{ isView, isComputedField }: NarrowingModelInfo,
): boolean => {
	const tables = new Set<string>();
	const tableByAlias = new Map<string, string>();
	const fields: Array<[alias: string | undefined, fieldName: string]> = [];
	const collect = (node: unknown) => {
		if (!Array.isArray(node)) {
			return;
		}
		const n = node as AbstractSqlQuery;
		if (isTableNode(n)) {
			tables.add(n[1]);
		} else if (
			isAliasNode(n) &&
			isTableNode(n[1]) &&
			typeof n[2] === 'string'
		) {
			tableByAlias.set(n[2], n[1][1]);
		} else if (isReferencedFieldNode(n)) {
			fields.push([n[1], n[2]]);
		} else if (isFieldNode(n)) {
			fields.push([undefined, n[1]]);
		}
		for (const child of n) {
			collect(child);
		}
	};
	collect(abstractSql);

	for (const table of tables) {
		if (isView(table)) {
			return true;
		}
	}
	for (const [alias, fieldName] of fields) {
		const fieldTables =
			alias == null ? [...tables] : [tableByAlias.get(alias) ?? alias];
		if (fieldTables.some((table) => isComputedField(table, fieldName))) {
			return true;
		}
	}
	return false;
};

// Whether each row of the rule query, ie each combination of one row of each
// table in its top level FROM, is a violation of the rule on its own, which is
// what allows narrowing by tables other than the root
const isNarrowableByOtherTables = (
	abstractSql: AbstractSqlQuery,
	modelInfo: NarrowingModelInfo,
): boolean => {
	const selectQueryNode = abstractSql[1] as SelectQueryNode;
	if (abstractSql[0] === 'Equals') {
		// Only `(SELECT COUNT(*) ...) = 0`, and not eg `(SELECT COUNT(*) ...) = 1`
		// where whether there is a violation depends on all of the rows
		const numberNode = abstractSql[2] as NumberNode;
		const selectFields = selectQueryNode.find(isSelectNode)?.[1];
		if (
			numberNode[1] !== 0 ||
			selectFields?.length !== 1 ||
			selectFields[0][0] !== 'Count' ||
			selectFields[0][1] !== '*'
		) {
			return false;
		}
	}
	// No joins (where a table can be null), grouping, ordering, limits, etc
	if (
		!selectQueryNode
			.slice(1)
			.every(
				(node) => isSelectNode(node) || isFromNode(node) || isWhereNode(node),
			)
	) {
		return false;
	}
	// Views and computed fields can depend on rows that aren't part of the row of
	// the rule query, which is not something that we can tell
	return !dependsOnUnselectedTables(abstractSql, modelInfo);
};

// Narrowing:
// - The root table of the rule is narrowed. This is always safe when the root
//   table isn't selected from more than once and it is not negated in the LF.
//   Right now we conservatively check for the former but not the second. The
//   negative forms (e.g. it is forbidden that ...) are not fully supported
//   anyway.
// - When `modelInfo` is provided, any other table that is selected from exactly
//   once in the whole rule, with that selection being in the top level FROM of
//   the rule query, is narrowed as well. Eg a modification of a `pilot` for a
//   rule like "each plane that is flown by a pilot, ..." (whose root is
//   `plane`) only needs to validate the modified pilots rather than all of them.
//   The rule query searches for a counterexample, ie a conjunction of the rows
//   it selects and the conditions on them, so such a table `a` is a positive
//   (not negated) occurrence in it. Following update propagation (see eg
//   https://doi.org/10.1007/978-3-540-30204-9_2), the new counterexamples that
//   an insert/update of `a` can introduce are:
//     [+](a && b...) => [+]a && ![old]a && [new](b...)
//   Only one table is written at a time and `a` is only selected from once, so
//   `b...` doesn't depend on `a` and [new](b...) = [old](b...). And since the
//   rule held before the write, dropping ![old]a can't introduce a violation
//   that didn't already exist, which leaves [+]a: the inserted/updated rows,
//   ie `a` narrowed to the affected ids. This holds for the root table too.
//   Tables in subqueries are never narrowed, eg one in a NOT EXISTS is a
//   negated occurrence, for which:
//     [+]!(a && b...) => [-]a && ![new]a && [old](b...)
//   ie the new counterexamples come from the deleted or pre-update rows of `a`,
//   which would need a check before the write rather than the affected ids.
//   This relies on the rule query being a plain search for a counterexample
//   and on `a` being the only thing that changes, so we don't do it for:
//   - `(SELECT COUNT(*) ...) = N` with N other than 0, or other aggregates,
//     where whether there is a violation depends on all of the rows
//   - top level joins (where a table can be null), grouping, ordering, limits
//   - rules that reference views or computed fields, since they can depend on
//     other rows and tables that we can't see, including `a` itself
//   - tables with triggers other than `BEFORE ... ROW` ones, since they could
//     modify rows other than the affected ones
//   - tables with ids that can't be bound as an INTEGER[]
//
// TODO:
// - The root table is narrowed for `(SELECT COUNT(*) ...) = N` with any N,
//   but that is only correct for N = 0 (eg it is necessary that exactly one
//   pilot is experienced).
// - Removing multiple candidates selecting from the same database table to
//   avoid visibility issues is too conservative. The correct criteria is to
//   just remove any that are present in at least 2 disjoint subqueries.
//   Because in this case the problem is that in those cases there is not a
//   single place in the query that has visibility inside both disjoint
//   subqueries and that is a requirement for adding the corrent binds for
//   narrowing.
// - We assume the ID column of the root table is named "id".
// - This is a very restricted implementation of narrowing which could be
//   expanded to cover more situations.
//
// This function modifies `abstractSql` in place.
export const insertAffectedIdsBinds = (
	abstractSql: AbstractSqlQuery,
	lfRuleInfo: LfRuleInfo,
	modelInfo?: NarrowingModelInfo,
) => {
	const rootTableSelectCount = countTableSelects(
		abstractSql,
		lfRuleInfo.root.table,
	);

	// Check if the query is of the form:
	const isSupportedForm =
		// SELECT (SELECT COUNT(*) ...) = 0
		(abstractSql[0] === 'Equals' &&
			abstractSql[1][0] === 'SelectQuery' &&
			abstractSql[2][0] === 'Number') ||
		// SELECT NOT EXISTS (SELECT ...)
		(abstractSql[0] === 'NotExists' && abstractSql[1][0] === 'SelectQuery');
	if (!isSupportedForm) {
		if (rootTableSelectCount !== 1) {
			// We wouldn't have narrowed the root table so there is no need to throw
			return;
		}
		throw new Error(`\
Only queries in the form of:
	SELECT (SELECT COUNT(*) ...) = 0
	SELECT NOT EXISTS (SELECT ...)
are supported for affected IDs insertion.
	`);
	}
	const selectQueryNode = abstractSql[1] as SelectQueryNode;

	const narrowings: OrNode[] = [];
	if (rootTableSelectCount === 1) {
		narrowings.push(
			getAffectedIdsNarrowing(
				lfRuleInfo.root.table,
				lfRuleInfo.root.alias,
				'id',
			),
		);
	}
	if (modelInfo != null && isNarrowableByOtherTables(abstractSql, modelInfo)) {
		for (const fromNode of selectQueryNode.filter(isFromNode)) {
			const aliasNode = fromNode[1];
			if (!isAliasNode(aliasNode)) {
				continue;
			}
			const [, tableNode, alias] = aliasNode;
			if (!isTableNode(tableNode) || typeof alias !== 'string') {
				continue;
			}
			const table = tableNode[1];
			if (table === lfRuleInfo.root.table) {
				// The root table has already been handled above
				continue;
			}
			const idField = modelInfo.getNarrowableIdField(table);
			if (idField == null) {
				continue;
			}
			if (countTableSelects(abstractSql, table) !== 1) {
				continue;
			}
			narrowings.push(getAffectedIdsNarrowing(table, alias, idField));
		}
	}
	if (narrowings.length === 0) {
		return;
	}

	const narrowing: OrNode | AndNode =
		narrowings.length === 1 ? narrowings[0] : ['And', ...narrowings];
	const whereNode = selectQueryNode.slice(1).find(isWhereNode);
	if (whereNode === undefined) {
		selectQueryNode.push(['Where', narrowing]);
	} else {
		whereNode[1] = ['And', whereNode[1], narrowing];
	}
};
