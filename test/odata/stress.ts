import test from './test.js';
import _ from 'lodash';
import { pilotFields } from './fields.js';
const pilotFieldsStr = pilotFields.join(', ');

const filterIDs = _.range(1, 5000);
const filterBindsInString = _.map(filterIDs, () => '?').join(', ');
const filterBindsOrString = _.map(
	filterIDs,
	() => '"pilot"."id" IS NOT NULL AND "pilot"."id" = ?',
).join('\nOR ');
const filterBindsNandString = _.map(
	filterIDs,
	() => 'NOT("pilot"."id" IS NOT NULL AND "pilot"."id" = ?)',
).join('\nAND ');

const filterBinds = filterIDs.map((_n, i) => ['Bind', i] as const);

let filterString = `id in (${filterIDs.join(', ')})`;
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
WHERE "pilot"."id" IN (` +
					filterBindsInString +
					')',
			);
		});
	},
);

filterString = `not(id in (${filterIDs.join(', ')}))`;
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
WHERE "pilot"."id" NOT IN (` +
					filterBindsInString +
					')',
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
