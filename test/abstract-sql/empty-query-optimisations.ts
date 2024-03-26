import { stripIndent } from 'common-tags';
import type {
	AnyTypeNodes,
	SelectQueryNode,
} from '../../src/AbstractSQLCompiler';

type TestCb = (
	result: { query: string },
	sqlEquals: (a: string, b: string) => void,
) => void;
import $test from './test';
const test = $test as (
	query: AnyTypeNodes,
	binds: any[][] | TestCb,
	cb?: TestCb,
) => void;

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
					result.query,
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
					result.query,
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
