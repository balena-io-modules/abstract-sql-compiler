expect = require('chai').expect
test = require('./test')
{pilotFields, pilotCanFlyPlaneFields} = require('./fields')

postgresAgg = (field) -> 'array_to_json(array_agg(' + field + '))'
mysqlAgg = (field) -> "'[' || string_agg(" + field + ", ',') || ']'"
do ->
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal '''
				SELECT ''' + aggFunc('"licence".*') + ' AS "licence", ' +  _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ') + '\n' + '''
				FROM "pilot",
					"licence"
				WHERE "licence"."id" = "pilot"."licence"
				GROUP BY "pilot"."id"'''
	test.postgres '/pilot?$expand=licence', testFunc(postgresAgg)
	test.mysql '/pilot?$expand=licence', testFunc(mysqlAgg)


do ->
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can_fly-plane, aggregated plane)', ->
			expect(result.query).to.equal '''
				SELECT ''' + aggFunc('"pilot-can_fly-plane".*') + ' AS "pilot-can_fly-plane", ' + pilotFields.join(', ') + '\n' + '''
				FROM "pilot",
					(	SELECT ''' + aggFunc('"plane".*') + ' AS "plane", ' + _.reject(pilotCanFlyPlaneFields, (field) -> field is '"pilot-can_fly-plane"."plane"').join(', ') + '\n' + '''
						FROM "pilot-can_fly-plane",
							"plane"
						WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
						GROUP BY "pilot-can_fly-plane"."id"
					) AS "pilot-can_fly-plane"
				WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				GROUP BY "pilot"."id"'''
	test.postgres '/pilot?$expand=pilot__can_fly__plane/plane', testFunc(postgresAgg)
	test.mysql '/pilot?$expand=pilot__can_fly__plane/plane', testFunc(mysqlAgg)


do ->
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can_fly-plane, aggregated plane), aggregated licence', ->
			expect(result.query).to.equal '''
				SELECT ''' + aggFunc('"pilot-can_fly-plane".*') + ' AS "pilot-can_fly-plane", ' + aggFunc('"licence".*') + ' AS "licence", ' + _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ') + '\n' + '''
				FROM "pilot",
					(	SELECT ''' + aggFunc('"plane".*') + ' AS "plane", ' + _.reject(pilotCanFlyPlaneFields, (field) -> field is '"pilot-can_fly-plane"."plane"').join(', ') + '\n' + '''
						FROM "pilot-can_fly-plane",
							"plane"
						WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
						GROUP BY "pilot-can_fly-plane"."id"
					) AS "pilot-can_fly-plane",
					"licence"
				WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				AND "licence"."id" = "pilot"."licence"
				GROUP BY "pilot"."id"'''
	test.postgres '/pilot?$expand=pilot__can_fly__plane/plane,licence', testFunc(postgresAgg)
	test.mysql '/pilot?$expand=pilot__can_fly__plane/plane,licence', testFunc(mysqlAgg)
