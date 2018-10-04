expect = require('chai').expect
test = require('./test')
{ pilotFields, teamFields, aliasFields, aliasPlaneFields, aliasPilotLicenceFields, aliasLicenceFields } = require('./fields')
aliasPilotFields = aliasFields('plane.pilot-can fly-plane.pilot', pilotFields).join(', ')
aliasPlaneFields = aliasPlaneFields.join(', ')
aliasPilotLicenceFields = aliasPilotLicenceFields.join(', ')
aliasLicenceFields = aliasLicenceFields.join(', ')
pilotFields = pilotFields.join(', ')
teamFields = teamFields.join(', ')

test '/pilot', (result, sqlEquals) ->
	it 'should select from pilot', ->
		sqlEquals result.query, """
			SELECT #{pilotFields}
			FROM "pilot"
		"""

test '/pilot(1)', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from pilot with id', ->
		sqlEquals result.query, """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE "pilot"."id" = ?
		"""

test "/pilot('TextKey')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from pilot with id', ->
		sqlEquals result.query, """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE "pilot"."id" = ?
		"""

test '/pilot(1)/licence', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from the licence of pilot with id', ->
		sqlEquals result.query, """
			SELECT #{aliasLicenceFields}
			FROM "pilot",
				"licence" AS "pilot.licence"
			WHERE "pilot"."id" = ?
			AND "pilot"."licence" = "pilot.licence"."id"
		"""



test '/licence(1)/is_of__pilot', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from the pilots of licence with id', ->
		sqlEquals result.query, """
			SELECT #{aliasPilotLicenceFields}
			FROM "licence",
				"pilot" AS "licence.is of-pilot"
			WHERE "licence"."id" = ?
			AND "licence"."id" = "licence.is of-pilot"."licence"
		"""


test '/pilot(1)/can_fly__plane/plane', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from the plane of pilot with id', ->
		sqlEquals result.query, """
			SELECT #{aliasPlaneFields}
			FROM "pilot",
				"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
				"plane" AS "pilot.pilot-can fly-plane.plane"
			WHERE "pilot"."id" = ?
			AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
			AND "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
		"""


test '/plane(1)/can_be_flown_by__pilot/pilot', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from the pilots of plane with id', ->
		sqlEquals result.query, """
			SELECT #{aliasPilotFields}
			FROM "plane",
				"pilot-can fly-plane" AS "plane.pilot-can fly-plane",
				"pilot" AS "plane.pilot-can fly-plane.pilot"
			WHERE "plane"."id" = ?
			AND "plane.pilot-can fly-plane"."pilot" = "plane.pilot-can fly-plane.pilot"."id"
			AND "plane"."id" = "plane.pilot-can fly-plane"."can fly-plane"
		"""


test '/pilot(1)', 'DELETE', [['Bind', 0]], (result, sqlEquals) ->
	it 'should delete the pilot with id 1', ->
		sqlEquals(result.query, '''
			DELETE FROM "pilot"
			WHERE "pilot"."id" = ?
		''')

do ->
	bindings = [
		[
			['Bind', ['pilot', 'id']]
		]
		[
			['Bind', ['pilot', 'id']]
			['Bind', 0]
		]
	]
	test '/pilot(1)', 'PUT', bindings, (result, sqlEquals) ->
		it 'should insert/update the pilot with id 1', ->
			sqlEquals(result[0].query, '''
				INSERT INTO "pilot" ("id")
				VALUES (?)
			''')
			sqlEquals(result[1].query, '''
				UPDATE "pilot"
				SET "created at" = DEFAULT,
					"id" = ?,
					"person" = DEFAULT,
					"is experienced" = DEFAULT,
					"name" = DEFAULT,
					"age" = DEFAULT,
					"favourite colour" = DEFAULT,
					"is on-team" = DEFAULT,
					"licence" = DEFAULT,
					"hire date" = DEFAULT,
					"was trained by-pilot" = DEFAULT
				WHERE "pilot"."id" = ?
			''')
	bindings = [
		['Bind', ['pilot', 'name']]
	]
	test '/pilot', 'POST', bindings, { name: 'Peter' }, (result, sqlEquals) ->
		it 'should insert/update the pilot with id 1', ->
			sqlEquals(result.query, '''
				INSERT INTO "pilot" ("name")
				VALUES (?)
			''')
	test '/pilot', 'POST', (result, sqlEquals) ->
		it 'should insert a pilot with default values', ->
			sqlEquals(result.query, '''
				INSERT INTO "pilot" DEFAULT VALUES
			''')
do ->
	bindings = [
		['Bind', ['pilot', 'is_experienced']]
		['Bind', 0]
	]
	testFunc = (result, sqlEquals) ->
		it 'should update the pilot with id 1', ->
			sqlEquals(result.query, '''
				UPDATE "pilot"
				SET "is experienced" = ?
				WHERE "pilot"."id" = ?
			''')
	test '/pilot(1)', 'PATCH', bindings, { is_experienced: true }, testFunc
	test '/pilot(1)', 'MERGE', bindings, { is_experienced: true }, testFunc


test '/pilot__can_fly__plane(1)', 'DELETE', [['Bind', 0]], (result, sqlEquals) ->
	it 'should delete the pilot with id 1', ->
		sqlEquals(result.query, '''
			DELETE FROM "pilot-can fly-plane"
			WHERE "pilot-can fly-plane"."id" = ?
		''')

