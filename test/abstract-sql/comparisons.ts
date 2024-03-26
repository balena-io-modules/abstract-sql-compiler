import { stripIndent } from 'common-tags';
import { AnyTypeNodes } from '../../src/AbstractSQLCompiler';

type TestCb = (
	result: { query: string },
	sqlEquals: (a: string, b: string) => void,
) => void;
// tslint:disable-next-line no-var-requires
const test = require('./test') as (
	query: AnyTypeNodes,
	binds: any[][] | TestCb,
	cb?: TestCb,
) => void;

describe('Between', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Between', ['Number', 5], ['Number', 3], ['Number', 8]]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid Between statement', () => {
				sqlEquals(result.query, 'SELECT 5 BETWEEN 3 AND (8)');
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
				sqlEquals(result.query, 'SELECT TRUE = (TRUE = TRUE)');
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
				sqlEquals(result.query, 'SELECT (FALSE = FALSE) != (TRUE = TRUE)');
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
						['Add', ['Integer', 1], ['Add', ['Integer', 2], ['Integer', 3]]],
						['Add', ['Integer', 1], ['Integer', 0]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid NotEquals statement when the operands are math expressions', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1 + (2 + 3) != 1 + 0
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
					result.query,
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
					result.query,
					stripIndent`
						SELECT 1 + 0 BETWEEN 1 + 0 AND (1 + 0)
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
						['Equals', ['Integer', 1], ['Integer', 0]],
						['LessThan', ['Integer', 1], ['Integer', 0]],
						['GreaterThan', ['Integer', 1], ['Integer', 0]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Between statement when the operands are comparison expressions', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT (1 = 0) BETWEEN (1 < 0) AND ((1 > 0))
					`,
				);
			});
		},
	);
});
