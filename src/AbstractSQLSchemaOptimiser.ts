export const enum Engines {
	postgres = 'postgres',
	mysql = 'mysql',
	websql = 'websql',
}

import { AbstractSQLOptimiser } from './AbstractSQLOptimiser';
export { Binding, SqlResult } from './AbstractSQLRules2SQL';
import sbvrTypes from '@balena/sbvr-types';
import * as _ from 'lodash';
import type {
	AbstractSqlModel,
	AbstractSqlQuery,
	AbstractSqlType,
	BooleanTypeNodes,
	WhereNode,
} from './AbstractSQLCompiler';
import { isFromNode, isSelectQueryNode } from './AbstractSQLCompiler';

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

export const optimizeSchema = (
	abstractSqlModel: AbstractSqlModel,
	createCheckConstraints: boolean = true,
): AbstractSqlModel => {
	abstractSqlModel.rules = abstractSqlModel.rules
		.map((rule): AbstractSqlQuery | undefined => {
			const ruleBodyNode = rule.find((r) => r[0] === 'Body') as [
				'Body',
				AbstractSqlQuery,
			];
			if (ruleBodyNode == null || typeof ruleBodyNode === 'string') {
				throw new Error('Invalid rule');
			}
			let ruleBody = ruleBodyNode[1];
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

			// Optimize the rule body, this also normalizes it making the check constraint check easier
			ruleBodyNode[1] = ruleBody = AbstractSQLOptimiser(ruleBody, true);

			const count = countFroms(ruleBody);
			if (
				createCheckConstraints &&
				count === 1 &&
				(ruleBody[0] === 'NotExists' ||
					(ruleBody[0] === 'Equals' &&
						_.isEqual(ruleBody[2], ['Number', 0]))) &&
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

						const convertReferencedFieldsToFields = (n: AbstractSqlType[]) => {
							n.forEach((p, i) => {
								if (Array.isArray(p)) {
									if (p[0] === 'ReferencedField') {
										n[i] = ['Field', p[2]];
									} else {
										convertReferencedFieldsToFields(p as AbstractSqlType[]);
									}
								}
							});
						};
						convertReferencedFieldsToFields(whereNode);

						const tableName = fromNode[1];
						const table = _.find(
							abstractSqlModel.tables,
							(t) => t.name === tableName,
						);
						if (table) {
							table.checks ??= [];
							table.checks!.push({
								description: ruleSE,
								name: generateRuleSlug(tableName, ruleBody),
								abstractSql: whereNode,
							});
							return;
						}
					}
				}
			}

			return rule;
		})
		.filter((v): v is NonNullable<typeof v> => v != null);

	return abstractSqlModel;
};
