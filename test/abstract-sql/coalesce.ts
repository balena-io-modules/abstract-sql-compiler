import { AbstractSqlQuery } from '../../src/AbstractSQLCompiler';

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

describe('Coalesce', () => {
	test(
		['SelectQuery', ['Select', [['Coalesce', ['Number', 1], ['Number', 2]]]]],
		(result, sqlEquals) => {
			it('should produce a valid coalesce statement', () => {
				sqlEquals(result.query, 'SELECT COALESCE(1, 2)');
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', [['Coalesce', ['Text', '1'], ['Null'], ['Number', 2]]]],
		],
		[['Text', '1']],
		(result, sqlEquals) => {
			it('should produce a valid coalesce statement', () => {
				sqlEquals(result.query, 'SELECT COALESCE($1, NULL, 2)');
			});
		},
	);
});
