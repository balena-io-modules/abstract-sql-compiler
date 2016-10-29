expect = require('chai').expect
test = require('./test')
{ pilotFields, teamFields, aliasFields, aliasPlaneFields, aliasPilotLicenceFields, aliasLicenceFields } = require('./fields')
aliasPilotFields = aliasFields('plane.pilot-can_fly-plane.pilot', pilotFields).join(', ')
aliasPlaneFields = aliasPlaneFields.join(', ')
aliasPilotLicenceFields = aliasPilotLicenceFields.join(', ')
aliasLicenceFields = aliasLicenceFields.join(', ')
pilotFields = pilotFields.join(', ')
teamFields = teamFields.join(', ')

test '/pilot', (result) ->
	it 'should select from pilot', ->
		expect(result.query).to.equal """
			SELECT #{pilotFields}
			FROM "pilot"
		"""

test '/pilot(1)', 'GET', [['Bind', 0]], (result) ->
	it 'should select from pilot with id', ->
		expect(result.query).to.equal """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE "pilot"."id" = ?
		"""

test "/pilot('TextKey')", 'GET', [['Bind', 0]], (result) ->
	it 'should select from pilot with id', ->
		expect(result.query).to.equal """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE "pilot"."id" = ?
		"""

test '/pilot(1)/licence', 'GET', [['Bind', 0]], (result) ->
	it 'should select from the licence of pilot with id', ->
		expect(result.query).to.equal """
			SELECT #{aliasLicenceFields}
			FROM "pilot",
				"licence" AS "pilot.licence"
			WHERE "pilot"."id" = ?
			AND "pilot.licence"."id" = "pilot"."licence"
		"""



test '/licence(1)/pilot', 'GET', [['Bind', 0]], (result) ->
	it 'should select from the pilots of licence with id', ->
		expect(result.query).to.equal """
			SELECT #{aliasPilotLicenceFields}
			FROM "licence",
				"pilot" AS "licence.pilot"
			WHERE "licence"."id" = ?
			AND "licence"."id" = "licence.pilot"."licence"
		"""


test '/pilot(1)/pilot__can_fly__plane/plane', 'GET', [['Bind', 0]], (result) ->
	it 'should select from the plane of pilot with id', ->
		expect(result.query).to.equal """
			SELECT #{aliasPlaneFields}
			FROM "pilot",
				"pilot-can_fly-plane" AS "pilot.pilot-can_fly-plane",
				"plane" AS "pilot.pilot-can_fly-plane.plane"
			WHERE "pilot"."id" = ?
			AND "pilot.pilot-can_fly-plane.plane"."id" = "pilot.pilot-can_fly-plane"."plane"
			AND "pilot"."id" = "pilot.pilot-can_fly-plane"."pilot"
		"""


test '/plane(1)/pilot__can_fly__plane/pilot', 'GET', [['Bind', 0]], (result) ->
	it 'should select from the pilots of plane with id', ->
		expect(result.query).to.equal """
			SELECT #{aliasPilotFields}
			FROM "plane",
				"pilot-can_fly-plane" AS "plane.pilot-can_fly-plane",
				"pilot" AS "plane.pilot-can_fly-plane.pilot"
			WHERE "plane"."id" = ?
			AND "plane.pilot-can_fly-plane.pilot"."id" = "plane.pilot-can_fly-plane"."pilot"
			AND "plane"."id" = "plane.pilot-can_fly-plane"."plane"
		"""


