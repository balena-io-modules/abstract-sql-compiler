expect = require('chai').expect
test = require('./test')
clientModel = test.clientModel
_ = require('lodash')
{ odataNameToSqlName } = require('@resin/odata-to-abstract-sql')
{ pilotFields, pilotCanFlyPlaneFields, teamFields, aliasPilotCanFlyPlaneFields } = require('./fields')
pilotFields = pilotFields.join(', ')
pilotCanFlyPlaneFields = pilotCanFlyPlaneFields.join(', ')
aliasPilotCanFlyPlaneFields = aliasPilotCanFlyPlaneFields.join(', ')
teamFields = teamFields.join(', ')

parseOperandFactory = (defaultResource = 'pilot') ->
	bindNo = 0
	operandToOData = (operand) ->
		if operand.odata?
			return operand.odata
		if _.isDate(operand)
			return "datetime'" + encodeURIComponent(operand.toISOString()) + "'"
		if _.isObject(operand)
			duration = []
			t = false
			if operand.negative
				duration.push('-')
			duration.push('P')
			if operand.day?
				duration.push(operand.day, 'D')
			if operand.hour?
				t = true
				duration.push('T', operand.hour, 'H')
			if operand.minute?
				if not t
					t = true
					duration.push('T')
				duration.push(operand.minute, 'M')
			if operand.second?
				if not t
					t = true
					duration.push('T')
				duration.push(operand.second, 'S')
			if duration.length < 3
				throw new Error('Duration must contain at least 1 component')
			return "duration'#{duration.join('')}'"
		return operand

	operandToBindings = (operand) ->
		if operand.bindings?
			return operand.bindings
		if _.isBoolean(operand) or
				_.isNumber(operand) or
				_.isDate(operand) or
				(_.isString(operand) and operand.charAt(0) is "'")
			return [['Bind', bindNo++]]
		return []

	operandToSQL = (operand, resource = defaultResource) ->
		if operand.sql?
			return operand.sql
		if _.isBoolean(operand) or
				_.isNumber(operand) or
				_.isDate(operand)
			return '?'
		if _.isString(operand)
			if operand is 'null'
				return 'NULL'
			if operand.charAt(0) is "'"
				return '?'
			fieldParts = operand.split('/')
			if fieldParts.length > 1
				alias = resource
				previousResource = resource
				for resourceName in fieldParts[...-1]
					sqlName = odataNameToSqlName(resourceName)
					sqlNameParts = sqlName.split('-')
					mapping = _.get(clientModel.relationships[previousResource], sqlNameParts.join('.')).$
					refTable = mapping[1][0]
					if sqlNameParts.length > 1 and not _.includes(refTable, '-')
						alias = "#{alias}.#{sqlNameParts[0]}-#{refTable}"
					else
						alias = "#{alias}.#{refTable}"
					previousResource = refTable
				mapping = [alias, _.last(fieldParts)]
			else
				mapping = [resource, odataNameToSqlName(operand)]
			return '"' + mapping.join('"."') + '"'
		if _.isObject(operand)
			sign = if operand.negative then '-' else ''
			day = operand.day or 0
			hour = operand.hour or 0
			minute = operand.minute or 0
			second = operand.second or 0
			return "INTERVAL '#{sign}#{day} #{sign}#{hour}:#{minute}:#{second}'"
		throw new Error('Unknown operand type: ' + operand)

	return (operand) ->
		return {
			sql: operandToSQL(operand)
			bindings: operandToBindings(operand)
			odata: operandToOData(operand)
		}

parseOperand = null
run = do ->
	running = false
	(fn) ->
		if not running
			running = true
			parseOperand = parseOperandFactory()
			fn()
			running = false
		else
			fn()


sqlOps =
	eq: ' ='
	ne: ' !='
	gt: ' >'
	ge: ' >='
	lt: ' <'
	le: ' <='
	and: '\nAND'
	or: '\nOR'
	add: ' +'
	sub: ' -'
	mul: ' *'
	div: ' /'
sqlOpBrackets =
	or: true

methodMaps =
	TOUPPER: 'UPPER'
	TOLOWER: 'LOWER'

