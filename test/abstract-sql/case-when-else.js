import test from './test';

const buildSelect = (withElse) => [
	'SelectQuery',
	[
		'Select',
		[
			[
				'Alias',
				[
					'Case',
					[
						'When',
						['Equals', ['Number', -2], ['Number', -2]],
						['Text', 'Equal'],
					],
				].concat(withElse ? [['Else', ['Text', 'Not Equal']]] : []),
				'equal_alias',
			],
		],
	],
];

test(
	buildSelect(true),
	[
		['Text', 'Equal'],
		['Text', 'Not Equal'],
	],
	(result, sqlEquals) => {
		it('should produce a valid case statement', () => {
			sqlEquals(
				result.query,
				`\
SELECT CASE
	WHEN -2 = -2 THEN ?
	ELSE ?
END AS "equal_alias"`,
			);
		});
	},
);

test(buildSelect(false), [['Text', 'Equal']], (result, sqlEquals) => {
	it('should produce a valid case statement without an else', () => {
		sqlEquals(
			result.query,
			`\
SELECT CASE
	WHEN -2 = -2 THEN ?
END AS "equal_alias"`,
		);
	});
});
