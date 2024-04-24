import { isDeepStrictEqual } from 'node:util';
import {
	convertReferencedFieldsToFields,
	groupBy,
	keyBy,
	partition,
} from './utils.js';
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
} from '../abstract-sql-compiler.js';
import {
	isAliasNode,
	isTableNode,
	isReferencedFieldNode,
	isSelectQueryNode,
} from '../abstract-sql-compiler.js';
import { generateRuleSlug } from '../abstract-sql-schema-optimizer.js';

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
	fieldsByFieldName: Partial<Record<string, AbstractSqlField>>,
	nodes: BooleanTypeNodes[],
): BooleanTypeNodes[] => {
	return nodes.filter((n) => {
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
				return false;
			}
		}
		return true;
	});
};

function extractTableAndAlias(fromNode: FromNode) {
	if (!isAliasNode(fromNode[1])) {
		return;
	}
	if (!isTableNode(fromNode[1][1])) {
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
	isReferencedFieldNode(booleanNode[1]) &&
	isReferencedFieldNode(booleanNode[2]);

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
export function convertRuleToPartialUniqueIndex(
	abstractSqlModel: AbstractSqlModel,
	ruleSE: string,
	ruleBody: AbstractSqlQuery,
) {
	const outerSelectQuery = ruleBody[1];
	// Check if the query is of one of the following forms:
	const queryChecksAbsenceOfRows =
		// SELECT NOT EXISTS (SELECT ...)
		(ruleBody[0] === 'NotExists' && isSelectQueryNode(outerSelectQuery)) ||
		// SELECT (SELECT COUNT(*) ...) = 0
		(ruleBody[0] === 'Equals' &&
			ruleBody[2][0] === 'Number' &&
			ruleBody[2][1] === 0 &&
			isSelectQueryNode(outerSelectQuery) &&
			isDeepStrictEqual(outerSelectQuery[1], ['Select', [['Count', '*']]]));
	if (!queryChecksAbsenceOfRows) {
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
		!isDeepStrictEqual(lastNode[2], ['Number', 2])
	) {
		return;
	}
	const innerSelectNode = lastNode[1];
	if (
		!isSelectQueryNode(innerSelectNode) ||
		!isDeepStrictEqual(innerSelectNode[1], ['Select', [['Count', '*']]])
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
	if (!isDeepStrictEqual(outerWhereParts, reAliasedNestedChecksToMatch)) {
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
	convertReferencedFieldsToFields(nestedFromInfo.alias, nestedPredicateChecks);
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
