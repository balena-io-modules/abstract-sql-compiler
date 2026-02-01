import { groupBy, isEqual, keyBy, partition } from 'es-toolkit';
import { AbstractSQLOptimizer } from './abstract-sql-optimizer.js';
import $sbvrTypes from '@balena/sbvr-types';
const { default: sbvrTypes } = $sbvrTypes;
import type {
	AbstractSqlField,
	AbstractSqlModel,
	AbstractSqlQuery,
	AbstractSqlType,
	AnyTypeNodes,
	BooleanTypeNodes,
	FromNode,
	Index,
	ReferencedFieldNode,
	WhereNode,
} from './abstract-sql-compiler.js';
import {
	isFromNode,
	isReferencedFieldNode,
	isSelectQueryNode,
} from './abstract-sql-compiler.js';

const countFroms = (n: AbstractSqlType[]) => {
	let count = 0;
	n.forEach((p) => {
		if (Array.isArray(p)) {
			if (isFromNode(p)) {
				count++;
			} else {
				count += countFroms(p as AbstractSqlType[]);
			}
		}
	});
	return count;
};

export const generateRuleSlug = (
	tableName: string,
	ruleBody: AbstractSqlType,
) => {
	const sha = sbvrTypes.SHA.validateSync(
		`${tableName}$${JSON.stringify(ruleBody)}`,
	).replace(/^\$sha256\$/, '');
	// Trim the trigger to a max of 63 characters, reserving at least 32 characters for the hash
	return `${tableName.slice(0, 30)}$${sha}`.slice(0, 63);
};

const convertReferencedFieldsToFields = (nodes: AbstractSqlType[]) => {
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if (Array.isArray(node)) {
			if (node[0] === 'ReferencedField') {
				nodes[i] = ['Field', node[2]];
			} else {
				convertReferencedFieldsToFields(node as AbstractSqlType[]);
			}
		}
	}
};

const replaceReferencedFieldAliases = (
	node: AbstractSqlType,
	aliasMap: Record<string, string>,
): AbstractSqlType => {
	// We are on a leaf node, no need to further recurse
	if (!Array.isArray(node)) {
		return node;
	}
	if (isReferencedFieldNode(node)) {
		const alias = node[1];
		const replacedAlias = aliasMap[alias];
		if (replacedAlias == null) {
			return node;
		}
		return ['ReferencedField', replacedAlias, node[2]];
	}
	return node.map((child) => {
		if (!Array.isArray(child)) {
			return child;
		}
		return replaceReferencedFieldAliases(child as AnyTypeNodes, aliasMap);
	}) as typeof node;
};

/**
 * Remove unnecessary NULL checks for referenced fields that are marked as required in the model
 * when they are in the following form:
 * ['Exists', ['ReferencedField', ...]]
 * This is necessary to be able to produce partial unique indexes w/o unnecessary WHERE X IS NO NULL clauses
 * or end up with a non-partial unique constraint when all checks are identified as unnecessary WHERE X IS NO NULL clauses.
 */
const removeExistChecksForRequiredReferencedFields = (
	resourceAlias: string,
	fieldsByFieldName: Record<string, AbstractSqlField>,
	nodes: BooleanTypeNodes[],
): BooleanTypeNodes[] => {
	const result: BooleanTypeNodes[] = [];
	for (const n of nodes) {
		if (Array.isArray(n) && n[0] === 'Exists' && Array.isArray(n[1])) {
			const maybeFieldTypeNode = n[1];
			const fieldName =
				isReferencedFieldNode(maybeFieldTypeNode) &&
				maybeFieldTypeNode[1] === resourceAlias
					? maybeFieldTypeNode[2]
					: undefined;
			if (
				typeof fieldName === 'string' &&
				fieldsByFieldName[fieldName]?.required === true
			) {
				continue;
			}
		}
		result.push(n);
	}
	return result;
};

function extractTableAndAlias(fromNode: FromNode) {
	if (fromNode[1][0] !== 'Alias') {
		return;
	}
	if (fromNode[1][1][0] !== 'Table') {
		return;
	}
	return {
		tableName: fromNode[1][1][1],
		alias: fromNode[1][2],
	};
}

