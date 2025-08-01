import test from './test.js';

describe('Cast', () => {
	test(
		['SelectQuery', ['Select', [['Cast', ['Number', 1.2], 'Integer']]]],
		(result, sqlEquals) => {
			it('should produce a valid integer cast statement', () => {
				sqlEquals(result, 'SELECT CAST(1.2 AS INTEGER)');
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
				sqlEquals(result, `SELECT CAST($1 AS DATE)`);
			});
		},
	);
});
