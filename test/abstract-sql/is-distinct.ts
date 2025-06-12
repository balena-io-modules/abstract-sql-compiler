import test from './test';

describe('IsDistinctFrom', () => {
	test(
		[
			'SelectQuery',
			['Select', [['IsDistinctFrom', ['Field', 'a'], ['Field', 'b']]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid is distinct from statement', () => {
				sqlEquals(
					result,
					'SELECT NOT("a" IS NOT NULL AND "b" IS NOT NULL AND "a" = "b" OR "a" IS NULL AND "b" IS NULL)',
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', [['IsDistinctFrom', ['Number', 1], ['Number', 2]]]],
		],
		(result, sqlEquals) => {
			it('should optimize down to a !=', () => {
				sqlEquals(result, 'SELECT 1 != 2');
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', [['IsDistinctFrom', ['Field', 'a'], ['Text', '2']]]],
		],
		[['Text', '2']],
		(result, sqlEquals) => {
			it('should produce a valid is distinct from statement', () => {
				sqlEquals(result, 'SELECT NOT("a" IS NOT NULL AND "a" = $1)');
			});
		},
	);

	test(
		['SelectQuery', ['Select', [['IsDistinctFrom', ['Field', 'a'], ['Null']]]]],
		(result, sqlEquals) => {
			it('should produce an is not null statement', () => {
				sqlEquals(result, 'SELECT "a" IS NOT NULL');
			});
		},
	);
});

describe('IsNotDistinctFrom', () => {
	test(
		[
			'SelectQuery',
			['Select', [['IsNotDistinctFrom', ['Field', 'a'], ['Field', 'b']]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid is not distinct from statement', () => {
				sqlEquals(
					result,
					'SELECT "a" IS NOT NULL AND "b" IS NOT NULL AND "a" = "b" OR "a" IS NULL AND "b" IS NULL',
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', [['IsNotDistinctFrom', ['Number', 1], ['Number', 2]]]],
		],
		(result, sqlEquals) => {
			it('should optimize down to an =', () => {
				sqlEquals(result, 'SELECT 1 = 2');
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', [['IsNotDistinctFrom', ['Field', 'a'], ['Text', '2']]]],
		],
		[['Text', '2']],
		(result, sqlEquals) => {
			it('should produce a valid is not distinct from statement', () => {
				sqlEquals(result, 'SELECT "a" IS NOT NULL AND "a" = $1');
			});
		},
	);

	test(
		[
			'SelectQuery',
			['Select', [['IsNotDistinctFrom', ['Field', 'a'], ['Null']]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid is not distinct from statement', () => {
				sqlEquals(result, 'SELECT "a" IS NULL');
			});
		},
	);
});
