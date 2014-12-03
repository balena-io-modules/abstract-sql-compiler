expect = require('chai').expect
test = require('./test')
{pilotFields} = require('./fields')
pilotFields = pilotFields.join(', ')

test '/pilot', (result) ->
	it 'should select from pilot', ->
		expect(result.query).to.equal('''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
		''')

test '/pilot(1)', (result) ->
	it 'should select from pilot with id', ->
		expect(result.query).to.equal('''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			WHERE "pilot"."id" = 1
		''')

test "/pilot('TextKey')", (result) ->
	it 'should select from pilot with id', ->
		expect(result.query).to.equal('''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			WHERE "pilot"."id" = 'TextKey'
		''')

test '/pilot(1)/licence', (result) ->
	it 'should select from the licence of pilot with id', ->
		expect(result.query).to.equal('''
			SELECT "licence"."id"
			FROM "pilot",
				"licence"
			WHERE "pilot"."id" = 1
			AND "licence"."id" = "pilot"."licence"
		''')


test '/licence(1)/pilot', (result) ->
	it 'should select from the pilots of licence with id', ->
		expect(result.query).to.equal('''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "licence",
				"pilot"
			WHERE "licence"."id" = 1
			AND "licence"."id" = "pilot"."licence"
		''')


test '/pilot(1)/pilot__can_fly__plane/plane', (result) ->
	it 'should select from the plane of pilot with id', ->
		expect(result.query).to.equal('''
			SELECT "plane"."id", "plane"."name"
			FROM "pilot",
				"pilot-can_fly-plane",
				"plane"
			WHERE "pilot"."id" = 1
			AND "plane"."id" = "pilot-can_fly-plane"."plane"
			AND "pilot"."id" = "pilot-can_fly-plane"."pilot"
		''')


test '/plane(1)/pilot__can_fly__plane/pilot', (result) ->
	it 'should select from the pilots of plane with id', ->
		expect(result.query).to.equal('''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "plane",
				"pilot-can_fly-plane",
				"pilot"
			WHERE "plane"."id" = 1
			AND "pilot"."id" = "pilot-can_fly-plane"."pilot"
			AND "plane"."id" = "pilot-can_fly-plane"."plane"
		''')


test '/pilot(1)', 'DELETE', (result) ->
	it 'should delete the pilot with id 1', ->
		expect(result.query).to.equal('''
			DELETE FROM "pilot"
			WHERE "pilot"."id" = 1
		''')

do ->
	bindings = [
		['pilot', 'id']
	]
	test '/pilot(1)', 'PUT', bindings, (result) ->
		it 'should insert/update the pilot with id 1', ->
			expect(result[0].query).to.equal('''
				INSERT INTO "pilot" ("id")
				VALUES (?)
			''')
			expect(result[1].query).to.equal('''
				UPDATE "pilot"
				SET "id" = ?,
					"is experienced" = DEFAULT,
					"name" = DEFAULT,
					"age" = DEFAULT,
					"favourite colour" = DEFAULT,
					"licence" = DEFAULT
				WHERE "pilot"."id" = 1
			''')
	bindings = [
		['pilot', 'name']
	]
	test '/pilot', 'POST', bindings, {name: 'Peter'}, (result) ->
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
		['pilot', 'id']
		['pilot', 'is_experienced']
	]
	testFunc = (result) ->
		it 'should insert/update the pilot with id 1', ->
			expect(result.query).to.equal('''
				UPDATE "pilot"
				SET "id" = ?,
					"is experienced" = ?
				WHERE "pilot"."id" = 1
			''')
	test '/pilot(1)', 'PATCH', bindings, {is_experienced:true}, testFunc
	test '/pilot(1)', 'MERGE', bindings, {is_experienced:true}, testFunc


test '/pilot__can_fly__plane(1)', 'DELETE', (result) ->
	it 'should delete the pilot with id 1', ->
		expect(result.query).to.equal('''
			DELETE FROM "pilot-can_fly-plane"
			WHERE "pilot-can_fly-plane"."id" = 1
		''')

do ->
	bindings = [
		['pilot__can_fly__plane', 'id']
	]
	test '/pilot__can_fly__plane(1)', 'PUT', bindings, (result) ->
		it 'should insert/update the pilot-can_fly-plane with id 1', ->
			expect(result[0].query).to.equal('''
				INSERT INTO "pilot-can_fly-plane" ("id")
				VALUES (?)
			''')
			expect(result[1].query).to.equal('''
				UPDATE "pilot-can_fly-plane"
				SET "pilot" = DEFAULT,
					"plane" = DEFAULT,
					"id" = ?
				WHERE "pilot-can_fly-plane"."id" = 1
			''')
	bindings = [
		['pilot__can_fly__plane', 'pilot']
		['pilot__can_fly__plane', 'plane']
	]
	test '/pilot__can_fly__plane', 'POST', bindings, {pilot:2, plane:3}, (result) ->
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
		['pilot__can_fly__plane', 'pilot']
		['pilot__can_fly__plane', 'id']
	]
	testFunc = (result) ->
		it 'should insert/update the pilot with id 1', ->
			expect(result.query).to.equal('''
				UPDATE "pilot-can_fly-plane"
				SET "pilot" = ?,
					"id" = ?
				WHERE "pilot-can_fly-plane"."id" = 1
			''')
	test '/pilot__can_fly__plane(1)', 'PATCH', bindings, {pilot:1}, testFunc
	test '/pilot__can_fly__plane(1)', 'MERGE', bindings, {pilot:1}, testFunc


test '/pilot(1)/$links/licence', (result) ->
	it 'should select the list of licence ids, for generating the links', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."licence" AS "licence"
			FROM "pilot"
			WHERE "pilot"."id" = 1
		''')


test '/pilot(1)/pilot__can_fly__plane/$links/plane', (result) ->
	it 'should select the list of plane ids, for generating the links', ->
		expect(result.query).to.equal('''
			SELECT "pilot-can_fly-plane"."plane" AS "plane"
			FROM "pilot",
				"pilot-can_fly-plane"
			WHERE "pilot"."id" = 1
			AND "pilot"."id" = "pilot-can_fly-plane"."pilot"
		''')


test.skip '/pilot(1)/favourite_colour/red', (result) ->
	it "should select the red component of the pilot's favourite colour"


test.skip '/method(1)/child?foo=bar', (result) ->
	it 'should do something..'


test "/team('purple')", (result) ->
	it 'should select the team with the "favourite colour" id of "purple"', ->
		expect(result.query).to.equal('''
			SELECT "team"."favourite colour" AS "favourite_colour"
			FROM "team"
			WHERE "team"."favourite colour" = 'purple'
		''')

test '/team', 'POST', [['team', 'favourite_colour']], {favourite_colour: 'purple'}, (result) ->
	it 'should insert a team', ->
		expect(result.query).to.equal('''
			INSERT INTO "team" ("favourite colour")
			VALUES (?)
		''')
