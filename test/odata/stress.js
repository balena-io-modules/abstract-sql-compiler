const test = require('./test');
const _ = require('lodash');
const { pilotFields } = require('./fields');
const pilotFieldsStr = pilotFields.join(', ');

const filterIDs = _.range(1, 5000);
const filterBindsString = _.map(filterIDs, _.constant('?')).join(', ');
const filterBinds = _.map(filterIDs, (_n, i) => ['Bind', i]);

let filterString = `id in (${filterIDs.join(', ')})`;
test(
	'/pilot?$filter=' + filterString,
	'GET',
	filterBinds,
	(result, sqlEquals) => {
		it('should select from pilot with a long IN clause', () => {
			sqlEquals(
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE "pilot"."id" IN (` +
					filterBindsString +
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE "pilot"."id" NOT IN (` +
					filterBindsString +
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE "pilot"."id" IN (` +
					filterBindsString +
					')',
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
				result.query,
				`\
SELECT ${pilotFieldsStr}
FROM "pilot"
WHERE "pilot"."id" NOT IN (` +
					filterBindsString +
					')',
			);
		});
	},
);
