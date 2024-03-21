import * as fs from 'node:fs';
import { getTestHelpers } from './test';

const typeVocab = fs.readFileSync(
	require.resolve('@balena/sbvr-types/Type.sbvr'),
);

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

describe('reference type', function () {
	let test;
	beforeEach(() => {
		test = getTestHelpers(typeVocab);
	});

	it('informative - no foreignKey for reference field', async () => {
		test(
			`\

Term:      term
Term:      term history
Fact Type: term history references term
	Necessity: each term history references exactly one term
	Reference Type: informative		
`,
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
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				modifiedAtTrigger('term'),
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
);`,
				modifiedAtTrigger('term history'),
			],
		);
	});

	it('informative - no foreignKey for reference field - order of Reference Type and Rule is irrelevant ', function () {
		test(
			`\

Term:      term
Term:      term history
Fact Type: term history references term
	Reference Type: informative		
	Necessity: each term history references exactly one term
`,
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
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				modifiedAtTrigger('term'),
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
);`,
				modifiedAtTrigger('term history'),
			],
		);
	});

	it('strict - foreignKey for reference field', function () {
		test(
			`\
Term: 		term
Term: 		term history
Fact Type: 	term history references term
	Necessity:	each term history references exactly one term
	Reference Type: strict
`,
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
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				modifiedAtTrigger('term'),
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
,	FOREIGN KEY ("references-term") REFERENCES "term" ("id")
);`,
				modifiedAtTrigger('term history'),
			],
		);
	});

	it('default (strict) - foreignKey for reference field', function () {
		test(
			`\
Term: 		term
Term: 		term history
Fact Type: 	term history references term
	Necessity:	each term history references exactly one term
`,
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
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				modifiedAtTrigger('term'),
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
,	FOREIGN KEY ("references-term") REFERENCES "term" ("id")
);`,
				modifiedAtTrigger('term history'),
			],
		);
	});
});
