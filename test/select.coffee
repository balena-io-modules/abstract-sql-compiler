expect = require('chai').expect
test = require('./test')
{pilotFields} = require('./fields')

test '/pilot?$select=name', (result) ->
	it 'should select name from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."name"
			FROM "pilot"
		''')


test '/pilot?$select=pilot/name', (result) ->
	it 'should select name from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."name"
			FROM "pilot"
		''')


test '/pilot?$select=pilot/name,age', (result) ->
	it 'should select name, age from pilot', ->
		expect(result.query).to.equal('''
			SELECT "pilot"."name", "pilot"."age"
			FROM "pilot"
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
			SELECT "licence"."id"
			FROM "pilot",
				"licence"
			WHERE "licence"."id" = "pilot"."licence"
		''')


test '/pilot?$select=pilot__can_fly__plane/plane/id', (result) ->
	it 'should select pilot__can_fly__plane/plane/id for pilots', ->
		expect(result.query).to.equal('''
			SELECT "plane"."id"
			FROM "pilot",
				"pilot-can_fly-plane",
				"plane"
			WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
			AND "plane"."id" = "pilot-can_fly-plane"."plane"
		''')
