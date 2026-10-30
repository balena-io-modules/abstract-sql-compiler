import test from './test.ts';

describe('EndsWith', () => {
	test(
		['SelectQuery', ['Select', [['EndsWith', ['Field', 'name'], ['Bind', 0]]]]],
		[['Bind', 0]],
		(result, sqlEquals) => {
			it('should produce a valid EndsWith statement', () => {
				sqlEquals(
					result,
					`SELECT "name" LIKE ('%' || REPLACE(REPLACE(REPLACE($1, '\\', '\\\\'), '_', '\\_'), '%', '\\%'))`,
				);
			});
		},
	);
});
