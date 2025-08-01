import { stripIndent } from 'common-tags';
import type { SelectQueryNode } from '../../out/abstract-sql-compiler.js';

import test from './test.js';

describe('Empty queries should be optimized', () => {
	const emptyQuery: SelectQueryNode = [
		'SelectQuery',
		['Select', []],
		['From', ['Table', 'table']],
		['Where', ['Boolean', false]],
	];
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			['Where', ['Exists', emptyQuery]],
		],
		(result, sqlEquals) => {
			it('should simplify `EXISTS($emptyQuery)` to `false`', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE false
					`,
				);
			});
		},
	);

	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			['Where', ['NotExists', emptyQuery]],
		],
		(result, sqlEquals) => {
			it('should simplify `NOT EXISTS($emptyQuery)` to `true`', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE true
					`,
				);
			});
		},
	);
});
