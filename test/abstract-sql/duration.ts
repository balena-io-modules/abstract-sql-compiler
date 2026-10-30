import { expect } from 'chai';
import type * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import test from './test.ts';

describe('Totalseconds', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Totalseconds',
						[
							'Duration',
							{
								day: 1,
							},
						],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Totalseconds statement', () => {
				sqlEquals(result, `SELECT EXTRACT(EPOCH FROM INTERVAL '1 0:0:0.0')`);
			});
		},
	);
});

describe('Duration', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Duration',
						{
							negative: false,
							day: 1,
							hour: 2,
							minute: 3,
							second: 4,
						},
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Duration statement', () => {
				sqlEquals(result, `SELECT INTERVAL '1 2:3:4.0'`);
			});
		},
	);
	test(
		['SelectQuery', ['Select', [['Duration', { minute: 90 }]]]],
		(result, sqlEquals) => {
			it('should carry minutes over 59 into the hours', () => {
				sqlEquals(result, `SELECT INTERVAL '0 1:30:0.0'`);
			});
		},
	);
	test(
		['SelectQuery', ['Select', [['Duration', { second: 1500.25 }]]]],
		(result, sqlEquals) => {
			it('should carry seconds over 59 into the minutes', () => {
				sqlEquals(result, `SELECT INTERVAL '0 0:25:0.25'`);
			});
		},
	);
	test(
		[
			'SelectQuery',
			[
				'Select',
				[['Duration', { negative: true, hour: 100, second: 7259.000123 }]],
			],
		],
		(result, sqlEquals) => {
			it('should keep microsecond precision for the seconds', () => {
				sqlEquals(result, `SELECT INTERVAL '-0 -102:0:59.000123'`);
			});
		},
	);
	test.fail(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Duration',
						{ day: "1' day" } as unknown as AbstractSQLCompiler.DurationNode[1],
					],
				],
			],
		],
		(err) => {
			it('should reject non-numeric duration parts', () => {
				expect(err)
					.to.be.instanceOf(SyntaxError)
					.with.property(
						'message',
						'Duration day must be a finite number, got string',
					);
			});
		},
	);
});
