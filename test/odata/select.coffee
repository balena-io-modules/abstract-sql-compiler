expect = require('chai').expect
test = require('./test')
{ pilotFields } = require('./fields')
pilotFields = pilotFields.join(', ')

test '/pilot?$select=name', (result) ->
	it 'should select name from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."name"
			FROM "pilot"
		''')

test '/pilot?$select=favourite_colour', (result) ->
	it 'should select favourite_colour from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."favourite colour" AS "favourite_colour"
			FROM "pilot"
		''')

test '/pilot(1)?$select=favourite_colour', (result) ->
	it 'should select from pilot with id', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."favourite colour" AS "favourite_colour"
			FROM "pilot"
			WHERE "pilot"."id" = 1
		''')

test "/pilot('TextKey')?$select=favourite_colour", 'GET', [['Text', 'TextKey']], (result) ->
	it 'should select favourite colour from pilot "TextKey"', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."favourite colour" AS "favourite_colour"
			FROM "pilot"
			WHERE "pilot"."id" = ?
		''')


test '/pilot?$select=pilot/name', (result) ->
	it 'should select name from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot.pilot"."name"
			FROM "pilot",
				"pilot" AS "pilot.pilot"
			WHERE "pilot"."id" = "pilot.pilot"."pilot"
		''')


test '/pilot?$select=pilot/name,age', (result) ->
	it 'should select name, age from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot.pilot"."name", "pilot"."age"
			FROM "pilot",
				"pilot" AS "pilot.pilot"
			WHERE "pilot"."id" = "pilot.pilot"."pilot"
		''')


test '/pilot?$select=*', (result) ->
	it 'should select * from pilot', ->
		expect(result.query).to.equal('''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
		''')


test '/pilot?$select=licence/id', (result) ->
	it 'should select licence/id for pilots', ->
		expect(result.query).to.equal('''
			SELECT "pilot.licence"."id"
			FROM "pilot",
				"licence" AS "pilot.licence"
			WHERE "pilot.licence"."id" = "pilot"."licence"
		''')


test '/pilot?$select=pilot__can_fly__plane/plane/id', (result) ->
	it 'should select pilot__can_fly__plane/plane/id for pilots', ->
		expect(result.query).to.equal('''
			SELECT "pilot.pilot-can_fly-plane.plane"."id"
			FROM "pilot",
				"pilot-can_fly-plane" AS "pilot.pilot-can_fly-plane",
				"plane" AS "pilot.pilot-can_fly-plane.plane"
			WHERE "pilot"."id" = "pilot.pilot-can_fly-plane"."pilot"
			AND "pilot.pilot-can_fly-plane.plane"."id" = "pilot.pilot-can_fly-plane"."plane"
		''')
