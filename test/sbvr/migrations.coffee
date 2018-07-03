fs = require('fs')
typeVocab = fs.readFileSync(require.resolve('@resin/sbvr-types/Type.sbvr'))
test = require('./test')(typeVocab)

describe 'migrations', ->
	console.log(test)
	test.skip '''
			Term:      name
				Concept Type: Short Text (Type)
			Term:      person

			Fact Type: person has name
				Necessity: each person has exactly one name
		''',
		'''
			Term:      person
		''', [ '''
			ALTER TABLE "person"
				DROP COLUMN IF EXISTS "name";
		''' ]

	test.migration '''
			Term:      person
		''', '''
			Term:      name
				Concept Type: Short Text (Type)
			Term:      person

			Fact Type: person has name
				Necessity: each person has exactly one name
		''', [ '''
		ALTER TABLE "person"
			ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL;
		''' ]

	test.migration '''
			Term:      name
				Synonym: full name
				Concept Type: Short Text (Type)
			Term:      person

			Fact Type: person has name
				Necessity: each person has exactly one name
		''', '''
			Term:      full  name
				Concept Type: Short Text (Type)
			Term:      person

			Fact Type: person has full name
				Necessity: each person has exactly one full name
		''', [ '''
		ALTER TABLE "person"
			RENAME COLUMN "name" TO "full name";
		''' ]

	test.migration '''
			Term:      name
				Concept Type: Short Text (Type)
			Term:      person
			Fact Type: person has name
				Necessity: each person has exactly one name
		''',
		'''
			Term:      name
				Concept Type: Short Text (Type)
			Term:      years of experience
				Concept Type: Integer (Type)
			Term:      person
			Fact Type: person has name
				Necessity: each person has exactly one name
			Fact Type: person has years of experience
				Necessity: each person has exactly one years of experience
		''', [ '''
		ALTER TABLE "person"
			ADD COLUMN IF NOT EXISTS "years of experience" INTEGER NOT NULL;
		''' ]

	test.migration '''
		Term: actor
		''',
		'''
			Term: actor
			Term: user
				Concept Type: actor
		''', [ '''
		CREATE TABLE IF NOT EXISTS "user" (
			"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
		,	"id" SERIAL NOT NULL PRIMARY KEY
		,	"actor" INTEGER NOT NULL
		,	FOREIGN KEY ("actor") REFERENCES "actor" ("id")
		);
		''' ]

	test.migration '''
		Term: pilot
		Term: plane

		Fact type:  pilot can fly plane
			Synonymous Form: plane can be flown by pilot
		''',
		'''
		Term: pilot
		Term: plane

		Fact type:  plane can be flown by pilot
		''', [ '''
			ALTER TABLE "pilot-can fly-plane"
				RENAME TO "plane-can be flown by-pilot";
			ALTER TABLE "plane-can be flown by-pilot"
				RENAME COLUMN "pilot" TO "can be flown by-pilot";
			ALTER TABLE "plane-can be flown by-pilot"
				RENAME COLUMN "can fly-plane" TO "plane";
		''' ]
