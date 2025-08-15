import test from './test.js';

describe('ConvertRow', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Field', '*']]],
			[
				'From',
				[
					'ConvertRow',
					[
						'SelectQuery',
						['Select', [['Alias', ['EmbeddedText', 'test'], 'name']]],
					],
					['Table', 'pilot'],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid aggregate JSON statement', () => {
				sqlEquals(
					result,
					`\
SELECT *
FROM JSON_POPULATE_RECORD(CAST(NULL AS "pilot"), (
	SELECT ROW_TO_JSON("r".*)
	FROM (
		SELECT 'test' AS "name"
	) AS "r"
))`,
				);
			});
		},
	);
});
