import * as fs from 'node:fs';
const typeVocab = fs.readFileSync(
	require.resolve('@balena/sbvr-types/Type.sbvr'),
);
import { getTestHelpers } from './test';
const test = getTestHelpers(typeVocab);

const modifiedAtTrigger = (tableName) => `\
DO
$$
BEGIN
IF NOT EXISTS(
	SELECT 1
	FROM "information_schema"."triggers"
	WHERE "event_object_table" = '${tableName}'
	AND "trigger_name" = '${tableName}_trigger_update_modified_at'
) THEN
	CREATE TRIGGER "${tableName}_trigger_update_modified_at"
	BEFORE UPDATE ON "${tableName}"
	FOR EACH ROW
	EXECUTE PROCEDURE "trigger_update_modified_at"();
END IF;
END;
$$`;

describe('pilots', function () {
	test(
		`\
Term:      name
	Concept Type: Short Text (Type)
Term:      years of experience
	Concept Type: Integer (Type)
Term:      person
Term:      pilot
	Concept Type: person
	Reference Scheme: name
Term:      plane
	Reference Scheme: name
Fact Type: pilot has name
	Necessity: each pilot has exactly one name
Fact Type: pilot has years of experience
	Necessity: each pilot has exactly one years of experience
Fact Type: plane has name
	Necessity: each plane has exactly one name
	Definition: "planeA" or "planeB" or "planeC"
Fact Type: pilot can fly plane
	Synonymous Form: plane can be flown by pilot
Fact Type: pilot is experienced
Term: veteran pilot
	Definition: pilot that can fly at least 2 planes

-- Test circular dependency
Term: licence
Fact type: pilot has licence
	Necessity: each pilot has exactly one licence
Fact type: licence was granted by pilot
	Necessity: each licence was granted by exactly one pilot`,
		[
			`\
DO $$
BEGIN
	PERFORM '"trigger_update_modified_at"()'::regprocedure;
EXCEPTION WHEN undefined_function THEN
	CREATE FUNCTION "trigger_update_modified_at"()
	RETURNS TRIGGER AS $fn$
	BEGIN
		NEW."modified at" = NOW();
RETURN NEW;
	END;
	$fn$ LANGUAGE plpgsql;
END;
$$;`,
			`\
CREATE TABLE IF NOT EXISTS "person" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
			modifiedAtTrigger('person'),
			`\
CREATE TABLE IF NOT EXISTS "plane" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"name" VARCHAR(255) NOT NULL CHECK ("name" IN ('planeA', 'planeB', 'planeC'))
);`,
			modifiedAtTrigger('plane'),
			`\
CREATE TABLE IF NOT EXISTS "veteran pilot" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
			modifiedAtTrigger('veteran pilot'),
			`\
CREATE TABLE IF NOT EXISTS "licence" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"was granted by-pilot" INTEGER NOT NULL
);`,
			modifiedAtTrigger('licence'),
			`\
CREATE TABLE IF NOT EXISTS "pilot" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"person" INTEGER NOT NULL
,	"name" VARCHAR(255) NOT NULL
,	"years of experience" INTEGER NOT NULL
,	"is experienced" BOOLEAN DEFAULT FALSE NOT NULL
,	"licence" INTEGER NOT NULL
,	FOREIGN KEY ("person") REFERENCES "person" ("id")
,	FOREIGN KEY ("licence") REFERENCES "licence" ("id")
);`,
			modifiedAtTrigger('pilot'),
			`\
CREATE TABLE IF NOT EXISTS "pilot-can fly-plane" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"pilot" INTEGER NOT NULL
,	"can fly-plane" INTEGER NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	FOREIGN KEY ("pilot") REFERENCES "pilot" ("id")
,	FOREIGN KEY ("can fly-plane") REFERENCES "plane" ("id")
,	UNIQUE("pilot", "can fly-plane")
);`,
			modifiedAtTrigger('pilot-can fly-plane'),
			`\
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu USING (constraint_catalog, constraint_schema, constraint_name)
		JOIN information_schema.constraint_column_usage ccu USING (constraint_catalog, constraint_schema, constraint_name)
		WHERE constraint_type = 'FOREIGN KEY'
			AND tc.table_schema = CURRENT_SCHEMA()
			AND tc.table_name = 'licence'
			AND kcu.column_name = 'was granted by-pilot'
			AND ccu.table_schema = CURRENT_SCHEMA()
			AND ccu.table_name = 'pilot'
			AND ccu.column_name = 'id'
	) THEN
		ALTER TABLE "licence"
		ADD CONSTRAINT "licence_was granted by-pilot_fkey"
		FOREIGN KEY ("was granted by-pilot") REFERENCES "pilot" ("id");
	END IF;
END;
$$;`,
		],
	);

	test.rule(
		'It is necessary that each pilot can fly at least 1 plane',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE NOT EXISTS (
		SELECT 1
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 2 planes',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
			WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
		) >= 2
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is not experienced, can fly at most 2 planes',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = FALSE
	AND (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that can fly at most 2 planes, is not experienced',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
			WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
		) >= 3
	)
	AND "pilot.0"."is experienced" != FALSE
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each plane that at least 3 pilots can fly, has a name',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0"
	WHERE (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.1-can fly-plane.0"
		WHERE "pilot.1-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	) >= 3
	AND "plane.0"."name" IS NULL
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each plane that at least 3 pilots that are experienced can fly, has a name',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0"
	WHERE (
		SELECT COUNT(*)
		FROM "pilot" AS "pilot.1",
			"pilot-can fly-plane" AS "pilot.1-can fly-plane.0"
		WHERE "pilot.1"."is experienced" = TRUE
		AND "pilot.1-can fly-plane.0"."pilot" = "pilot.1"."id"
		AND "pilot.1-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	) >= 3
	AND "plane.0"."name" IS NULL
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	(function () {
		const sql = `\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0"
	WHERE (
		SELECT COUNT(*)
		FROM "pilot" AS "pilot.1",
			"pilot-can fly-plane" AS "pilot.1-can fly-plane.0"
		WHERE "pilot.1"."is experienced" = FALSE
		AND "pilot.1-can fly-plane.0"."pilot" = "pilot.1"."id"
		AND "pilot.1-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	) >= 3
	AND "plane.0"."name" IS NULL
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`;
		test.rule(
			'It is necessary that each plane that at least 3 pilots that are not experienced can fly, has a name',
			sql,
		);
		test.rule(
			"It is necessary that each plane that at least 3 pilots that aren't experienced can fly, has a name",
			sql,
		);
	})();

	test.rule(
		'It is necessary that each plane that at least 3 pilot that is experienced, can fly, has a name.',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0"
	WHERE (
		SELECT COUNT(*)
		FROM "pilot" AS "pilot.1",
			"pilot-can fly-plane" AS "pilot.1-can fly-plane.0"
		WHERE "pilot.1"."is experienced" = TRUE
		AND "pilot.1-can fly-plane.0"."pilot" = "pilot.1"."id"
		AND "pilot.1-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	) >= 3
	AND "plane.0"."name" IS NULL
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each plane that at least 3 pilots that a name is of can fly, has a name',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0"
	WHERE (
		SELECT COUNT(*)
		FROM "pilot" AS "pilot.1",
			"pilot-can fly-plane" AS "pilot.1-can fly-plane.0"
		WHERE "pilot.1"."name" IS NOT NULL
		AND "pilot.1-can fly-plane.0"."pilot" = "pilot.1"."id"
		AND "pilot.1-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	) >= 3
	AND "plane.0"."name" IS NULL
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot has a years of experience that is greater than 0',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE NOT (
		0 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each plane can be flown by at least 1 pilot',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0"
	WHERE NOT EXISTS (
		SELECT 1
		FROM "pilot-can fly-plane" AS "pilot.1-can fly-plane.0"
		WHERE "pilot.1-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	)
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	// OR
	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 2 planes or has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND NOT (
		((
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
			WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
		) >= 2
		OR 5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL)
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced or can fly at least 2 planes, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ("pilot.0"."is experienced" = TRUE
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 2)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced or can fly at least 3 planes or can fly exactly one plane, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ("pilot.0"."is experienced" = TRUE
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) = 1)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 3 planes or exactly one plane',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND NOT (
		((
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
			WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
		) >= 3
		OR (
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
			WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
		) = 1)
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that can fly at least 3 planes or exactly one plane, is experienced',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ((
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) = 1)
	AND "pilot.0"."is experienced" != TRUE
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot can fly at least one plane or a pilot can fly at least 10 planes',
		`\
SELECT ((
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE NOT EXISTS (
		SELECT 1
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	)
) = 0
OR EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.2"
	WHERE (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.2-can fly-plane.3"
		WHERE "pilot.2-can fly-plane.3"."pilot" = "pilot.2"."id"
	) >= 10
)) AS "result";`,
	);

	test.rule(
		'It is necessary that each plane that at least 3 pilots can fly or exactly one pilot can fly, has a name',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0"
	WHERE ((
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.1-can fly-plane.0"
		WHERE "pilot.1-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	) >= 3
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.2-can fly-plane.0"
		WHERE "pilot.2-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	) = 1)
	AND "plane.0"."name" IS NULL
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	// AND
	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 2 planes and has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
			WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
		) >= 2
		AND 5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced and can fly at least 2 planes, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 2
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 3 planes and exactly one plane',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
			WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
		) >= 3
		AND (
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
			WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
		) = 1
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that can fly at least 3 planes and exactly one plane, is experienced',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	AND (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) = 1
	AND "pilot.0"."is experienced" != TRUE
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot can fly at least one plane and a pilot can fly at least 10 planes',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE NOT EXISTS (
		SELECT 1
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	)
) = 0
AND EXISTS (
	SELECT 1
	FROM "pilot" AS "pilot.2"
	WHERE (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.2-can fly-plane.3"
		WHERE "pilot.2-can fly-plane.3"."pilot" = "pilot.2"."id"
	) >= 10
) AS "result";`,
	);

	test.rule(
		'It is necessary that each plane that at least 3 pilots can fly and exactly one pilot can fly, has a name',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "plane" AS "plane.0"
	WHERE (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.1-can fly-plane.0"
		WHERE "pilot.1-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	) >= 3
	AND (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.2-can fly-plane.0"
		WHERE "pilot.2-can fly-plane.0"."can fly-plane" = "plane.0"."id"
	) = 1
	AND "plane.0"."name" IS NULL
	AND ($1 = '{}'
	OR "plane.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	// AND / OR
	test.rule(
		'It is necessary that each pilot that is experienced and can fly at least 3 planes or can fly exactly one plane, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND ((
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) = 1)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that can fly at least 3 planes or can fly exactly one plane and is experienced, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ((
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) = 1
	AND "pilot.0"."is experienced" = TRUE)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	// Commas
	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 3 planes, and can fly at most 10 planes, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	AND NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
			WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
		) >= 11
	)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 3 planes, or can fly exactly one plane, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ("pilot.0"."is experienced" = TRUE
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) = 1)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 3 planes, and can fly at most 10 planes or has a name that has a Length (Type) that is greater than 10, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	AND (NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
			WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
		) >= 11
	)
	OR 10 < LENGTH("pilot.0"."name")
	AND LENGTH("pilot.0"."name") IS NOT NULL
	AND "pilot.0"."name" IS NOT NULL)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 3 planes, or can fly exactly one plane and has a name that has a Length (Type) that is greater than 10, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ("pilot.0"."is experienced" = TRUE
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) = 1
	AND 10 < LENGTH("pilot.0"."name")
	AND LENGTH("pilot.0"."name") IS NOT NULL
	AND "pilot.0"."name" IS NOT NULL)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 3 planes, or can fly exactly one plane and has a name that has a Length (Type) that is greater than 10, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ("pilot.0"."is experienced" = TRUE
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) = 1
	AND 10 < LENGTH("pilot.0"."name")
	AND LENGTH("pilot.0"."name") IS NOT NULL
	AND "pilot.0"."name" IS NOT NULL)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least 3 planes, or can fly exactly one plane and has a name that has a Length (Type) that is greater than 10, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ("pilot.0"."is experienced" = TRUE
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) >= 3
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) = 1
	AND 10 < LENGTH("pilot.0"."name")
	AND LENGTH("pilot.0"."name") IS NOT NULL
	AND "pilot.0"."name" IS NOT NULL)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly exactly one plane or can fly at least 5 planes, and can fly at least 3 planes, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND ((
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) = 1
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) >= 5)
	AND (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.3"
		WHERE "pilot.0-can fly-plane.3"."pilot" = "pilot.0"."id"
	) >= 3
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at least one plane and can fly at most 5 planes, or can fly at least 3 planes, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ("pilot.0"."is experienced" = TRUE
	OR EXISTS (
		SELECT 1
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	)
	AND NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
			WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
		) >= 6
	)
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.3"
		WHERE "pilot.0-can fly-plane.3"."pilot" = "pilot.0"."id"
	) >= 3)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly at most 10 planes or has a name that has a Length (Type) that is greater than 10, and can fly at least 3 planes, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE "pilot.0"."is experienced" = TRUE
	AND (NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
			WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
		) >= 11
	)
	OR 10 < LENGTH("pilot.0"."name")
	AND LENGTH("pilot.0"."name") IS NOT NULL
	AND "pilot.0"."name" IS NOT NULL)
	AND (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.4"
		WHERE "pilot.0-can fly-plane.4"."pilot" = "pilot.0"."id"
	) >= 3
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that is experienced, can fly exactly one plane and has a name that has a Length (Type) that is greater than 10, or can fly at least 3 planes, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE ("pilot.0"."is experienced" = TRUE
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	) = 1
	AND 10 < LENGTH("pilot.0"."name")
	AND LENGTH("pilot.0"."name") IS NOT NULL
	AND "pilot.0"."name" IS NOT NULL
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.4"
		WHERE "pilot.0-can fly-plane.4"."pilot" = "pilot.0"."id"
	) >= 3)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that can fly at most 10 planes or can fly at least 15 planes, and is experienced and can fly at least 3 planes, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE (NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
			WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
		) >= 11
	)
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
	) >= 15)
	AND "pilot.0"."is experienced" = TRUE
	AND (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.3"
		WHERE "pilot.0-can fly-plane.3"."pilot" = "pilot.0"."id"
	) >= 3
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot that can fly at least one plane and at most 10 planes, or is experienced or can fly at least 3 planes, has a years of experience that is greater than 5',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0"
	WHERE (EXISTS (
		SELECT 1
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
		WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	)
	AND NOT (
		(
			SELECT COUNT(*)
			FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
			WHERE "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
		) >= 11
	)
	OR "pilot.0"."is experienced" = TRUE
	OR (
		SELECT COUNT(*)
		FROM "pilot-can fly-plane" AS "pilot.0-can fly-plane.3"
		WHERE "pilot.0-can fly-plane.3"."pilot" = "pilot.0"."id"
	) >= 3)
	AND NOT (
		5 < "pilot.0"."years of experience"
		AND "pilot.0"."years of experience" IS NOT NULL
	)
	AND ($1 = '{}'
	OR "pilot.0"."id" = ANY(CAST($1 AS INTEGER[])))
) = 0 AS "result";`,
	);

	test.rule(
		'It is necessary that each pilot0 that can fly a plane0, can fly a plane1 that can be flown by a pilot1 that can fly the plane0',
		`\
SELECT (
	SELECT COUNT(*)
	FROM "pilot" AS "pilot.0",
		"plane" AS "plane.1",
		"pilot-can fly-plane" AS "pilot.0-can fly-plane.1"
	WHERE "pilot.0-can fly-plane.1"."pilot" = "pilot.0"."id"
	AND "pilot.0-can fly-plane.1"."can fly-plane" = "plane.1"."id"
	AND NOT EXISTS (
		SELECT 1
		FROM "plane" AS "plane.2",
			"pilot" AS "pilot.3",
			"pilot-can fly-plane" AS "pilot.3-can fly-plane.1",
			"pilot-can fly-plane" AS "pilot.3-can fly-plane.2",
			"pilot-can fly-plane" AS "pilot.0-can fly-plane.2"
		WHERE "pilot.3-can fly-plane.1"."pilot" = "pilot.3"."id"
		AND "pilot.3-can fly-plane.1"."can fly-plane" = "plane.1"."id"
		AND "pilot.3-can fly-plane.2"."pilot" = "pilot.3"."id"
		AND "pilot.3-can fly-plane.2"."can fly-plane" = "plane.2"."id"
		AND "pilot.0-can fly-plane.2"."pilot" = "pilot.0"."id"
		AND "pilot.0-can fly-plane.2"."can fly-plane" = "plane.2"."id"
	)
) = 0 AS "result";`,
	);
});
