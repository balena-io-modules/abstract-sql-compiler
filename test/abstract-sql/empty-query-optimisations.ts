import { stripIndent } from 'common-tags';
import {
	AbstractSqlQuery,
	SelectQueryNode,
} from '../../src/AbstractSQLCompiler';

type TestCb = (
	result: { query: string },
	sqlEquals: (a: string, b: string) => void,
) => void;
// tslint:disable-next-line no-var-requires
const test = require('./test') as (
	query: AbstractSqlQuery,
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
