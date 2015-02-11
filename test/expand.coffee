expect = require('chai').expect
test = require('./test')
{pilotFields, pilotCanFlyPlaneFields, planeFields} = require('./fields')

postgresAgg = (field) -> 'array_to_json(array_agg(' + field + '))'
mysqlAgg = websqlAgg = (field) -> "'[' || group_concat(" + field + ", ',') || ']'"

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal '''
				SELECT (
					SELECT ''' + aggFunc('"licence".*') + ''' AS "licence"
					FROM (
						SELECT "licence"."id"
						FROM "licence"
						WHERE "licence"."id" = "pilot"."licence"
					) AS "licence"
				) AS "licence", ''' +  remainingPilotFields + '\n' + '''
				FROM "pilot"'''
	url = '/pilot?$expand=licence'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))


do ->
	remainingPilotCanFlyFields = _.reject(pilotCanFlyPlaneFields, (field) -> field is '"pilot-can_fly-plane"."plane"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can_fly-plane, aggregated plane)', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot-can_fly-plane".*')} AS "pilot__can_fly__plane"
					FROM (
						SELECT (
							SELECT #{aggFunc('"plane".*')} AS "plane"
							FROM (
								SELECT #{planeFields.join(', ')}
								FROM "plane"
								WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
							) AS "plane"
						) AS "plane", #{remainingPilotCanFlyFields}
						FROM "pilot-can_fly-plane"
						WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
					) AS "pilot-can_fly-plane"
				) AS "pilot__can_fly__plane", #{pilotFields.join(', ')}
				FROM "pilot"
				"""
	url = '/pilot?$expand=pilot__can_fly__plane/plane'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotCanFlyFields = _.reject(pilotCanFlyPlaneFields, (field) -> field is '"pilot-can_fly-plane"."plane"').join(', ')
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can_fly-plane, aggregated plane), aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot-can_fly-plane".*')} AS "pilot__can_fly__plane"
					FROM (
						SELECT (
							SELECT #{aggFunc('"plane".*')} AS "plane"
							FROM (
								SELECT #{planeFields.join(', ')}
								FROM "plane"
								WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
							) AS "plane"
						) AS "plane", #{remainingPilotCanFlyFields}
						FROM "pilot-can_fly-plane"
						WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
					) AS "pilot-can_fly-plane"
				) AS "pilot__can_fly__plane", (
					SELECT """ + aggFunc('"licence".*') + """ AS "licence"
					FROM (
						SELECT "licence"."id"
						FROM "licence"
						WHERE "licence"."id" = "pilot"."licence"
					) AS "licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
				"""
	url = '/pilot?$expand=pilot__can_fly__plane/plane,licence'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal '''
				SELECT (
					SELECT ''' + aggFunc('"licence".*') + ''' AS "licence"
					FROM (
						SELECT "licence"."id"
						FROM "licence"
						WHERE "licence"."id" = "pilot"."licence"
						AND "licence"."id" = 1
					) AS "licence"
				) AS "licence", ''' +  remainingPilotFields + '\n' + '''
				FROM "pilot"'''
	url = '/pilot?$expand=licence($filter=id eq 1)'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))
