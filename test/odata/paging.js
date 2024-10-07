import test from './test';
import { pilotFields } from './fields';
const pilotFieldsStr = pilotFields.join(', ');

test('/pilot?$top=5', 'GET', [['Bind', 0]], (result, sqlEquals) => {
	it('should select from pilot limited by 5', () => {
		sqlEquals(
			result.query,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
LIMIT ?`,
		);
	});
});

test('/pilot?$skip=100', 'GET', [['Bind', 0]], (result, sqlEquals) => {
	it('should select from pilot offset by 100', () => {
		sqlEquals(
			result.query,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
OFFSET ?`,
		);
	});
});

test(
	'/pilot?$top=5&$skip=100',
	'GET',
	[
		['Bind', 0],
		['Bind', 1],
	],
	(result, sqlEquals) => {
		it('should select from pilot limited by 5 and offset by 100', () => {
			sqlEquals(
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
LIMIT ?
OFFSET ?`,
			);
		});
	},
);