const isRefEqualityCheck = (
	booleanNode: BooleanTypeNodes,
): booleanNode is ['Equals', ReferencedFieldNode, ReferencedFieldNode] =>
	booleanNode[0] === 'Equals' &&
	booleanNode[1][0] === 'ReferencedField' &&
	booleanNode[2][0] === 'ReferencedField';

const isSameFieldRefEqualityCheck = (
	booleanNode: BooleanTypeNodes,
	alias1: string,
	alias2: string,
) =>
	isRefEqualityCheck(booleanNode) &&
	((booleanNode[1][1] === alias1 && booleanNode[2][1] === alias2) ||
		(booleanNode[1][1] === alias2 && booleanNode[2][1] === alias1)) &&
	booleanNode[1][2] === booleanNode[2][2];

/**
 * Converts rules that generate queries of the following format to partial unique indexes:
 * SELECT NOT EXISTS ( # or SELECT (SELECT COUNT(*)...)) = 0
 * 	SELECT "resource.1"."partially unique field"
 * 	FROM "resource" AS "resource.1"
 * 	WHERE <"resource.1" uniqueness condition field checks>
 * 	AND (
 * 		SELECT COUNT(*)
 * 		FROM "resource" AS "resource.2"
 * 		WHERE <"resource.2" uniqueness condition field checks, mirroring the "resource.1" checks in the outer query>
 * 		AND <"resource.2"."partially unique field(s)" = "resource.1"."partially unique field(s)">
 * 	) >= 2
 * ) AS "result";
 *
 * SELECT ( # or SELECT NOT EXISTS
 * 	SELECT COUNT(*)
 * 	FROM "parent" AS "parent.0",
 * 		"resource" AS "resource.1"
 * 	WHERE <"resource.1" uniqueness condition field checks>
 * 	AND "resource.1"."<parent-fk>" = "parent.0"."id"
 * 	AND (
 * 		SELECT COUNT(*)
 * 		FROM "resource" AS "resource.2"
 * 		WHERE <"resource.2" uniqueness condition field checks, mirroring the "resource.1" checks in the outer query>
 * 		AND <"resource.2"."partially unique field(s)" = "resource.1"."partially unique field(s)">
 * 		AND "resource.2"."<parent-fk>" = "parent.0"."id"
 * 	) >= 2
 * ) = 0 AS "result";
 */
