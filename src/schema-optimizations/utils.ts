import type { AbstractSqlType } from '../abstract-sql-compiler.js';

// TODO: Move to Object.groupBy once we drop support for node 20
export function groupBy<T, K>(entries: T[], iteratee: (item: T) => K) {
	const result: Partial<Record<string, T[]>> = Object.create(null);
	for (const entry of entries) {
		const key = `${iteratee(entry)}`;
		result[key] ??= [];
		result[key].push(entry);
	}
	return result;
}

export function partition<T, U extends T>(
	entries: T[],
	iteratee: (item: T) => item is U,
): [U[], T[]];
export function partition<T>(
	entries: T[],
	iteratee: (item: T) => boolean,
): [T[], T[]];
export function partition<T>(entries: T[], iteratee: (item: T) => boolean) {
	const result = groupBy(entries, iteratee);
	return [result.true ?? [], result.false ?? []];
}

export function keyBy<T, K>(entries: T[], iteratee: (item: T) => K) {
	const result: Partial<Record<string, T>> = Object.create(null);
	for (const entry of entries) {
		const key = `${iteratee(entry)}`;
		result[key] = entry;
	}
	return result;
}

export const convertReferencedFieldsToFields = (
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
