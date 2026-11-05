import { stripIndent } from 'common-tags';
import type { SelectQueryNode } from '../../out/abstract-sql-compiler.js';

import test from './test.ts';

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

	const emptyCountQuery: SelectQueryNode = [
		'SelectQuery',
		['Select', [['Count', '*']]],
		['From', ['Table', 'table']],
		['Where', ['Boolean', false]],
	];
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			['Where', ['Exists', emptyCountQuery]],
		],
		(result, sqlEquals) => {
			it('should not simplify `EXISTS($emptyCountQuery)` as an aggregate without a GROUP BY always returns a row', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE EXISTS (
							SELECT COUNT(*)
							FROM "table"
							WHERE false
						)
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
			['Where', ['NotExists', emptyCountQuery]],
		],
		(result, sqlEquals) => {
			it('should not simplify `NOT EXISTS($emptyCountQuery)` as an aggregate without a GROUP BY always returns a row', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE NOT EXISTS (
							SELECT COUNT(*)
							FROM "table"
							WHERE false
						)
					`,
				);
			});
		},
	);

	const emptyHavingQuery: SelectQueryNode = [
		'SelectQuery',
		['Select', []],
		['From', ['Table', 'table']],
		['Where', ['Boolean', false]],
		['Having', ['Equals', ['Count', '*'], ['Number', 0]]],
	];
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			['Where', ['Exists', emptyHavingQuery]],
		],
		(result, sqlEquals) => {
			it('should not simplify `EXISTS($emptyHavingQuery)` as a HAVING without a GROUP BY makes it an aggregate query', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE EXISTS (
							SELECT 1
							FROM "table"
							WHERE false
							HAVING COUNT(*) = 0
						)
					`,
				);
			});
		},
	);

	const emptyOrderByCountQuery: SelectQueryNode = [
		'SelectQuery',
		['Select', []],
		['From', ['Table', 'table']],
		['Where', ['Boolean', false]],
		['OrderBy', ['ASC', ['Count', '*']]],
	];
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			['Where', ['Exists', emptyOrderByCountQuery]],
		],
		(result, sqlEquals) => {
			it('should not simplify `EXISTS($emptyOrderByCountQuery)` as an aggregate in the ORDER BY makes it an aggregate query', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE EXISTS (
							SELECT 1
							FROM "table"
							WHERE false
							ORDER BY COUNT(*) ASC
						)
					`,
				);
			});
		},
	);

	const emptyGroupedCountQuery: SelectQueryNode = [
		'SelectQuery',
		['Select', [['Count', '*']]],
		['From', ['Table', 'table']],
		['Where', ['Boolean', false]],
		['GroupBy', [['ReferencedField', 'table', 'id']]],
	];
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			['Where', ['Exists', emptyGroupedCountQuery]],
		],
		(result, sqlEquals) => {
			it('should simplify `EXISTS($emptyGroupedCountQuery)` to `false` as a grouped aggregate returns no rows', () => {
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
});
