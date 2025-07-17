import test from './test.js';
import { pilotFields } from './fields.js';
const pilotFieldsStr = pilotFields.join(', ');

test('/pilot?$orderby=name', (result, sqlEquals) => {
	it('should order by name desc', () => {
		sqlEquals(
			result,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
ORDER BY "pilot"."name" DESC`,
		);
	});
});

test('/pilot?$orderby=name,age', (result, sqlEquals) => {
	it('should order by name desc, age desc', () => {
		sqlEquals(
			result,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
ORDER BY "pilot"."name" DESC,
	"pilot"."age" DESC`,
		);
	});
});

test('/pilot?$orderby=name desc', (result, sqlEquals) => {
	it('should order by name desc', () => {
		sqlEquals(
			result,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
ORDER BY "pilot"."name" DESC`,
		);
	});
});

test('/pilot?$orderby=name asc', (result, sqlEquals) => {
	it('should order by name asc', () => {
		sqlEquals(
			result,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
ORDER BY "pilot"."name" ASC`,
		);
	});
});

test('/pilot?$orderby=name asc,age desc', (result, sqlEquals) => {
	it('should order by name desc, age desc', () => {
		sqlEquals(
			result,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
ORDER BY "pilot"."name" ASC,
	"pilot"."age" DESC`,
		);
	});
});

test('/pilot?$orderby=licence/id asc', (result, sqlEquals) => {
	it('should order by licence/id asc', () => {
		sqlEquals(
			result,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
LEFT JOIN "licence" AS "pilot.licence" ON "pilot"."licence" = "pilot.licence"."id"
ORDER BY "pilot.licence"."id" ASC`,
		);
	});
});

test('/pilot?$orderby=can_fly__plane/plane/id asc', (result, sqlEquals) => {
	it('should order by pilot__can_fly__plane/plane/id asc', () => {
		sqlEquals(
			result,
			`\
SELECT ${pilotFieldsStr}
FROM "pilot"
LEFT JOIN "pilot-can fly-plane" AS "pilot.pilot-can fly-plane" ON "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
LEFT JOIN "plane" AS "pilot.pilot-can fly-plane.plane" ON "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
ORDER BY "pilot.pilot-can fly-plane.plane"."id" ASC`,
		);
	});
});

test.fail('/pilot?$orderby=favourite_colour/red', () => {
	it("should order by how red the pilot's favourite colour is");
});
