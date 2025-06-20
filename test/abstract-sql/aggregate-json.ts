import test from './test.js';

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
					result,
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
