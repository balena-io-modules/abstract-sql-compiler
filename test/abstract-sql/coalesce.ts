import test from './test';

describe('Coalesce', () => {
	test(
		['SelectQuery', ['Select', [['Coalesce', ['Number', 1], ['Number', 2]]]]],
		(result, sqlEquals) => {
			it('should produce a valid coalesce statement', () => {
				sqlEquals(result, 'SELECT COALESCE(1, 2)');
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
				sqlEquals(result, 'SELECT COALESCE($1, NULL, 2)');
			});
		},
	);
});
