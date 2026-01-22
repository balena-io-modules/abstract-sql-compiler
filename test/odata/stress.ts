import test from './test.js';
import { pilotFields } from './fields.js';
const pilotFieldsStr = pilotFields.join(', ');

const filterIDs = Array.from({ length: 4999 }, (_v, i) => i + 1);
const filterBindsOrString = filterIDs
	.map(() => '"pilot"."id" IS NOT NULL AND "pilot"."id" = ?')
	.join('\nOR ');
const filterBindsNandString = filterIDs
	.map(() => 'NOT("pilot"."id" IS NOT NULL AND "pilot"."id" = ?)')
	.join('\nAND ');

const filterBinds = filterIDs.map((_n, i) => ['Bind', i] as const);

let filterString = `id in (${filterIDs.join(', ')})`;
test(
	'/pilot?$filter=' + filterString,
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select from pilot with a long IN clause', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE "pilot"."id" = ANY($1)`,
			);
		});
	},
);

filterString = `not(id in (${filterIDs.join(', ')}))`;
test(
	'/pilot?$filter=' + filterString,
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select from pilot with a long NOT IN clause', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE NOT (
	"pilot"."id" = ANY($1)
)`,
			);
		});
	},
);

filterString = filterIDs.map((i) => 'id eq ' + i).join(' or ');
test(
	'/pilot?$filter=' + filterString,
	'GET',
	filterBinds,
	(result, sqlEquals) => {
		it('should select from pilot with a long IN clause', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE (${filterBindsOrString})`,
			);
		});
	},
);

filterString = filterIDs.map((i) => 'id ne ' + i).join(' and ');
test(
	'/pilot?$filter=' + filterString,
	'GET',
	filterBinds,
	(result, sqlEquals) => {
		it('should select from pilot with a long NOT IN clause', () => {
			sqlEquals(
				result,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE ${filterBindsNandString}`,
			);
		});
	},
);
