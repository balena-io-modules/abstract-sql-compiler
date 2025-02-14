import { stripIndent } from 'common-tags';
import test from './test';

describe('NOT(NOT(...)) should cancel each other out', () => {
	test(['Not', ['Not', ['Boolean', true]]], [], (result, sqlEquals) => {
		it('should produce a query using the boolean directly', () => {
			sqlEquals(
				result,
				stripIndent`
						SELECT TRUE AS "result";
					`,
			);
		});
	});
});