test '/pilot(1)', 'DELETE', [['Bind', 0]], (result) ->
	it 'should delete the pilot with id 1', ->
		expect(result.query).to.equal('''
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
	test '/pilot(1)', 'PUT', bindings, (result) ->
		it 'should insert/update the pilot with id 1', ->
			expect(result[0].query).to.equal('''
				INSERT INTO "pilot" ("id")
				VALUES (?)
			''')
			expect(result[1].query).to.equal('''
				UPDATE "pilot"
				SET "created at" = DEFAULT,
					"id" = ?,
					"person" = DEFAULT,
					"is experienced" = DEFAULT,
					"name" = DEFAULT,
					"age" = DEFAULT,
					"favourite colour" = DEFAULT,
					"team" = DEFAULT,
					"licence" = DEFAULT,
					"hire date" = DEFAULT,
					"pilot" = DEFAULT
				WHERE "pilot"."id" = ?
			''')
	bindings = [
		['Bind', ['pilot', 'name']]
	]
	test '/pilot', 'POST', bindings, { name: 'Peter' }, (result) ->
		it 'should insert/update the pilot with id 1', ->
			expect(result.query).to.equal('''
				INSERT INTO "pilot" ("name")
				VALUES (?)
			''')
	test '/pilot', 'POST', (result) ->
		it 'should insert a pilot with default values', ->
			expect(result.query).to.equal('''
				INSERT INTO "pilot" DEFAULT VALUES
			''')
do ->
	bindings = [
		['Bind', ['pilot', 'id']]
		['Bind', ['pilot', 'is_experienced']]
		['Bind', 0]
	]
	testFunc = (result) ->
		it 'should insert/update the pilot with id 1', ->
			expect(result.query).to.equal('''
				UPDATE "pilot"
				SET "id" = ?,
					"is experienced" = ?
				WHERE "pilot"."id" = ?
			''')
	test '/pilot(1)', 'PATCH', bindings, { is_experienced: true }, testFunc
	test '/pilot(1)', 'MERGE', bindings, { is_experienced: true }, testFunc


test '/pilot__can_fly__plane(1)', 'DELETE', [['Bind', 0]], (result) ->
	it 'should delete the pilot with id 1', ->
		expect(result.query).to.equal('''
			DELETE FROM "pilot-can_fly-plane"
			WHERE "pilot-can_fly-plane"."id" = ?
		''')

do ->
	bindings = [
		[['Bind', ['pilot__can_fly__plane', 'id']]]
		[
			['Bind', ['pilot__can_fly__plane', 'id']]
			['Bind', 0]
		]
	]
	test '/pilot__can_fly__plane(1)', 'PUT', bindings, (result) ->
		it 'should insert/update the pilot-can_fly-plane with id 1', ->
			expect(result[0].query).to.equal('''
				INSERT INTO "pilot-can_fly-plane" ("id")
				VALUES (?)
			''')
			expect(result[1].query).to.equal('''
				UPDATE "pilot-can_fly-plane"
				SET "created at" = DEFAULT,
					"pilot" = DEFAULT,
					"plane" = DEFAULT,
					"id" = ?
				WHERE "pilot-can_fly-plane"."id" = ?
			''')
	bindings = [
		['Bind', ['pilot__can_fly__plane', 'pilot']]
		['Bind', ['pilot__can_fly__plane', 'plane']]
	]
	test '/pilot__can_fly__plane', 'POST', bindings, { pilot: 2, plane: 3 }, (result) ->
		it 'should insert/update the pilot-can_fly-plane with id 1', ->
			expect(result.query).to.equal('''
				INSERT INTO "pilot-can_fly-plane" ("pilot", "plane")
				VALUES (?, ?)
			''')
	test '/pilot__can_fly__plane', 'POST', (result) ->
		it 'should insert a "pilot-can_fly-plane" with default values', ->
			expect(result.query).to.equal('''
				INSERT INTO "pilot-can_fly-plane" DEFAULT VALUES
			''')
do ->
	bindings = [
		['Bind', ['pilot__can_fly__plane', 'pilot']]
		['Bind', ['pilot__can_fly__plane', 'id']]
		['Bind', 0]
	]
	testFunc = (result) ->
		it 'should insert/update the pilot with id 1', ->
			expect(result.query).to.equal('''
				UPDATE "pilot-can_fly-plane"
				SET "pilot" = ?,
					"id" = ?
				WHERE "pilot-can_fly-plane"."id" = ?
			''')
	test '/pilot__can_fly__plane(1)', 'PATCH', bindings, { pilot: 1 }, testFunc
	test '/pilot__can_fly__plane(1)', 'MERGE', bindings, { pilot: 1 }, testFunc


test '/pilot(1)/$links/licence', 'GET', [['Bind', 0]], (result) ->
	it 'should select the list of licence ids, for generating the links', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."licence" AS "licence"
			FROM "pilot"
			WHERE "pilot"."id" = ?
		''')


