expect = require('chai').expect
test = require('./test')

test '/pilot', (result) ->
	it 'should select from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "pilot"
		''')

test '/pilot(1)', (result) ->
	it 'should select from pilot with id', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "pilot"
			WHERE "pilot"."id" = 1
		''')

test '/pilot(1)/licence', (result) ->
	it 'should select from the licence of pilot with id', ->
		expect(result.query).to.equal('''
			SELECT "licence".*
			FROM "pilot",
				"licence"
			WHERE "licence"."id" = "pilot"."licence"
			AND "pilot"."id" = 1
		''')


test '/licence(1)/pilot', (result) ->
	it 'should select from the pilots of licence with id', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "licence",
				"pilot"
			WHERE "licence"."id" = "pilot"."licence"
			AND "licence"."id" = 1
		''')


test '/pilot(1)/pilot__can_fly__plane/plane', (result) ->
	it 'should select from the plane of pilot with id', ->
		expect(result.query).to.equal('''
			SELECT "plane".*
			FROM "pilot",
				"pilot-can_fly-plane",
				"plane"
			WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
			AND "pilot"."id" = "pilot-can_fly-plane"."pilot"
			AND "pilot"."id" = 1
		''')


test '/plane(1)/pilot__can_fly__plane/pilot', (result) ->
	it 'should select from the pilots of plane with id', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "plane",
				"pilot-can_fly-plane",
				"pilot"
			WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
			AND "plane"."id" = "pilot-can_fly-plane"."plane"
			AND "plane"."id" = 1
		''')

do ->
	bindings = [
		['pilot', 'id']
		['pilot', 'is experienced']
		['pilot', 'name']
		['pilot', 'age']
		['pilot', 'favourite colour']
		['pilot', 'licence']
	]
	test '/pilot(1)', 'PUT', bindings, (result) ->
		it 'should insert/update the pilot with id 1', ->
			expect(result[0].query).to.equal('''
				INSERT INTO "pilot" ("id", "is experienced", "name", "age", "favourite colour", "licence")
				VALUES (?, ?, ?, ?, ?, ?)
			''')
			expect(result[1].query).to.equal('''
				UPDATE "pilot"
				SET "id" = ?,
					"is experienced" = ?,
					"name" = ?,
					"age" = ?,
					"favourite colour" = ?,
					"licence" = ?
				WHERE "pilot"."id" = 1
			''')
	test '/pilot(1)', 'POST', bindings, (result) ->
		it 'should insert/update the pilot with id 1', ->
			expect(result.query).to.equal('''
				INSERT INTO "pilot" ("id", "is experienced", "name", "age", "favourite colour", "licence")
				VALUES (?, ?, ?, ?, ?, ?)
			''')


test '/pilot(1)/$links/licence', (result) ->
	it 'should select the list of licence ids, for generating the links', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."licence"
			FROM "pilot"
			WHERE "pilot"."id" = 1
		''')


test '/pilot(1)/pilot__can_fly__plane/$links/plane', (result) ->
	it 'should select the list of plane ids, for generating the links', ->
		expect(result.query).to.equal('''
			SELECT "pilot-can_fly-plane"."plane"
			FROM "pilot",
				"pilot-can_fly-plane"
			WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
			AND "pilot"."id" = 1
		''')


test.skip '/pilot(1)/favourite_colour/red', (result) ->
	it "should select the red component of the pilot's favourite colour"


test.skip '/method(1)/child?foo=bar', (result) ->
	it 'should do something..'
