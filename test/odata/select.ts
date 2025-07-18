import test from './test';
import { pilotFields } from './fields';
const pilotFieldsStr = pilotFields.join(', ');

test('/pilot?$select=name', (result, sqlEquals) => {
	it('should select name from pilot', () => {
		sqlEquals(
			result,
			`\
SELECT "pilot"."name"
FROM "pilot"`,
		);
	});
});

test('/pilot?$select=favourite_colour', (result, sqlEquals) => {
	it('should select favourite_colour from pilot', () => {
		sqlEquals(
			result,
			`\
SELECT "pilot"."favourite colour" AS "favourite_colour"
FROM "pilot"`,
		);
	});
});

test(
	'/pilot(1)?$select=favourite_colour',
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select from pilot with id', () => {
			sqlEquals(
				result,
				`\
SELECT "pilot"."favourite colour" AS "favourite_colour"
FROM "pilot"
WHERE "pilot"."id" IS NOT NULL AND "pilot"."id" = ?`,
			);
		});
	},
);

test(
	"/pilot('TextKey')?$select=favourite_colour",
	'GET',
	[['Bind', 0]],
	(result, sqlEquals) => {
		it('should select favourite colour from pilot "TextKey"', () => {
			sqlEquals(
				result,
				`\
SELECT "pilot"."favourite colour" AS "favourite_colour"
FROM "pilot"
WHERE "pilot"."id" IS NOT NULL AND "pilot"."id" = ?`,
			);
		});
	},
);

test('/pilot?$select=trained__pilot/name', (result, sqlEquals) => {
	it('should select name from pilot', () => {
		sqlEquals(
			result,
			`\
SELECT "pilot.trained-pilot"."name"
FROM "pilot"
LEFT JOIN "pilot" AS "pilot.trained-pilot" ON "pilot"."id" = "pilot.trained-pilot"."was trained by-pilot"`,
		);
	});
});

test('/pilot?$select=trained__pilot/name,age', (result, sqlEquals) => {
	it('should select name, age from pilot', () => {
		sqlEquals(
			result,
			`\
SELECT "pilot.trained-pilot"."name", "pilot"."age"
FROM "pilot"
LEFT JOIN "pilot" AS "pilot.trained-pilot" ON "pilot"."id" = "pilot.trained-pilot"."was trained by-pilot"`,
		);
	});
});

test('/pilot?$select=*', (result, sqlEquals) => {
	it('should select * from pilot', () => {
		sqlEquals(
			result,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"`,
		);
	});
});

test('/pilot?$select=licence/id', (result, sqlEquals) => {
	it('should select licence/id for pilots', () => {
		sqlEquals(
			result,
			`\
SELECT "pilot.licence"."id"
FROM "pilot"
LEFT JOIN "licence" AS "pilot.licence" ON "pilot"."licence" = "pilot.licence"."id"`,
		);
	});
});

test('/pilot?$select=can_fly__plane/plane/id', (result, sqlEquals) => {
	it('should select can_fly__plane/plane/id for pilots', () => {
		sqlEquals(
			result,
			`\
SELECT "pilot.pilot-can fly-plane.plane"."id"
FROM "pilot"
LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"`,
		);
	});
});