function convertRuleToPartialUniqueIndex(
	abstractSqlModel: AbstractSqlModel,
	ruleSE: string,
	ruleBody: AbstractSqlQuery,
) {
	const outerSelectQuery = ruleBody[1];
	// Check if the query is of one of the following forms:
	const queryChecksAbsenseOfRows =
		// SELECT NOT EXISTS (SELECT ...)
		(ruleBody[0] === 'NotExists' && isSelectQueryNode(outerSelectQuery)) ||
		// SELECT (SELECT COUNT(*) ...) = 0
		(ruleBody[0] === 'Equals' &&
			ruleBody[2][0] === 'Number' &&
			ruleBody[2][1] === 0 &&
			isSelectQueryNode(outerSelectQuery) &&
			isEqual(outerSelectQuery[1], ['Select', [['Count', '*']]]));
	if (!queryChecksAbsenseOfRows) {
		return;
	}

	const outerNodesByType = groupBy(
		outerSelectQuery.slice(1),
		(node) => node[0],
	);
	// Has to have 1 Select, 1 Where, and 1 or 2 Froms
	if (
		Object.keys(outerNodesByType).length !== 3 ||
		outerNodesByType.Select?.length !== 1 ||
		(outerNodesByType.From?.length !== 1 &&
			outerNodesByType.From?.length !== 2) ||
		outerNodesByType.Where?.length !== 1
	) {
		return;
	}

	const [outerWhereNode] = outerNodesByType.Where as [WhereNode];
	if (outerWhereNode[1][0] !== 'And') {
		return;
	}
	let [, ...outerWhereParts] = outerWhereNode[1];
	const lastNode = outerWhereParts.pop();

	// Has a SELECT COUNT(*) >= 2
	if (
		lastNode?.[0] !== 'GreaterThanOrEqual' ||
		!isEqual(lastNode[2], ['Number', 2])
	) {
		return;
	}
	const innerSelectNode = lastNode[1];
	if (
		!isSelectQueryNode(innerSelectNode) ||
		!isEqual(innerSelectNode[1], ['Select', [['Count', '*']]])
	) {
		return;
	}

	const nestedNodesByType = groupBy(
		innerSelectNode.slice(1),
		(node) => node[0],
	);
	// Has to have 1 Select, 1 Where, and 1 From
	if (
		Object.keys(nestedNodesByType).length !== 3 ||
		nestedNodesByType.Select?.length !== 1 ||
		nestedNodesByType.From?.length !== 1 ||
		nestedNodesByType.Where?.length !== 1
	) {
		return;
	}

	const [nestedWhereNode] = nestedNodesByType.Where as [WhereNode];
	if (nestedWhereNode[1][0] !== 'And') {
		return;
	}

	const nestedFromInfo = extractTableAndAlias(
		nestedNodesByType.From[0] as FromNode,
	);
	if (nestedFromInfo == null) {
		return;
	}

	const outerFromInfos = (outerNodesByType.From as FromNode[]).map(
		extractTableAndAlias,
	);
	if (!outerFromInfos.every((fi) => fi != null)) {
		return;
	}

	// Find on the outer FROM the table matching the one in the inner FROM
	const tableWithUniquenessCheck = nestedFromInfo.tableName;
	const [targetTableInfos, parentTableInfos] = partition(
		outerFromInfos,
		(fi) => fi.tableName === tableWithUniquenessCheck,
	);
	if (targetTableInfos.length !== 1 || parentTableInfos.length > 1) {
		return;
	}
	const [outerFromInfo] = targetTableInfos;
	const [parentTableInfo] = parentTableInfos;

	// Remove the unnecessary "field IS NOT NULL" checks, for fields that
	// the model knows are non-nullable. It's required for matching the
	// inner & outer WHERE parts, but also makes the WHERE clause of the
	// partial unique index simpler, which makes  can be useful in more queries.
	const table = Object.values(abstractSqlModel.tables).find(
		(t) => t.name === tableWithUniquenessCheck,
	);
	if (table == null) {
		return;
	}
	const fieldsByFieldName = keyBy(table.fields, (f) => f.fieldName);
	let [, ...nestedWhereParts] = nestedWhereNode[1];
	nestedWhereParts = removeExistChecksForRequiredReferencedFields(
		nestedFromInfo.alias,
		fieldsByFieldName,
		nestedWhereParts,
	);
	outerWhereParts = removeExistChecksForRequiredReferencedFields(
		outerFromInfo.alias,
		fieldsByFieldName,
		outerWhereParts,
	);

	// Confirm that other that the nodes like `"resource.inner"."fieldX" = "resource.outer"."fieldX"`
	// (which only appear in the inner query), all other nodes need to be matching between the inner & outer,
	// with only the alias being different.
	// ie the following parts need to match after replacing the aliases
	// outer: WHERE <"resource.1" uniqueness condition field checks>
	// 	AND "resource.1"."<parent-fk>" = "parent.0"."id"
	// inner: WHERE <"resource.2" uniqueness condition field checks, mirroring the "resource.1" checks in the outer query>
	// 	AND "resource.2"."<parent-fk>" = "parent.0"."id"
	const nestedChecksToMatchWithOuter = nestedWhereParts.filter(
		(n) =>
			!isSameFieldRefEqualityCheck(
				n,
				nestedFromInfo.alias,
				outerFromInfo.alias,
			),
	);
	const nestedToOuterAliasMap = {
		[nestedFromInfo.alias]: outerFromInfo.alias,
	};
	const reAliasedNestedChecksToMatch = nestedChecksToMatchWithOuter.map(
		(node) => replaceReferencedFieldAliases(node, nestedToOuterAliasMap),
	);
	if (!isEqual(outerWhereParts, reAliasedNestedChecksToMatch)) {
		return;
	}
	// The outer & inner queries match!

	// Confirm that all "JOIN"ed referenced fields in the nested query
	// are matched with the respective table of the outer query or the "parent" table.
	// These effectively are the fields that the rule tries to check for conditional uniqueness.
	// AND <"resource.2"."partially unique field(s)" = "resource.1"."partially unique field(s)">
	// 	AND "resource.2"."<parent-fk>" = "parent.0"."id" -- only when the rule references a "parent" table
	const [nestedRefFieldEqualityNodes, nestedPredicateChecks] = partition(
		nestedWhereParts,
		isRefEqualityCheck,
	);
	if (
		!nestedRefFieldEqualityNodes.every(
			([, ref1, ref2]) =>
				// the nested table's field is "joined" with the same field of the outer table
				// or the parent table's id field (if there is one in the query).
				(ref1[1] === nestedFromInfo.alias &&
					(ref2[1] === outerFromInfo.alias ||
						ref2[1] === parentTableInfo?.alias)) ||
				// the references might  appear in the reverse order.
				(ref2[1] === nestedFromInfo.alias &&
					(ref1[1] === outerFromInfo.alias ||
						ref1[1] === parentTableInfo?.alias)),
		)
	) {
		return;
	}

	const nestedParentRefEqualityChecks = nestedRefFieldEqualityNodes.filter(
		(n) =>
			!isSameFieldRefEqualityCheck(
				n,
				nestedFromInfo.alias,
				outerFromInfo.alias,
			),
	);

	// There should only be a single `"resource.inner"."fieldX" = "parent.0"."<idField>"` node
	// and only when the query has a 'FROM "<parent resource>"' statement.
	if (parentTableInfo == null) {
		if (nestedParentRefEqualityChecks.length !== 0) {
			return;
		}
	} else {
		if (nestedParentRefEqualityChecks.length !== 1) {
			return;
		}
		const parentTable = Object.values(abstractSqlModel.tables).find(
			(t) => t.name === parentTableInfo.tableName,
		);
		if (
			parentTable == null ||
			!nestedParentRefEqualityChecks.every(
				([, ref1, ref2]) =>
					(ref1[1] === nestedFromInfo.alias &&
						ref2[1] === parentTableInfo.alias &&
						ref2[2] === parentTable.idField) ||
					(ref2[1] === nestedFromInfo.alias &&
						ref1[1] === parentTableInfo.alias &&
						ref1[2] === parentTable.idField),
			)
		) {
			return;
		}
	}
	// The query seems to be in the supported format!

	// generate the index name using the original rule body
	// before convertReferencedFieldsToFields modifies it.
	const indexName = generateRuleSlug(tableWithUniquenessCheck, ruleBody);
	let indexedColumns = nestedRefFieldEqualityNodes.map((node) => node[1][2]);
	if (parentTableInfo != null) {
		// Move the FK checks first in the index, so that it's useful in more queries.
		const [fkFields, plainFields] = partition(
			indexedColumns,
			(field) => fieldsByFieldName[field]?.dataType === 'ForeignKey',
		);
		indexedColumns = [...fkFields, ...plainFields];
	}
	// This needs to run after we make sure that the rule is going to be replaced,
	// since it modifies the rule's body in-place.
	convertReferencedFieldsToFields(nestedPredicateChecks);
	const index: Index = {
		description: ruleSE,
		name: indexName,
		type: 'UNIQUE',
		fields: indexedColumns,
		...(nestedPredicateChecks.length > 0 && {
			predicate:
				nestedPredicateChecks.length === 1
					? nestedPredicateChecks[0]
					: (['And', ...nestedPredicateChecks] as const),
		}),
	};
	table.indexes.push(index);
	return index;
}

