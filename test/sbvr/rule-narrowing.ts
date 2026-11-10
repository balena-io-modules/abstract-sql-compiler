import fs from 'node:fs';
import { expect } from 'chai';
import type { SqlModel } from '../../out/abstract-sql-compiler.js';
import { getTestHelpers } from './test.ts';

const typeVocab = fs.readFileSync(
	new URL(import.meta.resolve('@balena/sbvr-types/Type.sbvr')),
	'utf8',
);
const test = getTestHelpers(typeVocab);

const vocab = `\
Term:      licence type
Term:      airline
Term:      plane
Term:      pilot
Fact Type: airline is certified
Fact Type: airline is for licence type
	Necessity: each airline is for exactly one licence type
Fact Type: plane belongs to airline
	Synonymous Form: airline owns plane
	Necessity: each plane belongs to exactly one airline
Fact Type: plane is airworthy
Fact Type: pilot has licence type
	Necessity: each pilot has exactly one licence type
Fact Type: pilot is employed by airline
	Necessity: each pilot is employed by exactly one airline
Fact Type: pilot is assigned to plane
	Synonymous Form: plane is flown by pilot
	Necessity: each pilot is assigned to at most one plane`;

describe('rule narrowing', function () {
	test(vocab, (result: SqlModel | Error) => {
		expect(result).to.not.be.an('error');
	});

	test.rule(
		'It is necessary that each plane that is flown by a pilot, is airworthy.',
		(result: SqlModel | Error) => {
			if (result instanceof Error) {
				throw result;
			}
			const rule = result.rules.at(-1);
			// Besides the root table (plane), the pilot is also narrowed since it's
			// selected only once, in the top level FROM of the rule
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
		'It is necessary that each pilot that is assigned to a plane, is employed by an airline that owns the plane.',
		// The root table (pilot) is narrowed, and so is the plane that is selected only once,
		// in the top level FROM, while the airline is only selected in a subquery so it's not narrowed
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
		'It is necessary that each plane that is flown by a pilot that has a licence type, belongs to an airline that is certified and is for the licence type.',
		// All the tables selected only once in the top level FROM are narrowed,
		// but not the airline that is only selected in a subquery
		`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0",
		"pilot" AS "pilot.1",
		"licence type" AS "licence type.2"
	WHERE "pilot.1"."licence type" = "licence type.2"."id"
	AND "pilot.1"."is assigned to-plane" = "plane.0"."id"
	AND NOT EXISTS (
		SELECT 1
		FROM "airline" AS "airline.3"
		WHERE "airline.3"."is certified" = TRUE
		AND "airline.3"."is for-licence type" = "licence type.2"."id"
		AND "plane.0"."belongs to-airline" = "airline.3"."id"
	)
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
	AND ($2 = '{}'
	OR "pilot.1"."id" = ANY(CAST($2 AS INTEGER[])))
	AND ($3 = '{}'
	OR "licence type.2"."id" = ANY(CAST($3 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each plane that is flown by a pilot1, is flown by at most one pilot2.',
		// The pilot is selected twice (in the top level FROM and in a subquery) so it must not be narrowed
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