do ->
	bindings = [
		[['Bind', ['pilot-can fly-plane', 'id']]]
		[
			['Bind', ['pilot-can fly-plane', 'id']]
			['Bind', 0]
		]
	]
	test '/pilot__can_fly__plane(1)', 'PUT', bindings, (result, sqlEquals) ->
		it 'should insert/update the pilot-can fly-plane with id 1', ->
			sqlEquals(result[0].query, '''
				INSERT INTO "pilot-can fly-plane" ("id")
				VALUES (?)
			''')
			sqlEquals(result[1].query, '''
				UPDATE "pilot-can fly-plane"
				SET "created at" = DEFAULT,
					"pilot" = DEFAULT,
					"can fly-plane" = DEFAULT,
					"id" = ?
				WHERE "pilot-can fly-plane"."id" = ?
			''')
	bindings = [
		['Bind', ['pilot-can fly-plane', 'pilot']]
		['Bind', ['pilot-can fly-plane', 'can_fly__plane']]
	]
	test '/pilot__can_fly__plane', 'POST', bindings, { pilot: 2, can_fly__plane: 3 }, (result, sqlEquals) ->
		it 'should insert/update the pilot-can fly-plane with id 1', ->
			sqlEquals(result.query, '''
				INSERT INTO "pilot-can fly-plane" ("pilot", "can fly-plane")
				VALUES (?, ?)
			''')
	test '/pilot__can_fly__plane', 'POST', (result, sqlEquals) ->
		it 'should insert a "pilot-can fly-plane" with default values', ->
			sqlEquals(result.query, '''
				INSERT INTO "pilot-can fly-plane" DEFAULT VALUES
			''')
do ->
	bindings = [
		['Bind', ['pilot-can fly-plane', 'pilot']]
		['Bind', 0]
	]
	testFunc = (result, sqlEquals) ->
		it 'should update the pilot with id 1', ->
			sqlEquals(result.query, '''
				UPDATE "pilot-can fly-plane"
				SET "pilot" = ?
				WHERE "pilot-can fly-plane"."id" = ?
			''')
	test '/pilot__can_fly__plane(1)', 'PATCH', bindings, { pilot: 1 }, testFunc
	test '/pilot__can_fly__plane(1)', 'MERGE', bindings, { pilot: 1 }, testFunc


test '/pilot(1)/$links/licence', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select the list of licence ids, for generating the links', ->
		sqlEquals(result.query, '''
			SELECT "pilot"."licence" AS "licence"
			FROM "pilot"
			WHERE "pilot"."id" = ?
		''')


test '/pilot(1)/can_fly__plane/$links/plane', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select the list of plane ids, for generating the links', ->
		sqlEquals(result.query, '''
			SELECT "pilot.pilot-can fly-plane"."can fly-plane" AS "plane"
			FROM "pilot",
				"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
			WHERE "pilot"."id" = ?
			AND "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
		''')


test.skip '/pilot(1)/favourite_colour/red', (result, sqlEquals) ->
	it "should select the red component of the pilot's favourite colour"


test.skip '/method(1)/child?foo=bar', (result, sqlEquals) ->
	it 'should do something..'


test "/team('purple')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select the team with the "favourite colour" id of "purple"', ->
		sqlEquals result.query, """
			SELECT #{teamFields}
			FROM "team"
			WHERE "team"."favourite colour" = ?
		"""

test '/team', 'POST', [['Bind', ['team', 'favourite_colour']]], { favourite_colour: 'purple' }, (result, sqlEquals) ->
	it 'should insert a team', ->
		sqlEquals(result.query, '''
			INSERT INTO "team" ("favourite colour")
			VALUES (?)
		''')

test '/pilot/$count/$count', (result, sqlEquals) ->
	it 'should fail because it is invalid', ->
		expect(result).to.be.instanceOf(SyntaxError)

test '/pilot/$count', (result, sqlEquals) ->
	it 'should select count(*) from pilot', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot(5)/$count', (result, sqlEquals) ->
	it 'should fail because it is invalid', ->
		expect(result).to.be.instanceOf(SyntaxError)

test '/pilot?$filter=id eq 5/$count', (result, sqlEquals) ->
	it 'should fail because it is invalid', ->
		expect(result).to.be.instanceOf(SyntaxError)

test '/pilot/$count?$filter=id gt 5', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select count(*) from pilot where pilot/id > 5 ', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
			WHERE "pilot"."id" > ?
		'''

test '/pilot/$count?$filter=id eq 5 or id eq 10', 'GET', [['Bind', 0], ['Bind', 1]], (result, sqlEquals) ->
	it 'should select count(*) from pilot where id in (5,10)', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
			WHERE "pilot"."id" IN (?, ?)
		'''

test '/pilot/$count?$filter=id eq 5 or id eq null', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select count(*) from pilot where id in (5,10)', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
			WHERE ("pilot"."id" = ?
			OR "pilot"."id" IS NULL)
		'''

test '/pilot(5)/licence/$count', 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select count(*) the licence from pilot where pilot/id', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot",
				"licence" AS "pilot.licence"
			WHERE "pilot"."id" = ?
			AND "pilot"."licence" = "pilot.licence"."id"
		'''

test '/pilot/$count?$orderby=id asc', (result, sqlEquals) ->
	it 'should select count(*) from pilot and ignore orderby', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot/$count?$skip=5', (result, sqlEquals) ->
	it 'should select count(*) from pilot and ignore skip', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot/$count?$top=5', (result, sqlEquals) ->
	it 'should select count(*) from pilot and ignore top', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot/$count?$top=5&$skip=5', (result, sqlEquals) ->
	it 'should select count(*) from pilot and ignore top and skip', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot/$count?$select=id', (result, sqlEquals) ->
	it 'should select count(*) from pilot and ignore select', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''