export const optimizeSchema = (
	abstractSqlModel: AbstractSqlModel,
	{ createCheckConstraints = true } = {},
): AbstractSqlModel => {
	for (const resourceName of Object.keys(abstractSqlModel.tables)) {
		const table = abstractSqlModel.tables[resourceName];
		if (typeof table === 'string') {
			continue;
		}
		if (table.viewDefinition || table.definition) {
			continue;
		}

		const computedFields: Array<
			NonNullable<Extract<AbstractSqlField['computed'], any[]>>
		> = [];
		for (const field of table.fields) {
			const { fieldName, computed } = field;
			if (computed != null && computed !== true) {
				if (Array.isArray(computed)) {
					field.computed = true;
					computedFields.push(['Alias', computed, fieldName]);
				} else {
					// If an fnName is not provided then generate one and trim it to a max of 63 characters
					computed.fnName ??= `fn_${table.name}_${fieldName}`.slice(0, 63);
					computedFields.push([
						'Alias',
						['FnCall', computed.fnName, ['ReferencedField', table.name, '*']],
						fieldName,
					]);
				}
			}
		}

		if (computedFields.length > 0) {
			// If there are computed fields then set the `modifyFields` to only the non-computed fields, modifiable fields,
			// and create a definition that computes them
			table.modifyFields ??= table.fields.filter(({ computed }) => !computed);
			table.definition = {
				abstractSql: [
					'SelectQuery',
					['Select', [['Field', '*'], ...computedFields]],
					['From', ['Table', table.name]],
				],
			};
		}
	}

	abstractSqlModel.rules = abstractSqlModel.rules
		.map((rule) => {
			const [, ruleBodyNode, ruleSENode] = rule;
			if (ruleBodyNode?.[0] !== 'Body') {
				throw new Error('Invalid rule');
			}
			let ruleBody = ruleBodyNode[1];
			if (typeof ruleBody === 'string') {
				throw new Error('Invalid rule');
			}
			if (ruleSENode?.[0] !== 'StructuredEnglish') {
				throw new Error('Invalid structured English');
			}
			const ruleSE = ruleSENode[1];
			if (typeof ruleSE !== 'string') {
				throw new Error('Invalid structured English');
			}

			// Optimize the rule body, this also normalizes it making the check constraint check easier
			ruleBodyNode[1] = ruleBody = AbstractSQLOptimizer(ruleBody, true);

			const count = countFroms(ruleBody);
			if (
				createCheckConstraints &&
				count === 1 &&
				(ruleBody[0] === 'NotExists' ||
					(ruleBody[0] === 'Equals' &&
						ruleBody[2][0] === 'Number' &&
						ruleBody[2][1] === 0)) &&
				isSelectQueryNode(ruleBody[1])
			) {
				const selectQueryNodes = ruleBody[1].slice(1);
				if (
					selectQueryNodes.every((n) =>
						['Select', 'From', 'Where'].includes(n[0]),
					)
				) {
					let fromNode = selectQueryNodes.find(isFromNode)![1];
					if (fromNode[0] === 'Alias') {
						fromNode = fromNode[1];
					}
					if (fromNode[0] === 'Table') {
						const whereNodes = selectQueryNodes.filter(
							(n): n is WhereNode => n[0] === 'Where',
						);
						let whereNode: BooleanTypeNodes;
						if (whereNodes.length > 1) {
							whereNode = ['And', ...whereNodes.map((n) => n[1])];
						} else {
							whereNode = whereNodes[0][1];
						}
						// This replaces the `Not` we stripped from the `NotExists`
						whereNode = ['Not', whereNode];

						convertReferencedFieldsToFields(whereNode);

						const tableName = fromNode[1];
						const table = Object.values(abstractSqlModel.tables).find(
							(t) => t.name === tableName,
						);
						if (table) {
							table.checks ??= [];
							table.checks.push({
								description: ruleSE,
								name: generateRuleSlug(tableName, ruleBody),
								abstractSql: whereNode,
							});
							return;
						}
					}
				}
			}

			const index = convertRuleToPartialUniqueIndex(
				abstractSqlModel,
				ruleSE,
				ruleBody,
			);
			if (index != null) {
				return;
			}

			return rule;
		})
		.filter((v): v is NonNullable<typeof v> => v != null);

	return abstractSqlModel;
};
