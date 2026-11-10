import type {
	AbstractSqlModel,
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
} from './abstract-sql-compiler.js';
import {
	abstractSqlContainsNode,
	isAliasNode,
	isFromNode,
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

const isCountAllSelect = (selectQueryNode: SelectQueryNode): boolean => {
	const selectFields = selectQueryNode.find(isSelectNode)?.[1];
	return (
		selectFields?.length === 1 &&
		selectFields[0][0] === 'Count' &&
		selectFields[0][1] === '*'
	);
};

// Whether the rows of the query are exactly the combinations of rows of its `FROM` tables that
// match its `WHERE`, ie nothing else (a join, `GROUP BY`, `HAVING`, `LIMIT`, ...) decides them
const isPlainSelectQuery = (selectQueryNode: SelectQueryNode): boolean =>
	selectQueryNode
		.slice(1)
		.every(
			(node) => isSelectNode(node) || isFromNode(node) || isWhereNode(node),
		);

// The affected ids are bound as the text of an array, which is only done for integers
const affectedIdsTypes: Record<string, 'Integer' | 'Big Integer'> = {
	Serial: 'Integer',
	Integer: 'Integer',
	'Big Serial': 'Big Integer',
	'Big Integer': 'Big Integer',
};

// Returns the field that the affected ids of the table are for, when the table can be
// narrowed by them
const getAffectedIdsField = (
	tables: AbstractSqlModel['tables'],
	tableName: string,
) => {
	const idFields = Object.values(tables)
		.filter((table) => table.name === tableName)
		.map((table) =>
			table.fields.find(({ fieldName }) => fieldName === table.idField),
		);
	const [idField] = idFields;
	if (
		idField == null ||
		// The affected ids are those of the resource that was modified, so if the
		// table is shared by resources that have different ids we cannot use them
		idFields.some((f) => f?.fieldName !== idField.fieldName) ||
		!Object.hasOwn(affectedIdsTypes, idField.dataType)
	) {
		return;
	}
	return {
		fieldName: idField.fieldName,
		type: affectedIdsTypes[idField.dataType],
	};
};

// Whether the rule selects from a view, or from something that we do not know to be a table.
// A view changes whenever the tables that it selects from do, so the rule also depends on the
// rows of those tables even though it does not select from them
const selectsFromView = (
	abstractSql: AbstractSqlQuery,
	tables: AbstractSqlModel['tables'],
): boolean =>
	abstractSqlContainsNode(abstractSql, (node) => {
		if (!isTableNode(node)) {
			return false;
		}
		const matchingTables = Object.values(tables).filter(
			({ name }) => name === node[1],
		);
		return (
			matchingTables.length === 0 ||
			matchingTables.some(({ viewDefinition }) => viewDefinition != null)
		);
	});

// Adds conditions to a rule that narrow it down to the rows that were affected by a modification,
// so that validating the rule does not have to go through all of the rows that were not modified.
//
// Each narrowed table gets a `(<bind> = '{}' OR <alias>.<id> = ANY(<bind>))` condition, with a
// bind that is named after the table. When that is the table that was modified the bind is
// expected to be the ids of its rows that were inserted or updated, and otherwise to be '{}',
// which disables the condition.
//
// A rule is only narrowed when it is a search for violations, ie it holds as long as a query for
// the combinations of rows that violate it finds nothing. It is narrowed by each table that is
// selected exactly once in the whole rule, with that being in the `FROM` of that query. When rows
// of such a table are inserted or updated every violation that did not exist before has to
// include one of those rows: any other combination of rows is made up of rows that were not
// modified, and nothing that they are checked against was modified either as the table is not
// selected anywhere else in the rule, so if it is a violation after the modification then it
// already was one before it. Deleting rows of such a table cannot add a violation.
//
// TODO:
// - Tables that are selected more than once are not narrowed.
// - Tables that are selected in a subquery are not narrowed. That is not the same case as above,
//   eg for a table in a `NOT EXISTS` it is the rows that were deleted, or the way that rows were
//   before they were updated, that can add a violation, which their ids are not enough to find.
//
// This function modifies `abstractSql` in place.
export const insertAffectedIdsBinds = (
	abstractSql: AbstractSqlQuery,
	tables: AbstractSqlModel['tables'],
) => {
	// Check if the query is of the form:
	if (
		// SELECT (SELECT COUNT(*) ...) = 0
		// It has to be `= 0` so that each counted row is a violation on its own. For any other
		// number, eg the `= 1` of "It is necessary that exactly one pilot is experienced", whether
		// the rule holds also depends on the rows that were not affected
		(abstractSql[0] === 'Equals' &&
			abstractSql[1][0] === 'SelectQuery' &&
			isCountAllSelect(abstractSql[1] as SelectQueryNode) &&
			abstractSql[2][0] === 'Number' &&
			abstractSql[2][1] === 0) ||
		// SELECT NOT EXISTS (SELECT ...)
		(abstractSql[0] === 'NotExists' && abstractSql[1][0] === 'SelectQuery')
	) {
		const selectQueryNode = abstractSql[1] as SelectQueryNode;
		if (!isPlainSelectQuery(selectQueryNode)) {
			// Narrowing filters the rows before they are joined, grouped or limited, which changes the
			// outcome of those rather than only which rows get checked, eg a `HAVING COUNT(*) >= 2` that
			// looks for duplicates would only see the affected rows and never find the row they duplicate
			return;
		}
		if (selectsFromView(abstractSql, tables)) {
			// The rows of a view change when the tables that it selects from are modified, in which
			// case the affected ids do not tell us which rows of the rule have to be checked
			return;
		}
		const narrowings: OrNode[] = [];
		for (const fromNode of selectQueryNode.filter(isFromNode)) {
			let from = fromNode[1];
			let alias: unknown;
			if (isAliasNode(from)) {
				[, from, alias] = from;
			}
			if (!isTableNode(from)) {
				continue;
			}
			const tableName = from[1];
			alias ??= tableName;
			if (
				typeof alias !== 'string' ||
				countTableSelects(abstractSql, tableName) !== 1
			) {
				continue;
			}
			const idField = getAffectedIdsField(tables, tableName);
			if (idField == null) {
				continue;
			}
			narrowings.push([
				'Or',
				['Equals', ['Bind', tableName], ['EmbeddedText', '{}']],
				[
					'Equals',
					['ReferencedField', alias, idField.fieldName],
					['Any', ['Bind', tableName], idField.type],
				],
			]);
		}
		if (narrowings.length === 0) {
			return;
		}
		const whereNode = selectQueryNode.slice(1).find(isWhereNode);
		if (whereNode === undefined) {
			selectQueryNode.push([
				'Where',
				narrowings.length === 1 ? narrowings[0] : ['And', ...narrowings],
			]);
		} else {
			whereNode[1] = ['And', whereNode[1], ...narrowings];
		}
	}
	// Any other form is left as is: it's not a search for rows that each violate the rule, eg
	// `(SELECT COUNT(*) ...) >= 2`, `(SELECT COUNT(*) ...) = 1` or `EXISTS (SELECT ...)` depend
	// on every row of the table rather than only on the affected ones, so there is nothing we
	// can narrow
};
