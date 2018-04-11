expect = require('chai').expect
test = require('./test')
{ pilotFields, aliasFields, aliasLicenceFields, aliasPlaneFields, aliasPilotCanFlyPlaneFields } = require('./fields')
_ = require 'lodash'

postgresAgg = (field) -> 'coalesce(array_to_json(array_agg(' + field + ")), '[]')"
mysqlAgg = websqlAgg = (field) -> "'[' || group_concat(" + field + ", ',') || ']'"

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc, fields) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{fields}
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=licence'
	urlCount = '/pilot?$expand=licence/$count'
	test.postgres(url, testFunc(postgresAgg, aliasLicenceFields.join(', ')))
	test.postgres(urlCount, testFunc(postgresAgg, 'COUNT(*) AS "$count"'))
	test.mysql.skip(url, testFunc(mysqlAgg, aliasLicenceFields.join(', ')))
	test.mysql.skip(urlCount, testFunc(mysqlAgg, 'COUNT(*) AS "$count"'))
	test.websql.skip(url, testFunc(websqlAgg, aliasLicenceFields.join(', ')))
	test.websql.skip(urlCount, testFunc(websqlAgg, 'COUNT(*) AS "$count"'))


do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc, fields) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{fields}
						FROM "v1"."licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence", #{remainingPilotFields}
				FROM "v1"."pilot"
			"""
	url = '/pilot?$expand=licence'
	urlCount = '/pilot?$expand=licence/$count'
	test.namespace('v1') url, testFunc(postgresAgg, aliasLicenceFields.join(', '))
	test.namespace('v1') urlCount, testFunc(postgresAgg, 'COUNT(*) AS "$count"')


do ->
	remainingAliasPilotCanFlyFields = _.reject(aliasPilotCanFlyPlaneFields, (field) -> field is '"pilot.pilot-can fly-plane"."can fly-plane"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can fly-plane, aggregated plane)', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.pilot-can fly-plane".*')} AS "can_fly__plane"
					FROM (
						SELECT (
							SELECT #{aggFunc('"pilot.pilot-can fly-plane.plane".*')} AS "plane"
							FROM (
								SELECT #{aliasPlaneFields.join(', ')}
								FROM "plane" AS "pilot.pilot-can fly-plane.plane"
								WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
							) AS "pilot.pilot-can fly-plane.plane"
						) AS "plane", #{remainingAliasPilotCanFlyFields}
						FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
						WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
					) AS "pilot.pilot-can fly-plane"
				) AS "can_fly__plane", #{pilotFields.join(', ')}
				FROM "pilot"
				"""
	for url in ['/pilot?$expand=can_fly__plane/plane', '/pilot?$expand=can_fly__plane($expand=plane)']
		test.postgres(url, testFunc(postgresAgg))
		test.mysql.skip(url, testFunc(mysqlAgg))
		test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingAliasPilotCanFlyFields = _.reject(aliasPilotCanFlyPlaneFields, (field) -> field is '"pilot.pilot-can fly-plane"."can fly-plane"').join(', ')
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can fly-plane, aggregated plane), aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.pilot-can fly-plane".*')} AS "can_fly__plane"
					FROM (
						SELECT (
							SELECT #{aggFunc('"pilot.pilot-can fly-plane.plane".*')} AS "plane"
							FROM (
								SELECT #{aliasPlaneFields.join(', ')}
								FROM "plane" AS "pilot.pilot-can fly-plane.plane"
								WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
							) AS "pilot.pilot-can fly-plane.plane"
						) AS "plane", #{remainingAliasPilotCanFlyFields}
						FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
						WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
					) AS "pilot.pilot-can fly-plane"
				) AS "can_fly__plane", (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{aliasLicenceFields.join(', ')}
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	for url in ['/pilot?$expand=can_fly__plane/plane,licence', '/pilot?$expand=can_fly__plane($expand=plane),licence']
		test.postgres(url, testFunc(postgresAgg))
		test.mysql.skip(url, testFunc(mysqlAgg))
		test.websql.skip(url, testFunc(websqlAgg))

do ->
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can fly-plane, aggregated plane), aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{aliasLicenceFields.join(', ')}
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence"
				FROM "pilot"
			"""
	url = '/pilot?$select=licence&$expand=licence'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingAliasPilotCanFlyFields = _.reject(aliasPilotCanFlyPlaneFields, (field) -> field is '"pilot.pilot-can fly-plane"."can fly-plane"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can fly-plane, aggregated plane)', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.pilot-can fly-plane".*')} AS "can_fly__plane"
					FROM (
						SELECT (
							SELECT #{aggFunc('"pilot.pilot-can fly-plane.plane".*')} AS "plane"
							FROM (
								SELECT #{aliasPlaneFields.join(', ')}
								FROM "plane" AS "pilot.pilot-can fly-plane.plane"
								WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
							) AS "pilot.pilot-can fly-plane.plane"
						) AS "plane", #{remainingAliasPilotCanFlyFields}
						FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
						WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
					) AS "pilot.pilot-can fly-plane"
				) AS "can_fly__plane", "pilot"."id"
				FROM "pilot"
				"""
	for url in ['/pilot?$select=id&$expand=can_fly__plane/plane', '/pilot?$select=id&$expand=can_fly__plane($expand=plane)']
		test.postgres(url, testFunc(postgresAgg))
		test.mysql.skip(url, testFunc(mysqlAgg))
		test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingAliasPilotCanFlyFields = _.reject(aliasPilotCanFlyPlaneFields, (field) -> field is '"pilot.pilot-can fly-plane"."can fly-plane"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can fly-plane, aggregated plane), aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.pilot-can fly-plane".*')} AS "can_fly__plane"
					FROM (
						SELECT (
							SELECT #{aggFunc('"pilot.pilot-can fly-plane.plane".*')} AS "plane"
							FROM (
								SELECT #{aliasPlaneFields.join(', ')}
								FROM "plane" AS "pilot.pilot-can fly-plane.plane"
								WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
							) AS "pilot.pilot-can fly-plane.plane"
						) AS "plane", #{remainingAliasPilotCanFlyFields}
						FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
						WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
					) AS "pilot.pilot-can fly-plane"
				) AS "can_fly__plane", (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{aliasLicenceFields.join(', ')}
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence", "pilot"."id"
				FROM "pilot"
			"""
	for url in ['/pilot?$select=id,licence&$expand=can_fly__plane/plane,licence', '/pilot?$select=id,licence&$expand=can_fly__plane($expand=plane),licence']
		test.postgres(url, testFunc(postgresAgg))
		test.mysql.skip(url, testFunc(mysqlAgg))
		test.websql.skip(url, testFunc(websqlAgg))

do ->
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can fly-plane, aggregated plane)', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.pilot-can fly-plane".*')} AS "can_fly__plane"
					FROM (
						SELECT "pilot.pilot-can fly-plane"."id"
						FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
						WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
					) AS "pilot.pilot-can fly-plane"
				) AS "can_fly__plane", #{pilotFields.join(', ')}
				FROM "pilot"
			"""
	url = '/pilot?$expand=can_fly__plane($select=id)'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc, fields) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{fields}
						FROM "licence" AS "pilot.licence"
						WHERE "pilot.licence"."id" = ?
						AND "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=licence($filter=id eq 1)'
	urlCount = '/pilot?$expand=licence/$count($filter=id eq 1)'
	test.postgres(url, 'GET', [['Bind', 0]], testFunc(postgresAgg, aliasLicenceFields.join(', ')))
	test.postgres(urlCount, 'GET', [['Bind', 0]], testFunc(postgresAgg, 'COUNT(*) AS "$count"'))
	test.mysql.skip(url, 'GET', [['Bind', 0]], testFunc(mysqlAgg, aliasLicenceFields.join(', ')))
	test.mysql.skip(urlCount, 'GET', [['Bind', 0]], testFunc(mysqlAgg, 'COUNT(*) AS "$count"'))
	test.websql.skip(url, 'GET', [['Bind', 0]], testFunc(websqlAgg, aliasLicenceFields.join(', ')))
	test.websql.skip(urlCount, 'GET', [['Bind', 0]], testFunc(websqlAgg, 'COUNT(*) AS "$count'))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{aliasLicenceFields.join(', ')}
						FROM "licence" AS "pilot.licence",
							"pilot" AS "pilot.licence.is of-pilot"
						WHERE "pilot.licence"."id" = "pilot.licence.is of-pilot"."licence"
						AND "pilot.licence.is of-pilot"."id" = ?
						AND "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=licence($filter=is_of__pilot/id eq 1)'
	test.postgres(url, 'GET', [['Bind', 0]], testFunc(postgresAgg))
	test.mysql.skip(url, 'GET', [['Bind', 0]], testFunc(mysqlAgg))
	test.websql.skip(url, 'GET', [['Bind', 0]], testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{aliasLicenceFields.join(', ')}
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
						ORDER BY "pilot.licence"."id" DESC
					) AS "pilot.licence"
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
		it 'should select from pilot.*, aggregated count(*) licence and ignore orderby', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT COUNT(*) AS "$count"
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	urlCount = '/pilot?$expand=licence/$count($orderby=id)'
	test.postgres(urlCount, testFunc(postgresAgg))
	test.mysql.skip(urlCount, testFunc(mysqlAgg))
	test.websql.skip(urlCount, testFunc(websqlAgg))


