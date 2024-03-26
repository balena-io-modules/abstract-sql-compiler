import { expect } from 'chai';
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

describe('Count', () => {
	test(['SelectQuery', ['Select', [['Count', '*']]]], (result, sqlEquals) => {
		it('should produce a valid COUNT(*) statement', () => {
			sqlEquals(result.query, 'SELECT COUNT(*)');
		});
	});
});

describe('Average', () => {
	test(
		['SelectQuery', ['Select', [['Average', ['Number', 5]]]]],
		(result, sqlEquals) => {
			it('should produce a valid AVG(5) statement', () => {
				sqlEquals(result.query, 'SELECT AVG(5)');
			});
		},
	);
});

describe('Sum', () => {
	test(
		['SelectQuery', ['Select', [['Sum', ['Number', 5]]]]],
		(result, sqlEquals) => {
			it('should produce a valid SUM(5) statement', () => {
				sqlEquals(result.query, 'SELECT SUM(5)');
			});
		},
	);
});

describe('Subtract now timestamp from now timestamp', () => {
	test(
		['SelectQuery', ['Select', [['Subtract', ['Now'], ['Now']]]]],
		(result, sqlEquals) => {
			it('Subtract now timestamp from now timestamp', () => {
				sqlEquals(result.query, 'SELECT CURRENT_TIMESTAMP - CURRENT_TIMESTAMP');
			});
		},
	);
});

describe('Subtract Duration from now timestamp', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Subtract', ['Now'], ['Duration', { day: 1 }]]]],
		],
		(result, sqlEquals) => {
			it('Subtract Duration from now timestamp', () => {
				sqlEquals(
					result.query,
					`SELECT CURRENT_TIMESTAMP - INTERVAL '1 0:0:0.0'`,
				);
			});
		},
	);
});

// this is not allowed
describe('Add now timestamp to now timestamp should fail', () => {
	test(
		['SelectQuery', ['Select', [['Add', ['Now'], ['Now']]]]],
		(result, sqlEquals) => {
			it('Add now timestamp to now timestamp should fail', () => {
				expect(result).to.be.empty;
				expect(sqlEquals).to.be.undefined;
				expect(result.query).to.not.eq(
					'SELECT CURRENT_TIMESTAMP + CURRENT_TIMESTAMP',
				);
			});
		},
	);
});

describe('Add Duration to now timestamp', () => {
	test(
		['SelectQuery', ['Select', [['Add', ['Now'], ['Duration', { day: 1 }]]]]],
		(result, sqlEquals) => {
			it('Add Duration to now timestamp', () => {
				sqlEquals(
					result.query,
					`SELECT CURRENT_TIMESTAMP + INTERVAL '1 0:0:0.0'`,
				);
			});
		},
	);
});

describe('Substract DateTrunc datefield from now timestamp', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Subtract',
						['Now'],
						[
							'DateTrunc',
							['EmbeddedText', 'milliseconds'],
							['Date', '2022-10-10'],
						],
					],
				],
			],
		],
		[['Date', '2022-10-10']],
		(result, sqlEquals) => {
			it('Substract DateTrunc datefield from now timestamp', () => {
				sqlEquals(
					result.query,
					`SELECT CURRENT_TIMESTAMP - DATE_TRUNC('milliseconds', $1)`,
				);
			});
		},
	);
});

describe('Substract DateTrunc datefield from now timestamp', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Subtract',
						[
							'DateTrunc',
							['EmbeddedText', 'milliseconds'],
							['Date', '2021-11-11'],
						],
						[
							'DateTrunc',
							['EmbeddedText', 'milliseconds'],
							['Date', '2022-10-10'],
						],
					],
				],
			],
		],
		[
			['Date', '2021-11-11'],
			['Date', '2022-10-10'],
		],
		(result, sqlEquals) => {
			it('Substract DateTrunc datefield from now timestamp', () => {
				sqlEquals(
					result.query,
					`SELECT DATE_TRUNC('milliseconds', $1) - DATE_TRUNC('milliseconds', $2)`,
				);
			});
		},
	);
});
