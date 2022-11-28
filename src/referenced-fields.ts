import * as _ from 'lodash';
import {
	AbstractSqlQuery,
	AbstractSqlType,
	AliasableFromTypeNodes,
	AliasNode,
	AndNode,
	BooleanTypeNodes,
	EngineInstance,
	EqualsNode,
	ExistsNode,
	FieldsNode,
	FromNode,
	FromTypeNodes,
	InnerJoinNode,
	InNode,
	isAliasNode,
	isFromNode,
	isSelectNode,
	isSelectQueryNode,
	isTableNode,
	NotNode,
	SelectNode,
	SelectQueryNode,
	SelectQueryStatementNode,
	TableNode,
	WhereNode,
} from './AbstractSQLCompiler';
import { AbstractSQLOptimiser } from './AbstractSQLOptimiser';
import { isAbstractSqlQuery } from './AbstractSQLRules2SQL';

const SELECT_QUERY_TYPES = ['SelectQuery', 'UnionQuery'];

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
		// Fallthrough
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
			$getRuleReferencedFields(
				referencedFields,
				ruleBody[1] as AbstractSqlQuery,
				IsSafe.Delete,
			);
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

type AliasedTable = {
	tableName: string;
	alias: string;
};

type BindCandidate = AliasedTable & {
	scope: AbstractSqlQuery;
};

const findTablesInConstraint = (
	constraint: BooleanTypeNodes,
	candidates: BindCandidate[],
) => {
	// Recurse until we're sure that there are no more subqueries
	switch (constraint[0]) {
		case 'Boolean':
			break;
		case 'Equals':
		case 'NotEquals':
		case 'GreaterThan':
		case 'GreaterThanOrEqual':
		case 'LessThan':
		case 'LessThanOrEqual':
		case 'IsDistinctFrom':
		case 'IsNotDistinctFrom':
			const equalsNode = constraint as EqualsNode;
			const left = equalsNode[1];
			const right = equalsNode[2];
			if (!isAbstractSqlQuery(left) || !isAbstractSqlQuery(right)) {
				throw new Error(
					'cannot introspect into the string form of AbstractSqlQuery',
				);
			}
			if (SELECT_QUERY_TYPES.includes(left[0])) {
				findBindCandidates(left, candidates);
			}
			if (SELECT_QUERY_TYPES.includes(right[0])) {
				findBindCandidates(right, candidates);
			}
			break;
		case 'In':
		case 'NotIn':
			const inNode = constraint as InNode;
			for (const arg of inNode.slice(2)) {
				if (!isAbstractSqlQuery(arg)) {
					throw new Error(
						'cannot introspect into the string form of AbstractSqlQuery',
					);
				}
				if (SELECT_QUERY_TYPES.includes(arg[0])) {
					findBindCandidates(arg, candidates);
				}
			}
			break;
		case 'Exists':
		case 'NotExists':
			const existsNode = constraint as ExistsNode;
			const inner = existsNode[1];
			if (!isAbstractSqlQuery(inner)) {
				throw new Error(
					'cannot introspect into the string form of AbstractSqlQuery',
				);
			}
			if (SELECT_QUERY_TYPES.includes(inner[0])) {
				findBindCandidates(inner, candidates);
			}
			break;
		case 'Not':
			const notNode = constraint as NotNode;
			findTablesInConstraint(notNode[1], candidates);
			break;
		case 'And':
		case 'Or':
			const andNode = constraint as AndNode;
			for (const arg of andNode.slice(1)) {
				// TODO: type checking is going awry here for some reason
				findTablesInConstraint(arg as any, candidates);
			}
			break;
		default:
			throw new Error(`unknown constraint type: ${constraint[0]}`);
	}
};

const findTableInTableDefinition = (
	statement: AliasableFromTypeNodes,
	candidates: BindCandidate[],
): AliasedTable | null => {
	switch (statement[0]) {
		case 'SelectQuery':
		case 'UnionQuery':
			findBindCandidates(statement, candidates);
			return null;
		case 'Table':
			const tableNode = statement as TableNode;
			return { tableName: tableNode[1], alias: tableNode[1] };
		case 'Alias':
			const aliasNode = statement as AliasNode<FromTypeNodes>;
			const table = findTableInTableDefinition(aliasNode[1], candidates);
			if (table) {
				return { tableName: table.tableName, alias: aliasNode[2] };
			}
			return null;
		default:
			throw new Error(`unknown table definition type: ${statement[0]}`);
	}
};