createExpression = (lhs, op, rhs) ->
	if lhs is 'not'
		op = parseOperand(op)
		return {
			odata: 'not(' + op.odata + ')'
			sql: 'NOT (\n\t' + op.sql + '\n)'
			bindings: op.bindings
		}
	if !rhs?
		lhs = parseOperand(lhs)
		return {
			odata: '(' + lhs.odata + ')'
			sql: lhs.sql
			bindings: lhs.bindings
		}
	lhs = parseOperand(lhs)
	rhs = parseOperand(rhs)
	bindings = lhs.bindings.concat(rhs.bindings)
	if op in ['eq', 'ne'] and 'NULL' in [lhs.sql, rhs.sql]
		nullCheck = if op is 'eq' then ' IS NULL' else ' IS NOT NULL'
		if lhs.sql is 'NULL'
			sql = rhs.sql + nullCheck
		else
			sql = lhs.sql + nullCheck
	else
		sql = lhs.sql + sqlOps[op] + ' ' + rhs.sql

	if sqlOpBrackets[op]
		sql = '(' + sql + ')'
	return {
		odata: lhs.odata + ' ' + op + ' ' + rhs.odata
		sql
		bindings
	}
createMethodCall = (method, args...) ->
	args =
		for arg in args
			parseOperand(arg)
	odata = method + '(' + (arg.odata for arg in args).join(',') + ')'
	method = method.toUpperCase()
	switch method
		when 'CONTAINS', 'SUBSTRINGOF'
			if method is 'SUBSTRINGOF'
				args.reverse()
			return {
				sql: "STRPOS(#{args[0].sql}, #{args[1].sql}) > 0"
				bindings: [args[0].bindings..., args[1].bindings...]
				odata
			}
		when 'STARTSWITH'
			return {
				sql: "#{args[0].sql} LIKE (REPLACE(REPLACE(REPLACE(#{args[1].sql}, '\\', '\\\\'), '_', '\\_'), '%', '\\%') || '%')"
				bindings: [args[0].bindings..., args[1].bindings...]
				odata
			}
		when 'ENDSWITH'
			return {
				sql: "#{args[0].sql} LIKE ('%' || REPLACE(REPLACE(REPLACE(#{args[1].sql}, '\\', '\\\\'), '_', '\\_'), '%', '\\%'))"
				bindings: [args[0].bindings..., args[1].bindings...]
				odata
			}
		when 'CONCAT'
			return {
				sql: '(' + (arg.sql for arg in args).join(' || ') + ')'
				bindings: [].concat((arg.bindings for arg in args)...)
				odata
			}
		when 'INDEXOF'
			return {
				sql: 'STRPOS(' + (arg.sql for arg in args).join(', ') + ') - 1'
				bindings: [].concat((arg.bindings for arg in args)...)
				odata
			}
		when 'NOW'
			return {
				sql: 'CURRENT_TIMESTAMP'
				bindings: []
				odata
			}
		when 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE'
			return {
				sql: "EXTRACT('#{method}' FROM #{args[0].sql})"
				bindings: args[0].bindings
				odata
			}
		when 'SECOND'
			return {
				sql: "FLOOR(EXTRACT('#{method}' FROM #{args[0].sql}))"
				bindings: args[0].bindings
				odata
			}
		when 'FRACTIONALSECONDS'
			return {
				sql: "EXTRACT('SECOND' FROM #{args[0].sql}) - FLOOR(EXTRACT('SECOND' FROM #{args[0].sql}))"
				bindings: args[0].bindings
				odata
			}
		when 'TIME'
			return {
				sql: "CAST(#{args[0].sql} AS #{method})"
				bindings: args[0].bindings
				odata
			}
		when 'TOTALSECONDS'
			return {
				sql: "EXTRACT(EPOCH FROM #{args[0].sql})"
				bindings: args[0].bindings
				odata
			}
		else
			if methodMaps.hasOwnProperty(method)
				method = methodMaps[method]
			switch method
				when 'SUBSTRING'
					args[1].sql += ' + 1'
			sql = method + '(' + (arg.sql for arg in args).join(', ') + ')'
			return {
				sql: sql
				bindings: [].concat((arg.bindings for arg in args)...)
				odata
			}

