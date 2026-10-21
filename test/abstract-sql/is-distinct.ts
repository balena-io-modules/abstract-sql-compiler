import test from './test.js';

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
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'And',
						['IsDistinctFrom', ['Field', 'a'], ['Field', 'b']],
						['Equals', ['Field', 'c'], ['Number', 1]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid is distinct from statement', () => {
				sqlEquals(
					result,
					`\
SELECT NOT("a" IS NOT NULL AND "b" IS NOT NULL AND "a" = "b" OR "a" IS NULL AND "b" IS NULL)
AND "c" = 1`,
				);
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
					'SELECT ("a" IS NOT NULL AND "b" IS NOT NULL AND "a" = "b" OR "a" IS NULL AND "b" IS NULL)',
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'And',
						['IsNotDistinctFrom', ['Field', 'a'], ['Field', 'b']],
						['Equals', ['Field', 'c'], ['Number', 1]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should keep the `OR` from swallowing the other `AND` conditions', () => {
				sqlEquals(
					result,
					`\
SELECT ("a" IS NOT NULL AND "b" IS NOT NULL AND "a" = "b" OR "a" IS NULL AND "b" IS NULL)
AND "c" = 1`,
				);
			});
		},
	);
	test.mysql(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'And',
						['IsNotDistinctFrom', ['Field', 'a'], ['Field', 'b']],
						['Equals', ['Field', 'c'], ['Number', 1]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid is not distinct from statement', () => {
				sqlEquals(
					result,
					`\
SELECT "a" <=> "b"
AND "c" = 1`,
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
