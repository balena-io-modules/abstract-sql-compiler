import type { AnyTypeNodes } from '../../src/AbstractSQLCompiler';

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

describe('Cast', () => {
	test(
		['SelectQuery', ['Select', [['Cast', ['Number', 1.2], 'Integer']]]],
		(result, sqlEquals) => {
			it('should produce a valid integer cast statement', () => {
				sqlEquals(result.query, 'SELECT CAST(1.2 AS INTEGER)');
			});
		},
	);

	test(
		[
			'SelectQuery',
			['Select', [['Cast', ['Date', '2022-10-10T10:10:10.000Z'], 'Date']]],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid date cast statement', () => {
				sqlEquals(result.query, `SELECT CAST($1 AS DATE)`);
			});
		},
	);
});
