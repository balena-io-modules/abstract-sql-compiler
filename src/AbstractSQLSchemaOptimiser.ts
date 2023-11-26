export const enum Engines {
	postgres = 'postgres',
	mysql = 'mysql',
	websql = 'websql',
}

import { AbstractSQLOptimiser } from './AbstractSQLOptimiser';
export { Binding, SqlResult } from './AbstractSQLRules2SQL';
import sbvrTypes from '@balena/sbvr-types';
import * as _ from 'lodash';
import {
	AbstractSqlModel,
	AbstractSqlQuery,
	AbstractSqlType,
	AndNode,
	BooleanTypeNodes,
	EqualsNode,
	FromNode,
	ReferencedFieldNode,
	SelectQueryNode,
	WhereNode,
	isFromNode,
	isSelectQueryNode,
} from './AbstractSQLCompiler';

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

export const generateRuleHashAcronym = (
	tableName: string,
	ruleBody: AbstractSqlType,
) => {
	const sha = sbvrTypes.SHA.validateSync(
		`${tableName}$${JSON.stringify(ruleBody)}`,
	).replace(/^\$sha256\$/, '');
	// Trim the trigger to a max of 63 characters, reserving at least 32 characters for the hash
	return `${tableName.slice(0, 30)}$${sha}`.slice(0, 63);
};

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

