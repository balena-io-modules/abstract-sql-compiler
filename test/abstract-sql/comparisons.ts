import { stripIndent } from 'common-tags';
import test from './test';

describe('Between', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Between', ['Number', 5], ['Number', 3], ['Number', 8]]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid Between statement', () => {
				sqlEquals(result, 'SELECT 5 BETWEEN 3 AND (8)');
			});
		},
	);
});

describe('Equals Any', () => {
	test(
		['SelectQuery', ['Select', [['EqualsAny', ['Number', 5], ['Bind', 0]]]]],
		[['Bind', 0]],
		(result, sqlEquals) => {
			it('should produce a valid EqualsAny statement', () => {
				sqlEquals(result, 'SELECT 5 = ANY($1)');
			});
		},
	);
});

describe('Comparison Operator Precedence', () => {
	// Different precedence
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Equals',
						['Boolean', true],
						['Equals', ['Boolean', true], ['Boolean', true]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Equals statement when the second operand is also an Equals', () => {
				sqlEquals(result, 'SELECT TRUE = (TRUE = TRUE)');
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
						'NotEquals',
						['Equals', ['Boolean', false], ['Boolean', false]],
						['Equals', ['Boolean', true], ['Boolean', true]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid NotEquals statement when both operands are Equals comparisons', () => {
				sqlEquals(result, 'SELECT (FALSE = FALSE) != (TRUE = TRUE)');
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
						'NotEquals',
						[
							'Add',
							['Integer', 1],
							[
								'Add',
								['Integer', 2],
								['Multiply', ['Integer', 3], ['Integer', 4]],
							],
						],
						['Add', ['Integer', 1], ['Integer', 0]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid NotEquals statement when the operands are math expressions with nested parenthesis', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1 + (2 + (3 * 4)) != 1 + 0
					`,
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
						'GreaterThanOrEqual',
						[
							'Multiply',
							['Add', ['Integer', 1], ['Integer', 2]],
							['Integer', 5],
						],
						['Add', ['Integer', 12], ['Integer', 2]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			// Evaluating this would match the expression w/o parenthesis
			it('should produce a valid NotEquals statement when the operands are math expressions with left sided parenthesis', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT (1 + 2) * 5 >= 12 + 2
					`,
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
						'GreaterThanOrEqual',
						[
							'Add',
							['Integer', 1],
							['Multiply', ['Integer', 2], ['Integer', 5]],
						],
						['Add', ['Integer', 12], ['Integer', 2]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			// Evaluating this would give a different result than if it was w/o parenthesis
			it('should produce a valid NotEquals statement when the operands are math expressions with right sided parenthesis', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1 + (2 * 5) >= 12 + 2
					`,
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
						[
							'Or',
							['GreaterThan', ['Integer', 1], ['Integer', 0]],
							['LessThan', ['Integer', 1], ['Integer', 0]],
						],
						['GreaterThan', ['Integer', 1], ['Integer', 0]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid And statement when the operands are composite boolean expressions', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT (1 > 0
						OR 1 < 0)
						AND 1 > 0
					`,
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
						'Or',
						[
							'And',
							['GreaterThan', ['Integer', 0], ['Integer', 1]],
							['Equals', ['Integer', 0], ['Integer', 1]],
						],
						['GreaterThan', ['Integer', 1], ['Integer', 0]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			// Even though the parenthesis are not added around the AND, the expression is correct b/c of precedence.
			it('should produce a valid Or statement when the first operand is a composite boolean expression', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT (0 > 1
						AND 0 = 1
						OR 1 > 0)
					`,
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
						'Or',
						['GreaterThan', ['Integer', 1], ['Integer', 0]],
						[
							'And',
							['Equals', ['Integer', 0], ['Integer', 1]],
							['GreaterThan', ['Integer', 0], ['Integer', 1]],
						],
					],
				],
			],
		],
		(result, sqlEquals) => {
			// Even though the parenthesis are not added around the AND, the expression is correct b/c of precedence.
			it('should produce a valid Or statement when the second operand is a composite boolean expression', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT (1 > 0
						OR 0 = 1
						AND 0 > 1)
					`,
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
						[
							'Or',
							['GreaterThan', ['Integer', 1], ['Integer', 0]],
							['Equals', ['Integer', 0], ['Integer', 1]],
						],
						['GreaterThan', ['Integer', 0], ['Integer', 1]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			// If it was w/o parenthesis, evaluating this would give a different result
			it('should produce a valid And statement when the first operand is an Or boolean expressions', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT (1 > 0
						OR 0 = 1)
						AND 0 > 1
					`,
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
						['GreaterThan', ['Integer', 0], ['Integer', 1]],
						[
							'Or',
							['Equals', ['Integer', 0], ['Integer', 1]],
							['GreaterThan', ['Integer', 1], ['Integer', 0]],
						],
					],
				],
			],
		],
		(result, sqlEquals) => {
			// If it was w/o parenthesis, evaluating this would give a different result
			it('should produce a valid And statement when the second operand is an Or boolean expressions', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 0 > 1
						AND (0 = 1
						OR 1 > 0)
					`,
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
						'Between',
						['Add', ['Integer', 1], ['Integer', 0]],
						['Add', ['Integer', 1], ['Integer', 0]],
						['Add', ['Integer', 1], ['Integer', 0]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Between statement when the operands are math expressions', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1 + 0 BETWEEN 1 + 0 AND (1 + 0)
					`,
				);
			});
		},
	);
});