operandTest = (lhs, op, rhs) ->
	run ->
		{ odata, sql, bindings } = createExpression(lhs, op, rhs)
		if _.isString(lhs)
			lFieldParts = lhs.split('/')
		else
			lFieldParts = []
		if _.isString(rhs)
			rFieldParts = rhs.split('/')
		else
			rFieldParts = []
		if lFieldParts.length > 1 or rFieldParts.length > 1
			from = '''
				"pilot",
					"pilot" AS "pilot.trained-pilot"'''
			where = '''
				"pilot"."id" = "pilot.trained-pilot"."was trained by-pilot"
				AND ''' + sql
		else
			from = '"pilot"'
			where = sql
		test "/pilot?$filter=#{odata}", 'GET', bindings, (result, sqlEquals) ->
			it 'should select from pilot where "' + odata + '"', ->
				sqlEquals result.query, '''
					SELECT ''' + pilotFields + '\n' + '''
					FROM ''' + from + '\n' + '''
					WHERE ''' + where
		test "/pilot/$count?$filter=#{odata}", 'GET', bindings, (result, sqlEquals) ->
			it 'should select count(*) from pilot where "' + odata + '"', ->
				sqlEquals result.query, '''
					SELECT COUNT(*) AS "$count"
					FROM ''' + from + '\n' + '''
					WHERE ''' + where

methodTest = (args...) ->
	run ->
		{ odata, sql, bindings } = createMethodCall(args...)
		test "/pilot?$filter=#{odata}", 'GET', bindings, (result, sqlEquals) ->
			it 'should select from pilot where "' + odata + '"', ->
				sqlEquals result.query, '''
					SELECT ''' + pilotFields + '\n' + '''
					FROM "pilot"
					WHERE ''' + sql
		test "/pilot/$count?$filter=#{odata}", 'GET', bindings, (result, sqlEquals) ->
			it 'should select count(*) from pilot where "' + odata + '"', ->
				sqlEquals result.query, '''
					SELECT COUNT(*) AS "$count"
					FROM "pilot"
					WHERE ''' + sql

# Test each combination of operands and operations
do ->
	operations = [
		'eq'
		'ne'
		'gt'
		'ge'
		'lt'
		'le'
	]
	operands = [
			2
			-2
			2.5
			-2.5
			"'bar'"
			'name'
			'trained__pilot/name'
			new Date()
			{ negative: true, day: 3, hour: 4, minute: 5, second: 6.7 }
			true
			false
			# null is quoted as otherwise we hit issues with coffeescript defaulting values
			'null'
		]
	for op in operations
		describe op, ->
			for lhs in operands
				for rhs in operands
					run ->
						operandTest(lhs, op, rhs)

do ->
	left = createExpression('age', 'gt', 2)
	right = createExpression('age', 'lt', 10)
	operandTest(left, 'and', right)
	operandTest(left, 'or', right)
	operandTest('is_experienced')
	operandTest('not', 'is_experienced')
	operandTest('not', left)

do ->
	mathOps = [
		'add'
		'sub'
		'mul'
		'div'
	]
	for mathOp in mathOps
		run ->
			mathOp = createExpression('age', mathOp, 2)
			operandTest(mathOp, 'gt', 10)

run ->
	{ odata, bindings, sql } = createExpression('can_fly__plane/id', 'eq', 10)
	test "/pilot?$filter=#{odata}", 'GET', bindings, (result, sqlEquals) ->
		it 'should select from pilot where "' + odata + '"', ->
			sqlEquals result.query, """
				SELECT #{pilotFields}
				FROM "pilot",
					"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
				WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
				AND #{sql}
			"""

run ->
	{ odata: keyOdata, bindings: keyBindings } = parseOperand(1)
	{ odata, bindings } = createExpression('can_fly__plane/id', 'eq', 10)
	test '/pilot(' + keyOdata + ')/can_fly__plane?$filter=' + odata, 'GET', keyBindings.concat(bindings), (result, sqlEquals) ->
		it 'should select from pilot__can_fly__plane where "' + odata + '"', ->
			sqlEquals result.query, """
				SELECT #{aliasPilotCanFlyPlaneFields}
				FROM "pilot",
					"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
					"plane" AS "pilot.pilot-can fly-plane.can fly-plane"
				WHERE "pilot"."id" = ?
				AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.can fly-plane"."id"
				AND "pilot.pilot-can fly-plane.can fly-plane"."id" = ?
				AND "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
			"""