const findTableInStatement = (
	statement: SelectQueryStatementNode,
	candidates: BindCandidate[],
): AliasedTable | null => {
	switch (statement[0]) {
		case 'Select':
			// Select lists may contain subqueries so introspect into them as well
			const selectNode = statement as SelectNode;
			for (const arg of selectNode[1]) {
				if (!isAbstractSqlQuery(arg)) {
					throw new Error(
						'cannot introspect into the string form of AbstractSqlQuery',
					);
				}
				if (SELECT_QUERY_TYPES.includes(arg[0])) {
					findBindCandidates(arg, candidates);
				}
			}
			return null;
		case 'From':
		case 'CrossJoin':
			const fromNode = statement as FromNode;
			return findTableInTableDefinition(fromNode[1], candidates);
		case 'Join':
		case 'LeftJoin':
		case 'RightJoin':
		case 'FullJoin':
			const joinNode = statement as InnerJoinNode;
			if (joinNode[2]) {
				findTablesInConstraint(joinNode[2][1], candidates);
			}
			return findTableInTableDefinition(joinNode[1], candidates);
		case 'Where':
			const whereNode = statement as WhereNode;
			findTablesInConstraint(whereNode[1], candidates);
			return null;
		default:
			return null;
	}
};

const findBindCandidates = (
	statement: AbstractSqlQuery,
	candidates: BindCandidate[],
) => {
	switch (statement[0]) {
		case 'SelectQuery':
			const selectQueryNode = statement as SelectQueryNode;
			const scope = statement;
			for (const arg of selectQueryNode.slice(1)) {
				if (!isAbstractSqlQuery(arg)) {
					throw new Error(
						'cannot introspect into the string form of AbstractSqlQuery',
					);
				}
				const table = findTableInStatement(arg, candidates);
				if (table) {
					candidates.push({ ...table, scope });
				}
			}
			break;
		default:
			throw new Error(
				`findBindCandidates only supports SELECT queries, got ${statement[0]}`,
			);
	}
};

// TODO: lots
// - Removing multiple candidates selecting from the same database table is too
//   conservative. The correct criteria is to just remove any that are present
//   in at least 2 disjoint subqueries. Because the problem is that in those
//   cases there is no place in the query that has visibility inside both
//   disjoint subqueries and that is a requirement for adding the corrent bind.
// - We can miss subqueries as we don't recurse into everything.
// - Ban on aggregates is not necessary but solving it requires additional
//   complexity.
// - We only care about and recognize `COUNT` aggregates and `GROUP BY`
//   statements right now.
// - We assume the ID column is named "id".
export const addAffectedIdsBinds = (abstractSql: AbstractSqlQuery) => {
	const candidates: BindCandidate[] = [];
	findBindCandidates(['SelectQuery', ['Where', abstractSql]], candidates);

	// Count the number of references for each database table. Multiple
	// candidates referencing the same table will be removed to conservatively
	// avoid scoping issues
	const seenTableNames: { [key: string]: number } = {};
	for (const candidate of candidates) {
		if (candidate.tableName in seenTableNames) {
			seenTableNames[candidate.tableName] += 1;
		} else {
			seenTableNames[candidate.tableName] = 1;
		}
	}

	// Add binds for affected IDs on selects that do not select aggregates nor
	// select from the same database table.
	candidateExamination: for (const candidate of candidates) {
		if (seenTableNames[candidate.tableName] > 1) {
			continue;
		}

		if (candidate.scope[0] === 'UnionQuery') {
			throw new Error('addAffectedIdsBinds only supports SELECT queries');
		}

		const selectQueryNode = candidate.scope as SelectQueryNode;
		let whereNode: WhereNode | null = null;
		for (const statement of selectQueryNode.slice(1)) {
			if (statement[0] === 'Select') {
				for (const arg of statement[1]) {
					if (arg[0] === 'Count') {
						continue candidateExamination;
					}
				}
			} else if (statement[0] === 'GroupBy') {
				continue candidateExamination;
			} else if (statement[0] === 'Where') {
				whereNode = statement;
			}
		}
		if (!whereNode) {
			whereNode = ['Where', ['Boolean', true]];
			selectQueryNode.push(whereNode);
		}

		whereNode[1] = [
			'And',
			whereNode[1],
			[
				'Or',
				['Equals', ['Bind', candidate.tableName], ['EmbeddedText', '{}']],
				[
					'Equals',
					['ReferencedField', candidate.alias, 'id'],
					['Any', ['Bind', candidate.tableName], 'Integer'],
				],
			],
		];
	}
};