do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{aliasLicenceFields.join(', ')}
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
						LIMIT 10
					) AS "pilot.licence"
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
		it 'should select from pilot.*, aggregated count(*) licence and ignore top', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT COUNT(*) AS "$count"
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	urlCount = '/pilot?$expand=licence/$count($top=10)'
	test.postgres(urlCount, testFunc(postgresAgg))
	test.mysql.skip(urlCount, testFunc(mysqlAgg))
	test.websql.skip(urlCount, testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated licence', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT #{aliasLicenceFields.join(', ')}
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
						OFFSET 10
					) AS "pilot.licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=licence($skip=10)'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."licence"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated count(*) licence and ignore skip', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.licence".*')} AS "licence"
					FROM (
						SELECT COUNT(*) AS "$count"
						FROM "licence" AS "pilot.licence"
						WHERE "pilot"."licence" = "pilot.licence"."id"
					) AS "pilot.licence"
				) AS "licence", #{remainingPilotFields}
				FROM "pilot"
			"""
	urlCount = '/pilot?$expand=licence/$count($skip=10)'
	test.postgres(urlCount, testFunc(postgresAgg))
	test.mysql.skip(urlCount, testFunc(mysqlAgg))
	test.websql.skip(urlCount, testFunc(websqlAgg))

do ->
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated(pilot-can fly-plane, aggregated plane)', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.pilot-can fly-plane".*')} AS "can_fly__plane"
					FROM (
						SELECT "pilot.pilot-can fly-plane"."can fly-plane" AS "plane"
						FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
						WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
					) AS "pilot.pilot-can fly-plane"
				) AS "can_fly__plane", #{pilotFields.join(', ')}
				FROM "pilot"
			"""
	url = '/pilot?$expand=can_fly__plane($select=plane)'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))

