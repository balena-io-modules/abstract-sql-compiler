import type {
	AbstractSqlModel,
	AbstractSqlQuery,
	AbstractSqlType,
	BooleanTypeNodes,
	Check,
	WhereNode,
} from '../abstract-sql-compiler.js';
import {
	abstractSqlContainsNode,
	isAliasNode,
	isFromNode,
	isSelectNode,
	isSelectQueryNode,
} from '../abstract-sql-compiler.js';
import { generateRuleSlug } from '../abstract-sql-schema-optimizer.js';

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

const convertReferencedFieldsToFields = (
	tableNameOrAlias: string,
	nodes: AbstractSqlType[],
) => {
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if (Array.isArray(node)) {
			if (node[0] === 'ReferencedField') {
				if (node[1] !== tableNameOrAlias) {
					throw new Error(
						`Found ReferencedField of unexpected resource '${node[1]}' while converting ReferencedFields of '${tableNameOrAlias}' to Fields`,
					);
				}
				nodes[i] = ['Field', node[2]];
			} else {
				convertReferencedFieldsToFields(
					tableNameOrAlias,
					node as AbstractSqlType[],
				);
			}
		}
	}
};

// `(SELECT ... ) = 0` is only equivalent to `NOT EXISTS (SELECT ...)` when selecting `COUNT(*)`
const isCountStarSelect = (selectQueryNodes: AbstractSqlType[]) => {
	const select = selectQueryNodes.find(isSelectNode);
	return (
		select?.[1].length === 1 &&
		select[1][0][0] === 'Count' &&
		select[1][0][1] === '*'
	);
};

export function convertRuleToCheckConstraint(
	abstractSqlModel: AbstractSqlModel,
	ruleSE: string,
	ruleBody: AbstractSqlQuery,
) {
	const count = countFroms(ruleBody);

	if (
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
			) &&
			(ruleBody[0] === 'NotExists' || isCountStarSelect(selectQueryNodes))
		) {
			let fromNode = selectQueryNodes.find(isFromNode)![1];
			let tableNameOrAlias: string | undefined;
			if (isAliasNode(fromNode)) {
				tableNameOrAlias = fromNode[2];
				fromNode = fromNode[1];
			}
			if (fromNode[0] === 'Table') {
				tableNameOrAlias ??= fromNode[1];
				const whereNodes = selectQueryNodes.filter(
					(n): n is WhereNode => n[0] === 'Where',
				);
				if (whereNodes.length === 0) {
					// Without a where this would be a check that always fails, so we leave it as a rule
					return;
				}
				let whereNode: BooleanTypeNodes;
				if (whereNodes.length > 1) {
					whereNode = ['And', ...whereNodes.map((n) => n[1])];
				} else {
					whereNode = whereNodes[0][1];
				}
				if (abstractSqlContainsNode(whereNode, isSelectQueryNode)) {
					// Check constraints cannot contain subqueries
					return;
				}
				// This replaces the `Not` we stripped from the `NotExists`
				whereNode = ['Not', whereNode];

				convertReferencedFieldsToFields(tableNameOrAlias, whereNode);

				const tableName = fromNode[1];
				const table = Object.values(abstractSqlModel.tables).find(
					(t) => t.name === tableName,
				);
				if (table) {
					table.checks ??= [];
					const check: Check = {
						description: ruleSE,
						name: generateRuleSlug(tableName, ruleBody),
						abstractSql: whereNode,
					};
					table.checks.push(check);
					return check;
				}
			}
		}
	}
}
