import { expect } from 'chai';
import type { SqlModel } from '../../out/abstract-sql-compiler.js';
import { getTestHelpers } from './test.ts';

const test = getTestHelpers();

describe('rule narrowing', function () {
	test(`\
Term:      airline
Term:      plane
Term:      pilot
Fact Type: airline is certified
Fact Type: plane belongs to airline
	Synonymous Form: airline owns plane
	Necessity: each plane belongs to exactly one airline
Fact Type: plane is airworthy
Fact Type: pilot is employed by airline
	Synonymous Form: airline employs pilot
	Necessity: each pilot is employed by exactly one airline
Fact Type: pilot is assigned to plane
	Synonymous Form: plane is flown by pilot
	Necessity: each pilot is assigned to at most one plane
Fact Type: pilot can fly plane
	Synonymous Form: plane can be flown by pilot
Fact Type: pilot is experienced`, (result: SqlModel | Error) => {
		expect(result).to.not.be.an('error');
	});

	test.rule(
		'It is necessary that each plane that is flown by a pilot, is airworthy.',
		(result: SqlModel | Error) => {
			if (result instanceof Error) {
				throw result;
			}
			const rule = result.rules.at(-1);
			// Both tables are only selected once, in the top level `FROM`, so each of them is
			// narrowed by a bind for its affected ids
			expect(rule)
				.to.have.property('bindings')
				.that.deep.equals([
					['Bind', 'plane'],
					['Bind', 'pilot'],
				]);
			expect(rule).to.have.property('sql').that.equals(`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0",
		"pilot" AS "pilot.1"
	WHERE "pilot.1"."is assigned to-plane" = "plane.0"."id"
	AND "plane.0"."is airworthy" != TRUE
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
	AND ($2 = '{}'
	OR "pilot.1"."id" = ANY(CAST($2 AS INTEGER[])))
) = 0 AS "result";`);
		},
	);

	test.rule(
		'It is necessary that each pilot that can fly a plane, is experienced.',
		// A table for a fact type is narrowed like any other
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0",
		"pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
	WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	AND "pilot.0"."is experienced" != TRUE
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
	AND ($2 = '{}'
	OR "pilot.0-can fly-plane.1"."id" = ANY(CAST($2 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is assigned to a plane, is employed by an airline that owns the plane.',
		// The airline is selected in a subquery so it is not narrowed
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0",
		"plane" AS "plane.1"
	WHERE "pilot.0"."is assigned to-plane" = "plane.1"."id"
	AND NOT EXISTS (
		SELECT 1
		FROM "airline" AS "airline.2"
		WHERE "plane.1"."belongs to-airline" = "airline.2"."id"
		AND "pilot.0"."is employed by-airline" = "airline.2"."id"
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
	AND ($2 = '{}'
	OR "plane.1"."id" = ANY(CAST($2 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each airline that is certified, employs at least one pilot that is experienced.',
		// The pilot is only selected in a subquery so it is not narrowed
		`\
SELECT (
	SELECT COUNT(*)
	FROM "airline" AS "airline.0"
	WHERE "airline.0"."is certified" = TRUE
	AND NOT EXISTS (
		SELECT 1
		FROM "pilot" AS "pilot.1"
		WHERE "pilot.1"."is experienced" = TRUE
		AND "pilot.1"."is employed by-airline" = "airline.0"."id"
	)
	AND ($1 = '{}'
	OR "airline.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each plane that is flown by a pilot1, is flown by at most one pilot2.',
		// The pilot is selected both in the top level `FROM` and in a subquery so it is not narrowed
		`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0",
		"pilot" AS "pilot.1"
	WHERE "pilot.1"."is assigned to-plane" = "plane.0"."id"
	AND (
		SELECT COUNT(*)
		FROM "pilot" AS "pilot.2"
		WHERE "pilot.2"."is assigned to-plane" = "plane.0"."id"
	) >= 2
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);
});