run ->
	{ odata, bindings, sql } = createExpression('can_fly__plane/plane/id', 'eq', 10)
	name = 'Peter'
	bodyBindings =  [
		['Bind', ['pilot', 'name']]
	].concat(bindings)
	filterWhere = [
		'WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"'
		'AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"'
		"AND #{sql}"
	]
	insertTest = (result, sqlEquals) ->
		sqlEquals result.query, """
			INSERT INTO "pilot" ("name")
			SELECT "pilot"."name"
			FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
				"plane" AS "pilot.pilot-can fly-plane.plane",
				(
				SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(NULL AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS INTEGER) AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMP) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
			) AS "pilot"
			#{filterWhere.join('\n')}
		"""
	updateWhere = """
		WHERE "pilot"."id" IN ((
			SELECT "pilot"."id"
			FROM "pilot",
				"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
				"plane" AS "pilot.pilot-can fly-plane.plane"
			#{filterWhere.join('\n\t')}
		))
	"""

	test "/pilot?$filter=#{odata}", 'GET', bindings, (result, sqlEquals) ->
		it "should select from pilot where '#{odata}'", ->
			sqlEquals result.query, """
				SELECT #{pilotFields}
				FROM "pilot",
					"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
					"plane" AS "pilot.pilot-can fly-plane.plane"
				#{filterWhere.join('\n')}
			"""

	test "/pilot?$filter=#{odata}", 'PATCH', bodyBindings, { name }, (result, sqlEquals) ->
		it "should update pilot where '#{odata}'", ->
			sqlEquals result.query, """
				UPDATE "pilot"
				SET "name" = ?
				#{updateWhere}
			"""

	test "/pilot?$filter=#{odata}", 'POST', bodyBindings, { name }, (result, sqlEquals) ->
		it "should insert pilot where '#{odata}'", ->
			insertTest(result, sqlEquals)

	test "/pilot?$filter=#{odata}", 'PUT', bodyBindings, { name }, (result, sqlEquals) ->
		describe 'should upsert the pilot with id 1', ->
			it 'should be an upsert', ->
				expect(result).to.be.an('array')
			it 'that inserts', ->
				insertTest(result[0], sqlEquals)
			it 'and updates', ->
				sqlEquals result[1].query, """
					UPDATE "pilot"
					SET "created at" = DEFAULT,
						"id" = DEFAULT,
						"person" = DEFAULT,
						"is experienced" = DEFAULT,
						"name" = ?,
						"age" = DEFAULT,
						"favourite colour" = DEFAULT,
						"is on-team" = DEFAULT,
						"licence" = DEFAULT,
						"hire date" = DEFAULT,
						"was trained by-pilot" = DEFAULT
					#{updateWhere}
				"""

	test "/pilot?$filter=#{odata}", 'DELETE', bindings, (result, sqlEquals) ->
		it 'should delete from pilot where "' + odata + '"', ->
			sqlEquals result.query, """
				DELETE FROM "pilot"
				WHERE "pilot"."id" IN ((
					SELECT "pilot"."id"
					FROM "pilot",
						"pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
						"plane" AS "pilot.pilot-can fly-plane.plane"
					#{filterWhere.join('\n\t')}
				))
			"""

run ->
	name = 'Peter'
	{ odata, sql, bindings: exprBindings } = createExpression('name', 'eq', "'#{name}'")
	bindings = [
		['Bind', ['pilot', 'name']]
		exprBindings...
	]
	test "/pilot?$filter=#{odata}", 'POST', bindings, { name }, (result, sqlEquals) ->
		it "should insert into pilot where '#{odata}'", ->
			sqlEquals result.query, """
				INSERT INTO "pilot" ("name")
				SELECT "pilot"."name"
				FROM (
					SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(NULL AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS INTEGER) AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMP) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
				) AS "pilot"
				WHERE #{sql}
			"""

