import { AbstractSQLOptimizer } from './abstract-sql-optimizer.js';
import $sbvrTypes from '@balena/sbvr-types';
const { default: sbvrTypes } = $sbvrTypes;
import type {
	AbstractSqlField,
	AbstractSqlModel,
	AbstractSqlType,
} from './abstract-sql-compiler.js';
import { convertRuleToCheckConstraint } from './schema-optimizations/check-constraint.js';

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

			if (
				createCheckConstraints &&
				convertRuleToCheckConstraint(abstractSqlModel, ruleSE, ruleBody)
			) {
				return;
			}

			return rule;
		})
		.filter((v): v is NonNullable<typeof v> => v != null);

	return abstractSqlModel;
};
