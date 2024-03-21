import { stripIndent } from 'common-tags';
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

describe('NOT(NOT(...)) should cancel each other out', () => {
	test(['Not', ['Not', ['Boolean', true]]], [], (result, sqlEquals) => {
		it('should produce a query using the boolean directly', () => {
			sqlEquals(
				result.query,
				stripIndent`
						SELECT TRUE AS "result";
					`,
			);
		});
	});
});
