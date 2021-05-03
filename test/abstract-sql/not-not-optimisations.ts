import { stripIndent } from 'common-tags';
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