run ->
	name = 'Peter'
	{ odata: keyOdata, bindings: keyBindings } = parseOperand(1)
	{ odata, sql, bindings: exprBindings } = createExpression('name', 'eq', "'#{name}'")
	bodyBindings = [
		['Bind', ['pilot', 'id']]
		['Bind', ['pilot', 'name']]
	]
	insertBindings = [
		bodyBindings...
		exprBindings...
	]
	updateBindings = [
		bodyBindings...
		keyBindings...
		exprBindings...
	]
	test '/pilot(' + keyOdata + ')?$filter=' + odata, 'PATCH', updateBindings, { name }, (result, sqlEquals) ->
		it 'should update the pilot with id 1', ->
			sqlEquals result.query, """
				UPDATE "pilot"
				SET "id" = ?,
					"name" = ?
				WHERE "pilot"."id" = ?
				AND "pilot"."id" IN ((
					SELECT "pilot"."id"
					FROM "pilot"
					WHERE #{sql}
				))
			"""

	test '/pilot(' + keyOdata + ')?$filter=' + odata, 'PUT', [ insertBindings, updateBindings ], { name }, (result, sqlEquals) ->
		describe 'should upsert the pilot with id 1', ->
			it 'should be an upsert', ->
				expect(result).to.be.an('array')
			it 'that inserts', ->
				sqlEquals result[0].query, """
					INSERT INTO "pilot" ("id", "name")
					SELECT "pilot"."id", "pilot"."name"
					FROM (
						SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(? AS INTEGER) AS "id", CAST(NULL AS INTEGER) AS "person", CAST(NULL AS INTEGER) AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", CAST(NULL AS INTEGER) AS "age", CAST(NULL AS INTEGER) AS "favourite colour", CAST(NULL AS INTEGER) AS "is on-team", CAST(NULL AS INTEGER) AS "licence", CAST(NULL AS TIMESTAMP) AS "hire date", CAST(NULL AS INTEGER) AS "was trained by-pilot"
					) AS "pilot"
					WHERE #{sql}
				"""
			it 'and updates', ->
				sqlEquals result[1].query, """
					UPDATE "pilot"
					SET "created at" = DEFAULT,
						"id" = ?,
						"person" = DEFAULT,
						"is experienced" = DEFAULT,
						"name" = ?,
						"age" = DEFAULT,
						"favourite colour" = DEFAULT,
						"is on-team" = DEFAULT,
						"licence" = DEFAULT,
						"hire date" = DEFAULT,
						"was trained by-pilot" = DEFAULT
					WHERE "pilot"."id" = ?
					AND "pilot"."id" IN ((
						SELECT "pilot"."id"
						FROM "pilot"
						WHERE #{sql}
					))
				"""

run ->
	{ odata: keyOdata, bindings: keyBindings } = parseOperand(1)
	{ odata, bindings, sql } = createExpression(
		createExpression(1, 'eq', 1)
		'or'
		createExpression(1, 'eq', 1)
	)
	test '/pilot(' + keyOdata + ')/can_fly__plane?$filter=' + odata, 'GET', keyBindings.concat(bindings), (result, sqlEquals) ->
		it 'should select from pilot__can_fly__plane where "' + odata + '"', ->
			sqlEquals result.query, """
				SELECT #{aliasPilotCanFlyPlaneFields}
				FROM "pilot",
					"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
				WHERE "pilot"."id" = ?
				AND #{sql}
				AND "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
			"""

methodTest('contains', 'name', "'et'")
methodTest('endswith', 'name', "'ete'")
methodTest('startswith', 'name', "'P'")
run -> operandTest(createMethodCall('length', 'name'), 'eq', 4)
run -> operandTest(createMethodCall('indexof', 'name', "'Pe'"), 'eq', 0)
run -> operandTest(createMethodCall('substring', 'name', 1), 'eq', "'ete'")
run -> operandTest(createMethodCall('substring', 'name', 1, 2), 'eq', "'et'")
run -> operandTest(createMethodCall('tolower', 'name'), 'eq', "'pete'")
run -> operandTest(createMethodCall('tolower', 'licence/name'), 'eq', "'pete'")
run -> operandTest(createMethodCall('toupper', 'name'), 'eq', "'PETE'")
run ->
	concat = createMethodCall('concat', 'name', "'%20'")
	operandTest(createMethodCall('trim', concat), 'eq', "'Pete'")
run ->
	concat = createMethodCall('concat', 'name', "'%20'")
	operandTest(concat, 'eq', "'Pete%20'")
