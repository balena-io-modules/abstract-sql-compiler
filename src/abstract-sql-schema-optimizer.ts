import { AbstractSQLOptimizer } from './abstract-sql-optimizer.js';
import $sbvrTypes from '@balena/sbvr-types';
const { default: sbvrTypes } = $sbvrTypes;
import type {
	AbstractSqlField,
	AbstractSqlModel,
	AbstractSqlType,
	BooleanTypeNodes,
	WhereNode,
} from './abstract-sql-compiler.js';
import { isFromNode, isSelectQueryNode } from './abstract-sql-compiler.js';

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

			return rule;
		})
		.filter((v): v is NonNullable<typeof v> => v != null);

	return abstractSqlModel;
};
