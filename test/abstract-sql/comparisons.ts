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

describe('Between', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Between', ['Number', 5], ['Number', 3], ['Number', 8]]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid Between statement', () => {
				sqlEquals(result.query, 'SELECT 5 BETWEEN 3 AND (8)');
			});
		},
	);
});
