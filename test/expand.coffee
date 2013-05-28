expect = require('chai').expect
test = require('./test')
{pilotFields, pilotCanFlyPlaneFields} = require('./fields')

test '/pilot?$expand=licence', (result) ->
	it 'should select from pilot.*, licence.*', ->
		expect(result.query).to.equal '''
			SELECT array_to_json(array_agg("licence".*)) AS "licence", ''' +  _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ') + '\n' + '''
			FROM "pilot",
				"licence"
			WHERE "licence"."id" = "pilot"."licence"
			GROUP BY "pilot"."id"'''


test '/pilot?$expand=pilot__can_fly__plane/plane', (result) ->
	it 'should select from pilot.*, plane.*', ->
		expect(result.query).to.equal '''
			SELECT array_to_json(array_agg("pilot-can_fly-plane".*)) AS "pilot-can_fly-plane", ''' + pilotFields.join(', ') + '\n' + '''
			FROM "pilot",
				(	SELECT array_to_json(array_agg("plane".*)) AS "plane", ''' + _.reject(pilotCanFlyPlaneFields, (field) -> field is '"pilot-can_fly-plane"."plane"').join(', ') + '\n' + '''
					FROM "pilot-can_fly-plane",
						"plane"
					WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
					GROUP BY "pilot-can_fly-plane"."id"
				) AS "pilot-can_fly-plane"
			WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
			GROUP BY "pilot"."id"'''


test '/pilot?$expand=pilot__can_fly__plane/plane,licence', (result) ->
	it 'should select from pilot.*, plane.*', ->
		expect(result.query).to.equal '''
			SELECT array_to_json(array_agg("pilot-can_fly-plane".*)) AS "pilot-can_fly-plane", array_to_json(array_agg("licence".*)) AS "licence", ''' + _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ') + '\n' + '''
			FROM "pilot",
				(	SELECT array_to_json(array_agg("plane".*)) AS "plane", ''' + _.reject(pilotCanFlyPlaneFields, (field) -> field is '"pilot-can_fly-plane"."plane"').join(', ') + '\n' + '''
					FROM "pilot-can_fly-plane",
						"plane"
					WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
					GROUP BY "pilot-can_fly-plane"."id"
				) AS "pilot-can_fly-plane",
				"licence"
			WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
			AND "licence"."id" = "pilot"."licence"
			GROUP BY "pilot"."id"'''
