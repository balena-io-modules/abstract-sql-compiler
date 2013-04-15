expect = require('chai').expect
test = require('./test')

itShouldNotHaveAnyBindings = (result) ->
	it 'should not have any bindings', ->
		expect(result.bindings).to.be.empty

test '/pilot?$orderby=name', (result) ->
	it 'should order by name desc', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "pilot"
			ORDER BY "pilot"."name" DESC
		''')
	itShouldNotHaveAnyBindings(result)


test '/pilot?$orderby=name,age', (result) ->
	it 'should order by name desc, age desc', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "pilot"
			ORDER BY "pilot"."name" DESC,
				"pilot"."age" DESC
		''')
	itShouldNotHaveAnyBindings(result)


test '/pilot?$orderby=name desc', (result) ->
	it 'should order by name desc', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "pilot"
			ORDER BY "pilot"."name" DESC
		''')
	itShouldNotHaveAnyBindings(result)

			
test '/pilot?$orderby=name asc', (result) ->
	it 'should order by name asc', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "pilot"
			ORDER BY "pilot"."name" ASC
		''')
	itShouldNotHaveAnyBindings(result)


test '/pilot?$orderby=name asc,age desc', (result) ->
	it 'should order by name desc, age desc', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "pilot"
			ORDER BY "pilot"."name" ASC,
				"pilot"."age" DESC
		''')
	itShouldNotHaveAnyBindings(result)


test '/pilot?$orderby=licence/id asc', (result) ->
	it 'should order by licence/id asc', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "pilot",
				"licence"
			WHERE "licence"."id" = "pilot"."licence"
			ORDER BY "licence"."id" ASC
		''')
	itShouldNotHaveAnyBindings(result)


test '/pilot?$orderby=pilot__can_fly__plane/plane/id asc', (result) ->
	it 'should order by pilot__can_fly__plane/plane/id asc', ->
		expect(result.query).to.equal('''
			SELECT "pilot".*
			FROM "pilot",
				"pilot-can_fly-plane",
				"plane"
			WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
			AND "plane"."id" = "pilot-can_fly-plane"."plane"
			ORDER BY "plane"."id" ASC
		''')
	itShouldNotHaveAnyBindings(result)


test.skip '/pilot?$orderby=favourite_colour/red', (result) ->
	it "should order by how red the pilot's favourite colour is"