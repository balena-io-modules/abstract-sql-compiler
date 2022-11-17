import { AbstractSqlQuery } from '../../src/AbstractSQLCompiler';

type TestCb = (
	result: { query: string },
	sqlEquals: (a: string, b: string) => void,
) => void;
// tslint:disable-next-line no-var-requires
const test = require('./test') as (
	query: AbstractSqlQuery,
	binds: any[][] | TestCb,
	cb?: TestCb,
) => void;

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
				sqlEquals(
					result.query,
					`SELECT EXTRACT(EPOCH FROM INTERVAL '1 0:0:0.0')`,
				);
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
				sqlEquals(result.query, `SELECT INTERVAL '1 2:3:4.0'`);
			});
		},
	);
});
