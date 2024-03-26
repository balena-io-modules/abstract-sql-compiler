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
});
