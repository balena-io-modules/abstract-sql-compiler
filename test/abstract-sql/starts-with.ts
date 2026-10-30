import test from './test.ts';

describe('StartsWith', () => {
	test.postgres(
		[
			'SelectQuery',
			['Select', [['StartsWith', ['Field', 'name'], ['Bind', 0]]]],
		],
		[['Bind', 0]],
		(result, sqlEquals) => {
			it('should produce a valid StartsWith statement', () => {
				sqlEquals(result, `SELECT STARTS_WITH("name", $1)`);
			});
		},
	);
});
