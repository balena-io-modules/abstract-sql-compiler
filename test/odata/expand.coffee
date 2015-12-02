expect = require('chai').expect
test = require('./test')
{ pilotFields, pilotCanFlyPlaneFields, planeFields, licenceFields } = require('./fields')

postgresAgg = (field) -> 'array_to_json(array_agg(' + field + '))'
mysqlAgg = websqlAgg = (field) -> "'[' || group_concat(" + field + ", ',') || ']'"

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"licence".*')} AS "licence"
					FROM (
						SELECT #{licenceFields.join(', ')}
						FROM "licence"
					) AS "licence"
					WHERE "licence"."id" = "pilot"."licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
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
							) AS "plane"
							WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
						) AS "plane", #{remainingPilotCanFlyFields}
						FROM "pilot-can_fly-plane"
					) AS "pilot-can_fly-plane"
					WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				) AS "pilot__can_fly__plane", #{pilotFields.join(', ')}
				FROM "pilot"
				"""
	for url in ['/pilot?$expand=pilot__can_fly__plane/plane', '/pilot?$expand=pilot__can_fly__plane($expand=plane)']
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
							) AS "plane"
							WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
						) AS "plane", #{remainingPilotCanFlyFields}
						FROM "pilot-can_fly-plane"
					) AS "pilot-can_fly-plane"
					WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				) AS "pilot__can_fly__plane", (
					SELECT #{aggFunc('"licence".*')} AS "licence"
					FROM (
						SELECT #{licenceFields.join(', ')}
						FROM "licence"
					) AS "licence"
					WHERE "licence"."id" = "pilot"."licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	for url in ['/pilot?$expand=pilot__can_fly__plane/plane,licence', '/pilot?$expand=pilot__can_fly__plane($expand=plane),licence']
		test.postgres(url, testFunc(postgresAgg))
		test.mysql.skip(url, testFunc(mysqlAgg))
		test.websql.skip(url, testFunc(websqlAgg))

do ->
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can_fly-plane, aggregated plane), aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"licence".*')} AS "licence"
					FROM (
						SELECT #{licenceFields.join(', ')}
						FROM "licence"
					) AS "licence"
					WHERE "licence"."id" = "pilot"."licence"
				) AS "licence"
				FROM "pilot"
			"""
	url = '/pilot?$select=licence&$expand=licence'
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
							) AS "plane"
							WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
						) AS "plane", #{remainingPilotCanFlyFields}
						FROM "pilot-can_fly-plane"
					) AS "pilot-can_fly-plane"
					WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				) AS "pilot__can_fly__plane", "pilot"."id"
				FROM "pilot"
				"""
	for url in ['/pilot?$select=id&$expand=pilot__can_fly__plane/plane', '/pilot?$select=id&$expand=pilot__can_fly__plane($expand=plane)']
		test.postgres(url, testFunc(postgresAgg))
		test.mysql.skip(url, testFunc(mysqlAgg))
		test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotCanFlyFields = _.reject(pilotCanFlyPlaneFields, (field) -> field is '"pilot-can_fly-plane"."plane"').join(', ')
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
							) AS "plane"
							WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
						) AS "plane", #{remainingPilotCanFlyFields}
						FROM "pilot-can_fly-plane"
					) AS "pilot-can_fly-plane"
					WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				) AS "pilot__can_fly__plane", (
					SELECT #{aggFunc('"licence".*')} AS "licence"
					FROM (
						SELECT #{licenceFields.join(', ')}
						FROM "licence"
					) AS "licence"
					WHERE "licence"."id" = "pilot"."licence"
				) AS "licence", "pilot"."id"
				FROM "pilot"
			"""
	for url in ['/pilot?$select=id,licence&$expand=pilot__can_fly__plane/plane,licence', '/pilot?$select=id,licence&$expand=pilot__can_fly__plane($expand=plane),licence']
		test.postgres(url, testFunc(postgresAgg))
		test.mysql.skip(url, testFunc(mysqlAgg))
		test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"licence".*')} AS "licence"
					FROM (
						SELECT #{licenceFields.join(', ')}
						FROM "licence"
						WHERE "licence"."id" = 1
					) AS "licence"
					WHERE "licence"."id" = "pilot"."licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=licence($filter=id eq 1)'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"licence".*')} AS "licence"
					FROM (
						SELECT #{licenceFields.join(', ')}
						FROM "licence",
							"pilot"
						WHERE "licence"."id" = "pilot"."licence"
						AND "pilot"."id" = 1
					) AS "licence"
					WHERE "licence"."id" = "pilot"."licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=licence($filter=pilot/id eq 1)'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"licence".*')} AS "licence"
					FROM (
						SELECT #{licenceFields.join(', ')}
						FROM "licence"
						ORDER BY "licence"."id" DESC
					) AS "licence"
					WHERE "licence"."id" = "pilot"."licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=licence($orderby=id)'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"licence".*')} AS "licence"
					FROM (
						SELECT #{licenceFields.join(', ')}
						FROM "licence"
						LIMIT 10
					) AS "licence"
					WHERE "licence"."id" = "pilot"."licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=licence($top=10)'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"licence".*')} AS "licence"
					FROM (
						SELECT #{licenceFields.join(', ')}
						FROM "licence"
						OFFSET 10
					) AS "licence"
					WHERE "licence"."id" = "pilot"."licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=licence($skip=10)'
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
						SELECT "pilot-can_fly-plane"."plane"
						FROM "pilot-can_fly-plane"
					) AS "pilot-can_fly-plane"
					WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				) AS "pilot__can_fly__plane", #{pilotFields.join(', ')}
				FROM "pilot"
			"""
	url = '/pilot?$expand=pilot__can_fly__plane($select=plane)'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))