do ->
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated count(*) pilot-can fly-plane and ignore select', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.pilot-can fly-plane".*')} AS "can_fly__plane"
					FROM (
						SELECT COUNT(*) AS "$count"
						FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
						WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
					) AS "pilot.pilot-can fly-plane"
				) AS "can_fly__plane", #{pilotFields.join(', ')}
				FROM "pilot"
			"""
	urlCount = '/pilot?$expand=can_fly__plane/$count($select=plane)'
	test.postgres(urlCount, testFunc(postgresAgg))
	test.mysql.skip(urlCount, testFunc(mysqlAgg))
	test.websql.skip(urlCount, testFunc(websqlAgg))

do ->
	aliasedFields = aliasFields('pilot.trained-pilot', pilotFields)
	remainingPilotFields = _.reject(pilotFields, (field) -> field is '"pilot"."trained-pilot"').join(', ')
	testFunc = (aggFunc) -> (result) ->
		it 'should select from pilot.*, aggregated pilot', ->
			expect(result.query).to.equal """
				SELECT (
					SELECT #{aggFunc('"pilot.trained-pilot".*')} AS "trained__pilot"
					FROM (
						SELECT #{aliasedFields.join(', ')}
						FROM "pilot" AS "pilot.trained-pilot"
						WHERE "pilot"."id" = "pilot.trained-pilot"."was trained by-pilot"
					) AS "pilot.trained-pilot"
				) AS "trained__pilot", #{remainingPilotFields}
				FROM "pilot"
			"""
	url = '/pilot?$expand=trained__pilot'
	test.postgres(url, testFunc(postgresAgg))
	test.mysql.skip(url, testFunc(mysqlAgg))
	test.websql.skip(url, testFunc(websqlAgg))
