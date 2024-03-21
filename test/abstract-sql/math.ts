import type { AnyTypeNodes } from '../../src/AbstractSQLCompiler';

type TestCb = (
	result: { query: string },
	sqlEquals: (a: string, b: string) => void,
) => void;
import $test from './test';
const test = $test as (
	query: AnyTypeNodes,
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

describe('BitwiseAnd', () => {
	test(
		[
			'SelectQuery',
			['Select', [['BitwiseAnd', ['Number', 10], ['Number', 5]]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid BitwiseAnd statement', () => {
				sqlEquals(result.query, 'SELECT 10 & 5');
			});
		},
	);
});

describe('BitwiseShiftRight', () => {
	test(
		[
			'SelectQuery',
			['Select', [['BitwiseShiftRight', ['Number', 10], ['Number', 5]]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid BitwiseShiftRight statement', () => {
				sqlEquals(result.query, 'SELECT 10 >> 5');
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

describe('Math Operator Precedence', () => {
	// Different precedence
	test(
		[
			'SelectQuery',
			[
				'Select',
				[['Add', ['Multiply', ['Number', 2], ['Number', 3]], ['Number', 4]]],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Add statement when the first operand is a Multiply', () => {
				sqlEquals(result.query, 'SELECT (2 * 3) + 4');
			});
		},
	);

	test(
		[
			'SelectQuery',
			[
				'Select',
				[['Add', ['Number', 2], ['Multiply', ['Number', 3], ['Number', 4]]]],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Add statement when the second operand is a Multiply', () => {
				sqlEquals(result.query, 'SELECT 2 + (3 * 4)');
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
						'Add',
						['Multiply', ['Number', 2], ['Number', 3]],
						['Multiply', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Add statement of two Multiplications', () => {
				sqlEquals(result.query, 'SELECT (2 * 3) + (4 * 5)');
			});
		},
	);

	test(
		[
			'SelectQuery',
			[
				'Select',
				[['Multiply', ['Add', ['Number', 2], ['Number', 3]], ['Number', 4]]],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Multiply statement when the first operand is an Add', () => {
				sqlEquals(result.query, 'SELECT (2 + 3) * 4');
			});
		},
	);

	test(
		[
			'SelectQuery',
			[
				'Select',
				[['Multiply', ['Number', 2], ['Add', ['Number', 3], ['Number', 4]]]],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Multiply statement when the second operand is an Add', () => {
				sqlEquals(result.query, 'SELECT 2 * (3 + 4)');
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
						'Multiply',
						['Add', ['Number', 2], ['Number', 3]],
						['Add', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Multiply statement of two Additions', () => {
				sqlEquals(result.query, 'SELECT (2 + 3) * (4 + 5)');
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
						'Subtract',
						['Multiply', ['Number', 2], ['Number', 3]],
						['Multiply', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Subtract statement of two Multiplications', () => {
				sqlEquals(result.query, 'SELECT (2 * 3) - (4 * 5)');
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
						'Subtract',
						['Divide', ['Number', 2], ['Number', 3]],
						['Divide', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Subtract statement of two Divisions', () => {
				sqlEquals(result.query, 'SELECT (2 / 3) - (4 / 5)');
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
						'Divide',
						['Add', ['Number', 2], ['Number', 3]],
						['Add', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Divide statement of two Additions', () => {
				sqlEquals(result.query, 'SELECT (2 + 3) / (4 + 5)');
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
						'Divide',
						['Subtract', ['Number', 2], ['Number', 3]],
						['Subtract', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Divide statement of two Subtractions', () => {
				sqlEquals(result.query, 'SELECT (2 - 3) / (4 - 5)');
			});
		},
	);

	// Same Precedence Add/Subtract

	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Add',
						['Add', ['Number', 2], ['Number', 3]],
						['Add', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Add statement when there are nested Additions', () => {
				sqlEquals(result.query, 'SELECT (2 + 3) + (4 + 5)');
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
						'Add',
						['Subtract', ['Number', 2], ['Number', 3]],
						['Subtract', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Add statement when there are nested Subtractions', () => {
				sqlEquals(result.query, 'SELECT (2 - 3) + (4 - 5)');
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
						'Subtract',
						['Add', ['Number', 2], ['Number', 3]],
						['Add', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Subtract statement when there are nested Additions', () => {
				sqlEquals(result.query, 'SELECT (2 + 3) - (4 + 5)');
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
						'Subtract',
						['Subtract', ['Number', 2], ['Number', 3]],
						['Subtract', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Add statement when there are nested Subtractions', () => {
				sqlEquals(result.query, 'SELECT (2 - 3) - (4 - 5)');
			});
		},
	);

	// Same Precedence Multiply/Divide

	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Multiply',
						['Multiply', ['Number', 2], ['Number', 3]],
						['Multiply', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Multiply statement when there are nested Multiplications', () => {
				sqlEquals(result.query, 'SELECT (2 * 3) * (4 * 5)');
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
						'Multiply',
						['Divide', ['Number', 2], ['Number', 3]],
						['Divide', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Multiply statement when there are nested Divisions', () => {
				sqlEquals(result.query, 'SELECT (2 / 3) * (4 / 5)');
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
						'Divide',
						['Multiply', ['Number', 2], ['Number', 3]],
						['Multiply', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Divide statement when there are nested Multiplications', () => {
				sqlEquals(result.query, 'SELECT (2 * 3) / (4 * 5)');
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
						'Divide',
						['Divide', ['Number', 2], ['Number', 3]],
						['Divide', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Multiply statement when there are nested Divisions', () => {
				sqlEquals(result.query, 'SELECT (2 / 3) / (4 / 5)');
			});
		},
	);
});
