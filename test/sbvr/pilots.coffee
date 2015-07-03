typeVocab = require('fs').readFileSync(require.resolve('@resin/sbvr-types/Type.sbvr'))
test = require('./test')(typeVocab)

describe 'pilots', ->
	test '''
		Term:      name
			Concept Type: Short Text (Type)
		Term:      years of experience
			Concept Type: Integer (Type)
		Term:      pilot
			Reference Scheme: name
		Term:      plane
			Reference Scheme: name
		Fact Type: pilot has name
			Necessity: each pilot has exactly one name
		Fact Type: pilot has years of experience
			Necessity: each pilot has exactly one years of experience
		Fact Type: plane has name
			Necessity: each plane has exactly one name
		Fact type: pilot can fly plane
		Fact type: pilot is experienced
		Term: veteran pilot
			Definition: pilot that can fly at least 2 planes
		Rule:       It is necessary that each pilot can fly at least 1 plane
		Rule:       It is necessary that each pilot that is experienced, can fly at least 2 planes
		Rule:       It is necessary that each pilot that is not experienced, can fly at most 2 planes
		Rule:       It is necessary that each pilot that can fly at most 2 planes, is not experienced

		Rule:       It is necessary that each plane that at least 3 pilots can fly, has a name
		Rule:       It is necessary that each plane that at least 3 pilots that are experienced can fly, has a name
		Rule:       It is necessary that each plane that at least 3 pilots that a name is of can fly, has a name
	''', [
		'''
			CREATE TABLE IF NOT EXISTS "pilot" (
				"id" SERIAL NOT NULL PRIMARY KEY
			,	"name" VARCHAR(255) NOT NULL
			,	"years of experience" INTEGER NOT NULL
			,	"is experienced" INTEGER DEFAULT 0 NOT NULL
			);
		'''
		'''
			CREATE TABLE IF NOT EXISTS "plane" (
				"id" SERIAL NOT NULL PRIMARY KEY
			,	"name" VARCHAR(255) NOT NULL
			);
		'''
		'''
			CREATE TABLE IF NOT EXISTS "pilot-can_fly-plane" (
				"pilot" INTEGER NOT NULL
			,	"plane" INTEGER NOT NULL
			,	"id" SERIAL NOT NULL PRIMARY KEY
			,	FOREIGN KEY ("pilot") REFERENCES "pilot" ("id")
			,	FOREIGN KEY ("plane") REFERENCES "plane" ("id")
			,	UNIQUE("pilot", "plane")
			);
		'''
		'''
			CREATE TABLE IF NOT EXISTS "veteran_pilot" (
				"id" SERIAL NOT NULL PRIMARY KEY
			);
		'''
	]