run -> operandTest(createMethodCall('year', 'hire_date'), 'eq', 2011)
run -> operandTest(createMethodCall('month', 'hire_date'), 'eq', 10)
run -> operandTest(createMethodCall('day', 'hire_date'), 'eq', 3)
run -> operandTest(createMethodCall('hour', 'hire_date'), 'eq', 12)
run -> operandTest(createMethodCall('minute', 'hire_date'), 'eq', 10)
run -> operandTest(createMethodCall('second', 'hire_date'), 'eq', 25)
run -> operandTest(createMethodCall('fractionalseconds', 'hire_date'), 'eq', .222)
run -> operandTest(createMethodCall('date', 'hire_date'), 'eq', "'2011-10-03'")
run -> operandTest(createMethodCall('time', 'hire_date'), 'eq', "'12:10:25.222'")
run -> operandTest(createMethodCall('now'), 'eq', new Date('2012-12-03T07:16:23Z'))
run -> operandTest(createMethodCall('totalseconds', { negative: true, day: 3, hour: 4, minute: 5, second: 6.7 }), 'eq', -273906.7)
run -> operandTest(createMethodCall('round', 'age'), 'eq', 25)
run -> operandTest(createMethodCall('floor', 'age'), 'eq', 25)
run -> operandTest(createMethodCall('ceiling', 'age'), 'eq', 25)

methodTest('substringof', "'Pete'", 'name')
run -> operandTest(createMethodCall('replace', 'name', "'ete'", "'at'"), 'eq', "'Pat'")

test "/pilot?$filter=can_fly__plane/any(d:d/plane/name eq 'Concorde')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from pilot where ...', ->
		sqlEquals result.query, """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE EXISTS (
				SELECT 1
				FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
					"plane" AS "pilot.pilot-can fly-plane.plane"
				WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
				AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
				AND "pilot.pilot-can fly-plane.plane"."name" = ?
			)
		"""

test "/pilot/$count?$filter=can_fly__plane/any(d:d/plane/name eq 'Concorde')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select count(*) from pilot where ...', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
			WHERE EXISTS (
				SELECT 1
				FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
					"plane" AS "pilot.pilot-can fly-plane.plane"
				WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
				AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
				AND "pilot.pilot-can fly-plane.plane"."name" = ?
			)
		'''

test "/pilot?$filter=can_fly__plane/any(d:d/plane/name eq 'Concorde') or (id eq 5 or id eq 10) or (name eq 'Peter' or name eq 'Harry')", 'GET', [['Bind', 1], ['Bind', 2], ['Bind', 3], ['Bind', 4], ['Bind', 0]], (result, sqlEquals) ->
	it 'should select count(*) from pilot where id in (5,10)', ->
		sqlEquals result.query, """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE ("pilot"."id" IN (?, ?)
			OR "pilot"."name" IN (?, ?)
			OR EXISTS (
				SELECT 1
				FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
					"plane" AS "pilot.pilot-can fly-plane.plane"
				WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
				AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
				AND "pilot.pilot-can fly-plane.plane"."name" = ?
			))
		"""

test "/pilot?$filter=not(can_fly__plane/any(d:d/plane/name eq 'Concorde') or (id eq 5 or id eq 10) or (name eq 'Peter' or name eq 'Harry'))", 'GET', [['Bind', 1], ['Bind', 2], ['Bind', 3], ['Bind', 4], ['Bind', 0]], (result, sqlEquals) ->
	it 'should select count(*) from pilot where id in (5,10)', ->
		sqlEquals result.query, """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE NOT (
				("pilot"."id" IN (?, ?)
				OR "pilot"."name" IN (?, ?)
				OR EXISTS (
					SELECT 1
					FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
						"plane" AS "pilot.pilot-can fly-plane.plane"
					WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
					AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
					AND "pilot.pilot-can fly-plane.plane"."name" = ?
				))
			)
		"""

test "/pilot?$filter=can_fly__plane/all(d:d/plane/name eq 'Concorde')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from pilot where ...', ->
		sqlEquals result.query, """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE NOT EXISTS (
				SELECT 1
				FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
					"plane" AS "pilot.pilot-can fly-plane.plane"
				WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
				AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
				AND "pilot.pilot-can fly-plane.plane"."name" != ?
			)
		"""

test "/pilot/$count?$filter=can_fly__plane/all(d:d/plane/name eq 'Concorde')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select count(*) from pilot where ...', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot"
			WHERE NOT EXISTS (
				SELECT 1
				FROM "pilot-can fly-plane" AS "pilot.pilot-can fly-plane",
					"plane" AS "pilot.pilot-can fly-plane.plane"
				WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
				AND "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
				AND "pilot.pilot-can fly-plane.plane"."name" != ?
			)
	'''

