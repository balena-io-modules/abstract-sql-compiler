import * as _ from 'lodash';
import {
	AbstractSqlQuery,
	AbstractSqlType,
	EngineInstance,
	FieldsNode,
	isFromNode,
	isTableNode,
	SelectQueryNode,
	TableNode,
} from './AbstractSQLCompiler';
import { AbstractSQLOptimiser } from './AbstractSQLOptimiser';

export interface ReferencedFields {
	[alias: string]: string[];
}

export interface ModifiedFields {
	table: string;
	action: keyof RuleReferencedFields[string];
	fields?: string[];
}

type Scope = _.Dictionary<string>;

const getScope = (rulePart: AbstractSqlQuery, scope: Scope): Scope => {
	scope = { ...scope };
	const fromNodes = rulePart.filter(isFromNode);
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
export const getReferencedFields: EngineInstance['getReferencedFields'] = (
	ruleBody,
) => {
	ruleBody = AbstractSQLOptimiser(ruleBody);
	const referencedFields: ReferencedFields = {};
	$getReferencedFields(referencedFields, ruleBody);

	return _.mapValues(referencedFields, _.uniq);
};

const dealiasTableNode = (n: AbstractSqlQuery): TableNode | undefined => {
	if (isTableNode(n)) {
		return n;
	}
	if (n[0] === 'Alias' && isTableNode(n[1])) {
		return n[1];
	}
};
export interface RuleReferencedFields {
	[alias: string]: {
		create: string[];
		update: string[];
		delete: string[];
	};
}
export const getRuleReferencedFields: EngineInstance['getRuleReferencedFields'] = (
	ruleBody,
) => {
	ruleBody = AbstractSQLOptimiser(ruleBody);
	let referencedFields: ReferencedFields = {};
	const deletable = new Set<string>();
	if (ruleBody[0] === 'NotExists') {
		const s = ruleBody[1] as SelectQueryNode;
		if (s[0] === 'SelectQuery') {
			s.forEach((m) => {
				if (!isFromNode(m)) {
					return;
				}
				const table = dealiasTableNode(m[1]);
				if (table == null) {
					// keep this from node for later checking if we didn't optimize out
					return;
				}
				deletable.add(table[1]);
			});
		}
	}

	$getReferencedFields(referencedFields, ruleBody);
	referencedFields = _.mapValues(referencedFields, _.uniq);
	const refFields: RuleReferencedFields = {};

	for (const f of Object.keys(referencedFields)) {
		refFields[f] = {
			create: referencedFields[f],
			update: referencedFields[f],
			delete: referencedFields[f],
		};
		if (deletable.has(f)) {
			const countFroms = (n: AbstractSqlType[]) => {
				let count = 0;
				n.forEach((p) => {
					if (Array.isArray(p)) {
						if (isFromNode(p) && dealiasTableNode(p[1])?.[1] === f) {
							count++;
						} else {
							count += countFroms(p as AbstractSqlType[]);
						}
					}
				});
				return count;
			};
			// It's only deletable if there's just a single ref
			if (countFroms(ruleBody) === 1) {
				refFields[f].delete = [];
			}
		}
	}

	return refFields;
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
	if (Array.isArray(abstractSqlQuery[0])) {
		return abstractSqlQuery.map(checkQuery);
	} else {
		return checkQuery(abstractSqlQuery);
	}
};
