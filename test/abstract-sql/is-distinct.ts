import { AbstractSqlQuery } from '../../src/AbstractSQLCompiler';

// tslint:disable-next-line no-var-requires
const test = require('./test') as (
	query: AbstractSqlQuery,
	cb: (
		result: { query: string },
		sqlEquals: (a: string, b: string) => void,
	) => void,
) => void;

test(
	['SelectQuery', ['Select', [['IsDistinctFrom', ['Number', 1], ['Null']]]]],
	(result, sqlEquals) => {
		it('should produce a valid is distinct from statement', () => {
			sqlEquals(result.query, 'SELECT 1 IS DISTINCT FROM NULL');
		});
	},
);

test(
	['SelectQuery', ['Select', [['IsNotDistinctFrom', ['Number', 1], ['Null']]]]],
	(result, sqlEquals) => {
		it('should produce a valid is not distinct from statement', () => {
			sqlEquals(result.query, 'SELECT 1 IS NOT DISTINCT FROM NULL');
		});
	},
);
