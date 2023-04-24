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

describe('AggregateJSON', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Alias',
						[
							'SelectQuery',
							[
								'Select',
								[
									[
										'Alias',
										[
											'AggregateJSON',
											['ReferencedField', 'pilot.licence', '*'],
										],
										'licence',
									],
								],
							],
							['From', ['Alias', ['Table', 'licence'], 'pilot.licence']],
						],
						'licence',
					],
				],
			],
			['From', ['Table', 'pilot']],
		],
		(result, sqlEquals) => {
			it('should produce a valid aggregate JSON statement', () => {
				sqlEquals(
					result.query,
					`\
SELECT (
	SELECT COALESCE(JSON_AGG("pilot.licence".*), '[]') AS "licence"
	FROM "licence" AS "pilot.licence"
) AS "licence"
FROM "pilot"`,
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
						'Alias',
						[
							'SelectQuery',
							[
								'Select',
								[
									[
										'Alias',
										['AggregateJSON', ['pilot.licence', '*']],
										'licence',
									],
								],
							],
							['From', ['Alias', ['Table', 'licence'], 'pilot.licence']],
						],
						'licence',
					],
				],
			],
			['From', ['Table', 'pilot']],
		],
		(result, sqlEquals) => {
			it('legacy form should produce a valid aggregate JSON statement', () => {
				sqlEquals(
					result.query,
					`\
SELECT (
	SELECT COALESCE(JSON_AGG("pilot.licence".*), '[]') AS "licence"
	FROM "licence" AS "pilot.licence"
) AS "licence"
FROM "pilot"`,
				);
			});
		},
	);
});