test "/pilot?$filter=can_fly__plane/plane/any(d:d/name eq 'Concorde')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from pilot where ...', ->
		sqlEquals result.query, """
			SELECT #{pilotFields}
			FROM "pilot",
				"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
			WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
			AND EXISTS (
				SELECT 1
				FROM "plane" AS "pilot.pilot-can fly-plane.plane"
				WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
				AND "pilot.pilot-can fly-plane.plane"."name" = ?
			)
		"""

test "/pilot/$count?$filter=can_fly__plane/plane/any(d:d/name eq 'Concorde')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select count(*) from pilot where ...', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot",
				"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
			WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
			AND EXISTS (
				SELECT 1
				FROM "plane" AS "pilot.pilot-can fly-plane.plane"
				WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
				AND "pilot.pilot-can fly-plane.plane"."name" = ?
			)
		'''

test "/pilot?$filter=can_fly__plane/plane/all(d:d/name eq 'Concorde')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select from pilot where ...', ->
		sqlEquals result.query, """
			SELECT #{pilotFields}
			FROM "pilot",
				"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
			WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
			AND NOT EXISTS (
				SELECT 1
				FROM "plane" AS "pilot.pilot-can fly-plane.plane"
				WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
				AND "pilot.pilot-can fly-plane.plane"."name" != ?
			)
		"""

test "/pilot/$count?$filter=can_fly__plane/plane/all(d:d/name eq 'Concorde')", 'GET', [['Bind', 0]], (result, sqlEquals) ->
	it 'should select count(*) from pilot where ...', ->
		sqlEquals result.query, '''
			SELECT COUNT(*) AS "$count"
			FROM "pilot",
				"pilot-can fly-plane" AS "pilot.pilot-can fly-plane"
			WHERE "pilot"."id" = "pilot.pilot-can fly-plane"."pilot"
			AND NOT EXISTS (
				SELECT 1
				FROM "plane" AS "pilot.pilot-can fly-plane.plane"
				WHERE "pilot.pilot-can fly-plane"."can fly-plane" = "pilot.pilot-can fly-plane.plane"."id"
				AND "pilot.pilot-can fly-plane.plane"."name" != ?
			)
		'''

# Switch parseOperandFactory permanently to using 'team' as the resource,
# as we are switch to using that as our base resource from here on.
parseOperandFactory = _.partialRight(parseOperandFactory, 'team')
run ->
	favouriteColour = 'purple'
	{ odata, sql, bindings } = createExpression('favourite_colour', 'eq', "'#{favouriteColour}'")
	test '/team?$filter=' + odata, 'POST', [['Bind', ['team', 'favourite_colour']]].concat(bindings), { favourite_colour: favouriteColour }, (result, sqlEquals) ->
		it 'should insert into team where "' + odata + '"', ->
			sqlEquals result.query, '''
				INSERT INTO "team" ("favourite colour")
				SELECT "team"."favourite colour"
				FROM (
					SELECT CAST(NULL AS TIMESTAMP) AS "created at", CAST(? AS INTEGER) AS "favourite colour"
				) AS "team"
				WHERE ''' + sql

run ->
	{ odata, sql, bindings } = createExpression('includes__pilot/can_fly__plane/plane/name', 'eq', "'Concorde'")
	test '/team?$filter=' + odata, 'GET', bindings, (result, sqlEquals) ->
		it 'should select from team where "' + odata + '"', ->
			sqlEquals result.query, """
				SELECT #{teamFields}
				FROM "team",
					"pilot" AS "team.includes-pilot",
					"pilot-can fly-plane" AS "team.includes-pilot.pilot-can fly-plane",
					"plane" AS "team.includes-pilot.pilot-can fly-plane.plane"
				WHERE "team"."favourite colour" = "team.includes-pilot"."is on-team"
				AND "team.includes-pilot"."id" = "team.includes-pilot.pilot-can fly-plane"."pilot"
				AND "team.includes-pilot.pilot-can fly-plane"."can fly-plane" = "team.includes-pilot.pilot-can fly-plane.plane"."id"
				AND #{sql}
			"""