test '/pilot(1)/pilot__can_fly__plane/$links/plane', 'GET', [['Bind', 0]], (result) ->
	it 'should select the list of plane ids, for generating the links', ->
		expect(result.query).to.equal('''
			SELECT "pilot.pilot-can_fly-plane"."plane" AS "plane"
			FROM "pilot",
				"pilot-can_fly-plane" AS "pilot.pilot-can_fly-plane"
			WHERE "pilot"."id" = ?
			AND "pilot"."id" = "pilot.pilot-can_fly-plane"."pilot"
		''')


test.skip '/pilot(1)/favourite_colour/red', (result) ->
	it "should select the red component of the pilot's favourite colour"


test.skip '/method(1)/child?foo=bar', (result) ->
	it 'should do something..'


test "/team('purple')", 'GET', [['Bind', 0]], (result) ->
	it 'should select the team with the "favourite colour" id of "purple"', ->
		expect(result.query).to.equal """
			SELECT #{teamFields}
			FROM "team"
			WHERE "team"."favourite colour" = ?
		"""

test '/team', 'POST', [['Bind', ['team', 'favourite_colour']]], { favourite_colour: 'purple' }, (result) ->
	it 'should insert a team', ->
		expect(result.query).to.equal('''
			INSERT INTO "team" ("favourite colour")
			VALUES (?)
		''')

test '/pilot/$count/$count', (result) ->
	it 'should fail because it is invalid', ->
		expect(result).to.be.instanceOf(SyntaxError)

test '/pilot/$count', (result) ->
	it 'should select count(*) from pilot', ->
		expect(result.query).to.equal '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot(5)/$count', (result) ->
	it 'should fail because it is invalid', ->
		expect(result).to.be.instanceOf(SyntaxError)

test '/pilot?$filter=id eq 5/$count', (result) ->
	it 'should fail because it is invalid', ->
		expect(result).to.be.instanceOf(SyntaxError)

test '/pilot/$count?$filter=id gt 5', 'GET', [['Bind', 0]], (result) ->
	it 'should select count(*) from pilot where pilot/id > 5 ', ->
		expect(result.query).to.equal '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
			WHERE "pilot"."id" > ?
		'''

test '/pilot/$count?$filter=id eq 5 or id eq 10', 'GET', [['Bind', 0], ['Bind', 1]], (result) ->
	it 'should select count(*) from pilot where id in (5,10)', ->
		expect(result.query).to.equal '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
			WHERE "pilot"."id" IN (?, ?)
		'''

test '/pilot(5)/licence/$count', 'GET', [['Bind', 0]], (result) ->
	it 'should select count(*) the licence from pilot where pilot/id', ->
		expect(result.query).to.equal '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot",
				"licence" AS "pilot.licence"
			WHERE "pilot"."id" = ?
			AND "pilot.licence"."id" = "pilot"."licence"
		'''

test '/pilot/$count?$orderby=id asc', (result) ->
	it 'should select count(*) from pilot and ignore orderby', ->
		expect(result.query).to.equal '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot/$count?$skip=5', (result) ->
	it 'should select count(*) from pilot and ignore skip', ->
		expect(result.query).to.equal '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot/$count?$top=5', (result) ->
	it 'should select count(*) from pilot and ignore top', ->
		expect(result.query).to.equal '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot/$count?$top=5&$skip=5', (result) ->
	it 'should select count(*) from pilot and ignore top and skip', ->
		expect(result.query).to.equal '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''

test '/pilot/$count?$select=id', (result) ->
	it 'should select count(*) from pilot and ignore select', ->
		expect(result.query).to.equal '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
		'''
