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

test '/pilot(1)?$select=favourite_colour', 'GET', [['Bind', 0]], (result) ->
	it 'should select from pilot with id', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."favourite colour" AS "favourite_colour"
			FROM "pilot"
			WHERE "pilot"."id" = ?
		''')

test "/pilot('TextKey')?$select=favourite_colour", 'GET', [['Bind', 0]], (result) ->
	it 'should select favourite colour from pilot "TextKey"', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."favourite colour" AS "favourite_colour"
			FROM "pilot"
			WHERE "pilot"."id" = ?
		''')


test '/pilot?$select=trained__pilot/name', (result) ->
	it 'should select name from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot.trained-pilot"."name"
			FROM "pilot",
				"pilot" AS "pilot.trained-pilot"
			WHERE "pilot"."id" = "pilot.trained-pilot"."was trained by-pilot"
		''')


test '/pilot?$select=trained__pilot/name,age', (result) ->
	it 'should select name, age from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot.trained-pilot"."name", "pilot"."age"
			FROM "pilot",
				"pilot" AS "pilot.trained-pilot"
			WHERE "pilot"."id" = "pilot.trained-pilot"."was trained by-pilot"
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
			WHERE "pilot"."licence" = "pilot.licence"."id"
		''')


test '/pilot?$select=can_fly__plane/plane/id', (result) ->
	it 'should select can_fly__plane/plane/id for pilots', ->
		expect(result.query).to.equal('''
			SELECT "pilot.pilot-can fly-plane.plane"."id"
			FROM "pilot",
				"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
				"plane" AS "pilot.pilot-can fly-plane.plane"
			WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
			AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
		''')
