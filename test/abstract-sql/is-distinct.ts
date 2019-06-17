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

describe('IsDistinctFrom', () => {
	test(
		[
			'SelectQuery',
			['Select', [['IsDistinctFrom', ['Number', 1], ['Number', 2]]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid is distinct from statement', () => {
				sqlEquals(
					result.query,
					'SELECT NOT((1) IS NOT NULL AND (2) IS NOT NULL AND (1) = (2) OR (1) IS NULL AND (2) IS NULL)',
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', [['IsDistinctFrom', ['Number', 1], ['Text', '2']]]],
		],
		[['Text', '2']],
		(result, sqlEquals) => {
			it('should produce a valid is distinct from statement', () => {
				sqlEquals(result.query, 'SELECT NOT((1) IS NOT NULL AND (1) = ($1))');
			});
		},
	);

	test(
		['SelectQuery', ['Select', [['IsDistinctFrom', ['Number', 1], ['Null']]]]],
		(result, sqlEquals) => {
			it('should produce an is not null statement', () => {
				sqlEquals(result.query, 'SELECT 1 IS NOT NULL');
			});
		},
	);
});

describe('IsNotDistinctFrom', () => {
	test(
		[
			'SelectQuery',
			['Select', [['IsNotDistinctFrom', ['Number', 1], ['Number', 2]]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid is not distinct from statement', () => {
				sqlEquals(
					result.query,
					'SELECT (1) IS NOT NULL AND (2) IS NOT NULL AND (1) = (2) OR (1) IS NULL AND (2) IS NULL',
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', [['IsNotDistinctFrom', ['Number', 1], ['Text', '2']]]],
		],
		[['Text', '2']],
		(result, sqlEquals) => {
			it('should produce a valid is not distinct from statement', () => {
				sqlEquals(result.query, 'SELECT (1) IS NOT NULL AND (1) = ($1)');
			});
		},
	);

	test(
		[
			'SelectQuery',
			['Select', [['IsNotDistinctFrom', ['Number', 1], ['Null']]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid is not distinct from statement', () => {
				sqlEquals(result.query, 'SELECT 1 IS NULL');
			});
		},
	);
});
