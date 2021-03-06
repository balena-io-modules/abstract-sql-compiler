import * as _ from 'lodash';
import {
	AbstractSqlQuery,
	AbstractSqlType,
	EngineInstance,
	FieldsNode,
	isFromNode,
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
): RuleReferencedScope => {
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
			scope[nested[1]] = { tableName: nested[1], isSafe };
		} else {
			throw Error(`Unsupported FromNode for scoping: ${nested[0]}`);
		}
	});
	return scope;
};
const $getRuleReferencedFields = (
	referencedFields: RuleReferencedFields,
	rulePart: AbstractSqlQuery,
	isSafe: IsSafe,
	scope: RuleReferencedScope = {},
) => {
	if (!Array.isArray(rulePart)) {
		return;
	}
	switch (rulePart[0]) {
		case 'SelectQuery':
			// Update the current scope before trying to resolve field references
			scope = getRuleReferencedScope(rulePart, scope, isSafe);
			rulePart.forEach((node: AbstractSqlQuery) => {
				$getRuleReferencedFields(referencedFields, node, isSafe, scope);
			});
			return;
		case 'ReferencedField':
			const aliasName = rulePart[1];
			const fieldName = rulePart[2];
			if (typeof aliasName !== 'string' || typeof fieldName !== 'string') {
				throw new Error(`Invalid ReferencedField: ${rulePart}`);
			}
			const a = scope[aliasName];
			// The scoped tableName is empty in the case of an aliased from query
			// and those fields will be covered when we recurse into them
			if (a.tableName !== '') {
				if (referencedFields[a.tableName] == null) {
					referencedFields[a.tableName] = {
						create: [],
						update: [],
						delete: [],
					};
				}
				if (a.isSafe !== IsSafe.Insert) {
					referencedFields[a.tableName].create.push(fieldName);
				}
				if (a.isSafe !== IsSafe.Delete) {
					referencedFields[a.tableName].delete.push(fieldName);
				}
				referencedFields[a.tableName].update.push(fieldName);
			}
			return;
		case 'Field':
			throw new Error('Cannot find queried fields for unreferenced fields');
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
				$getRuleReferencedFields(referencedFields, node, isSafe, scope);
			});
			return;
		default:
			rulePart.forEach((node: AbstractSqlQuery) => {
				$getRuleReferencedFields(referencedFields, node, IsSafe.Unknown, scope);
			});
	}
};
export const getRuleReferencedFields: EngineInstance['getRuleReferencedFields'] = (
	ruleBody,
) => {
	ruleBody = AbstractSQLOptimiser(ruleBody);
	const referencedFields: RuleReferencedFields = {};
	$getRuleReferencedFields(referencedFields, ruleBody, IsSafe.Insert);
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
	if (abstractSqlQuery[0] === 'UpsertQuery') {
		return abstractSqlQuery.slice(1).map(checkQuery);
	} else if (Array.isArray(abstractSqlQuery[0])) {
		return abstractSqlQuery.map(checkQuery);
	} else {
		return checkQuery(abstractSqlQuery);
	}
};
