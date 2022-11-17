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

describe('Add', () => {
	test(
		['SelectQuery', ['Select', [['Add', ['Number', 5], ['Number', 3]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Add statement', () => {
				sqlEquals(result.query, 'SELECT 5 + 3');
			});
		},
	);
});

describe('Subtract', () => {
	test(
		['SelectQuery', ['Select', [['Subtract', ['Number', 5], ['Number', 3]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Subtract statement', () => {
				sqlEquals(result.query, 'SELECT 5 - 3');
			});
		},
	);
});

describe('Multiply', () => {
	test(
		['SelectQuery', ['Select', [['Multiply', ['Number', 5], ['Number', 3]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Multiply statement', () => {
				sqlEquals(result.query, 'SELECT 5 * 3');
			});
		},
	);
});

describe('Divide', () => {
	test(
		['SelectQuery', ['Select', [['Divide', ['Number', 10], ['Number', 5]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Divide statement', () => {
				sqlEquals(result.query, 'SELECT 10 / 5');
			});
		},
	);
});

describe('Round', () => {
	test(
		['SelectQuery', ['Select', [['Round', ['Number', 10.4]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Round statement', () => {
				sqlEquals(result.query, `SELECT ROUND(10.4)`);
			});
		},
	);
});

describe('Floor', () => {
	test(
		['SelectQuery', ['Select', [['Floor', ['Number', 10.4]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Floor statement', () => {
				sqlEquals(result.query, `SELECT FLOOR(10.4)`);
			});
		},
	);
});

describe('Ceiling', () => {
	test(
		['SelectQuery', ['Select', [['Ceiling', ['Number', 10.4]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Ceiling statement', () => {
				sqlEquals(result.query, `SELECT CEILING(10.4)`);
			});
		},
	);
});