const recursiveGetReferencedFields = (n: AbstractSqlType[]) => {
	const referencedFieldNodes: ReferencedFieldNode[] = [];
	n.forEach((p) => {
		if (Array.isArray(p)) {
			if (p[0] === 'ReferencedField') {
				referencedFieldNodes.push(p as ReferencedFieldNode);
			} else {
				referencedFieldNodes.push(
					...recursiveGetReferencedFields(p.slice(1) as AbstractSqlType[]),
				);
			}
		}
	});
	return referencedFieldNodes;
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
			console.info(`*** ruleBody`, JSON.stringify(ruleBody, null, 2));

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
								name: generateRuleHashAcronym(tableName, ruleBody),
								abstractSql: whereNode,
							});
							return;
						}
					}
				}
			}

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

			function convertRuleToPartialUniqueIndex(ruleBody: AbstractSqlQuery) {
				const hasTopCountEqualsZero =
					ruleBody[0] === 'Equals' &&
					_.isEqual(ruleBody[2], ['Number', 0]) &&
					isSelectQueryNode(ruleBody[1]) &&
					_.isEqual(ruleBody[1][1], ['Select', [['Count', '*']]]);
				if (!hasTopCountEqualsZero) {
					return;
				}

				const topNodesByType = _.groupBy(
					((ruleBody as EqualsNode)[1] as SelectQueryNode).slice(2),
					(node) => node[0],
				);
				if (
					Object.keys(topNodesByType).length !== 2 ||
					!topNodesByType.From?.length ||
					topNodesByType.Where.length !== 1
				) {
					return;
				}
				console.info(
					`*** topNodesByType`,
					JSON.stringify(topNodesByType, null, 2),
				);

				const whereBody = topNodesByType.Where[0][1];
				if (whereBody == null || whereBody[0] !== 'And') {
					return;
				}
				const [, ...outerWhereParts] = whereBody;
				const lastNode = outerWhereParts.pop();
				console.info(`*** outerWhereParts`, outerWhereParts);

				const hasGreaterThan2Check =
					lastNode != null &&
					lastNode[0] === 'GreaterThanOrEqual' &&
					isSelectQueryNode(lastNode[1]) &&
					_.isEqual(lastNode[1][1], ['Select', [['Count', '*']]]) &&
					_.isEqual(lastNode[2], ['Number', 2]);
				if (!hasGreaterThan2Check) {
					return;
				}

				const nestedNodesByType = _.groupBy(
					(lastNode[1] as SelectQueryNode).slice(2),
					(node) => node[0],
				);
				if (
					Object.keys(nestedNodesByType).length !== 2 ||
					nestedNodesByType.From?.length !== 1 ||
					nestedNodesByType.Where?.length !== 1
				) {
					return;
				}
				console.info(
					`*** nestedNodesByType`,
					JSON.stringify(nestedNodesByType, null, 2),
				);

				const isRefEqualityCheck = (booleanNode: BooleanTypeNodes) =>
					booleanNode[0] === 'Equals' &&
					booleanNode[1][0] === 'ReferencedField' &&
					booleanNode[2][0] === 'ReferencedField';
				const nestecWhereNode = nestedNodesByType.Where[0] as WhereNode;
				if (nestecWhereNode[1][0] !== 'And') {
					return;
				}
				const [, ...nestedAndParts] = nestecWhereNode[1] as AndNode;
				const [nestedRefEqualityChecks, nestedRestChecks] = _.partition(
					nestedAndParts,
					isRefEqualityCheck,
				);

				console.info(
					`*** `,
					JSON.stringify(
						{
							nestedRefEqualityChecks,
							nestedRestChecks,
						},
						null,
						2,
					),
				);

				const nestedFromInfo = extractTableAndAlias(
					nestedNodesByType.From[0] as FromNode,
				);
				if (nestedFromInfo == null) {
					return;
				}

				const nestedRestChecksReferencedFields =
					recursiveGetReferencedFields(nestedRestChecks);
				console.info(
					`*** nestedRestChecksReferencedFields`,
					nestedRestChecksReferencedFields,
				);
				if (
					nestedRestChecksReferencedFields.length === 0 ||
					nestedRestChecksReferencedFields.some(
						(rf) => rf[1] !== nestedFromInfo.alias,
					)
				) {
					return;
				}

				const nestedRestChecksOnFields = _.cloneDeep(nestedRestChecks);
				convertReferencedFieldsToFields(nestedRestChecksOnFields);

				const [outerRefEqualityChecks, outerRestChecks] = _.partition(
					outerWhereParts,
					isRefEqualityCheck,
				);

				console.info(
					`*** `,
					JSON.stringify(
						{
							outerRefEqualityChecks,
							outerRestChecks,
						},
						null,
						2,
					),
				);

				const topFroms = topNodesByType.From as FromNode[];
				const topFromInfos = topFroms.map(extractTableAndAlias);
				if (topFromInfos.some((fi) => fi == null)) {
					return;
				}
				const topFromInfoByTableName = _.keyBy(
					topFromInfos as Array<NonNullable<(typeof topFromInfos)[number]>>,
					(fi) => fi.tableName,
				);
				const topPOIFromInfo = topFromInfoByTableName[nestedFromInfo.tableName];
				if (topPOIFromInfo == null) {
					return;
				}

				// const outerRestChecksReferencedFields = recursiveGetReferencedFields(outerRestChecks);
				// console.info(`*** outerRestChecksReferencedFields`, outerRestChecksReferencedFields);
				// if (outerRestChecksReferencedFields.length === 0 ||
				// 	outerRestChecksReferencedFields.some(rf => rf[1] !== topPOIFromInfo.alias)
				// ) {
				// 	return;
				// }

				const outerRestChecksOnFields = _.cloneDeep(outerRestChecks);
				convertReferencedFieldsToFields(outerRestChecksOnFields);
				console.info(
					`***`,
					JSON.stringify(
						{ nestedRestChecksOnFields, outerRestChecksOnFields },
						null,
						2,
					),
				);
				if (!_.isEqual(nestedRestChecksOnFields, outerRestChecksOnFields)) {
					return;
				}

				return {
					tableName: nestedFromInfo.tableName,
					indexDefinition: {
						type: 'UNIQUE',
						fields: ['produces-image', 'originates from-image', 'version'],
						nulls: 'NOT DISTINCT',
						predicate:
							nestedRestChecks.length === 1
								? nestedRestChecks[0]
								: ['And', ...nestedRestChecksOnFields],
					},
				};
			}

			const index = convertRuleToPartialUniqueIndex(ruleBody);
			console.info(`*** index`, JSON.stringify(index, null, 2));

			return rule;
		})
		.filter((v): v is NonNullable<typeof v> => v != null);

	return abstractSqlModel;
};
