expect = require('chai').expect
test = require('./test')
clientModel = require('../client-model.json')
_ = require('lodash')
{pilotFields, pilotCanFlyPlaneFields, teamFields} = require('./fields')
pilotFields = pilotFields.join(', ')
pilotCanFlyPlaneFields = pilotCanFlyPlaneFields.join(', ')
teamFields = teamFields.join(', ')

operandToOData = (operand) ->
	if operand.odata?
		return operand.odata
	if _.isDate(operand)
		return "datetime'" + encodeURIComponent(operand.toISOString()) + "'"
	return operand

operandToBindings = (operand) ->
	if operand.bindings?
		return operand.bindings
	if _.isDate(operand)
		return [['Date', operand]]
	if _.isString(operand) and operand.charAt(0) is "'"
		return [['Text', decodeURIComponent(operand[1...-1])]]
	return []

operandToSQL = (operand, resource = 'pilot') ->
	if operand.sql?
		return operand.sql
	if _.isBoolean(operand)
		return Number(operand)
	if _.isNumber(operand)
		return operand
	if _.isDate(operand)
		return '?'
	if _.isString(operand)
		if operand is 'null'
			return 'NULL'
		if operand.charAt(0) is "'"
			return '?'
		fieldParts = operand.split('/')
		if fieldParts.length > 1
			mapping = clientModel.resourceToSQLMappings[fieldParts[fieldParts.length - 2]][fieldParts[fieldParts.length - 1]]
		else
			mapping = clientModel.resourceToSQLMappings[resource][operand]
		return '"' + mapping.join('"."') + '"'
	throw 'Unknown operand type: ' + operand

parseOperand = (operand) ->
	return {
		sql: operandToSQL(operand)
		bindings: operandToBindings(operand)
		odata: operandToOData(operand)
	}

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
				sql: "STRPOS(#{args[0].sql}, #{args[1].sql}) = 1"
				bindings: [args[0].bindings..., args[1].bindings...]
				odata
			}
		when 'ENDSWITH'
			return {
				sql: "RIGHT(#{args[0].sql}, LENGTH(#{args[1].sql})) = #{args[1].sql}"
				bindings: [args[0].bindings..., args[1].bindings..., args[1].bindings...]
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
		else
			if methodMaps.hasOwnProperty(method)
				method = methodMaps[method]
			switch method
				when 'SUBSTRING'
					args[1].sql++
			sql = method + '(' + (arg.sql for arg in args).join(', ') + ')'
			return {
				sql: sql
				bindings: [].concat((arg.bindings for arg in args)...)
				odata
			}

operandTest = (lhs, op, rhs) ->
	{odata, sql, bindings} = createExpression(lhs, op, rhs)
	test "/pilot?$filter=#{odata}", 'GET', bindings, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotFields + '\n' + '''
				FROM "pilot"
				WHERE ''' + sql

methodTest = (args...) ->
	{odata, sql, bindings} = createMethodCall(args...)
	test "/pilot?$filter=#{odata}", 'GET', bindings, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotFields + '\n' + '''
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
			2.5
			"'bar'"
			"name"
			"pilot/name"
			new Date()
			true
			false
			# null is quoted as otherwise we hit issues with coffeescript defaulting values
			'null'
		]
	for op in operations
		describe op, ->
			for lhs in operands
				for rhs in operands
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
		mathOp = createExpression('age', mathOp, 2)
		operandTest(mathOp, 'gt', 10)

do ->
	{odata, sql} = createExpression('pilot__can_fly__plane/id', 'eq', 10)
	test "/pilot?$filter=#{odata}", (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal """
				SELECT #{pilotFields}
				FROM "pilot",
					"pilot-can_fly-plane"
				WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				AND #{sql}
			"""

do ->
	{odata, sql} = createExpression('plane/id', 'eq', 10)
	test '/pilot(1)/pilot__can_fly__plane?$filter=' + odata, (result) ->
		it 'should select from pilot__can_fly__plane where "' + odata + '"', ->
			expect(result.query).to.equal """
				SELECT #{pilotCanFlyPlaneFields}
				FROM "pilot",
					"pilot-can_fly-plane",
					"plane"
				WHERE "pilot"."id" = 1
				AND "plane"."id" = "pilot-can_fly-plane"."plane"
				AND #{sql}
				AND "pilot"."id" = "pilot-can_fly-plane"."pilot"
			"""

do ->
	{odata, sql} = createExpression('pilot__can_fly__plane/plane/id', 'eq', 10)
	name = 'Peter'
	bindings = [
		['Bind', ['pilot', 'name']]
	]
	filterWhere = [
		'WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"'
		'AND "plane"."id" = "pilot-can_fly-plane"."plane"'
		"AND #{sql}"
	]
	insertTest = (result) ->
		expect(result.query).to.equal """
			INSERT INTO "pilot" ("name")
			SELECT "pilot"."name"
			FROM "pilot-can_fly-plane",
				"plane",
				(
				SELECT NULL AS "created at", NULL AS "id", NULL AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", NULL AS "age", NULL AS "favourite colour", NULL AS "team", NULL AS "licence", NULL AS "hire date"
			) AS "pilot"
			#{filterWhere.join('\n')}
		"""
	updateWhere = """
		WHERE "pilot"."id" IN ((
			SELECT "pilot"."id"
			FROM "pilot-can_fly-plane",
				"plane",
				"pilot"
			#{filterWhere.join('\n\t')}
		))
	"""

	test "/pilot?$filter=#{odata}", (result) ->
		it "should select from pilot where '#{odata}'", ->
			expect(result.query).to.equal """
				SELECT #{pilotFields}
				FROM "pilot",
					"pilot-can_fly-plane",
					"plane"
				#{filterWhere.join('\n')}
			"""

	test "/pilot?$filter=#{odata}", 'PATCH', bindings, { name }, (result) ->
		it "should update pilot where '#{odata}'", ->
			expect(result.query).to.equal """
				UPDATE "pilot"
				SET "name" = ?
				#{updateWhere}
			"""

	test "/pilot?$filter=#{odata}", 'POST', bindings, { name }, (result) ->
		it "should insert pilot where '#{odata}'", ->
			insertTest(result)

	test "/pilot?$filter=#{odata}", 'PUT', bindings, { name }, (result) ->
		describe 'should upsert the pilot with id 1', ->
			it 'should be an upsert', ->
				expect(result).to.be.an.array
			it 'that inserts', ->
				insertTest(result[0])
			it 'and updates', ->
				expect(result[1].query).to.equal """
					UPDATE "pilot"
					SET "created at" = DEFAULT,
						"id" = DEFAULT,
						"is experienced" = DEFAULT,
						"name" = ?,
						"age" = DEFAULT,
						"favourite colour" = DEFAULT,
						"team" = DEFAULT,
						"licence" = DEFAULT,
						"hire date" = DEFAULT
					#{updateWhere}
				"""

	test "/pilot?$filter=#{odata}", 'DELETE', (result) ->
		it 'should delete from pilot where "' + odata + '"', ->
			expect(result.query).to.equal """
				DELETE FROM "pilot"
				WHERE "pilot"."id" IN ((
					SELECT "pilot"."id"
					FROM "pilot-can_fly-plane",
						"plane",
						"pilot"
					#{filterWhere.join('\n\t')}
				))
			"""

do ->
	name = 'Peter'
	{odata, sql, bindings: exprBindings} = createExpression('name', 'eq', "'#{name}'")
	bindings = [
		['Bind', ['pilot', 'name']]
		exprBindings...
	]
	test "/pilot?$filter=#{odata}", 'POST', bindings, { name }, (result) ->
		it "should insert into pilot where '#{odata}'", ->
			expect(result.query).to.equal """
				INSERT INTO "pilot" ("name")
				SELECT "pilot"."name"
				FROM (
					SELECT NULL AS "created at", NULL AS "id", NULL AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", NULL AS "age", NULL AS "favourite colour", NULL AS "team", NULL AS "licence", NULL AS "hire date"
				) AS "pilot"
				WHERE #{sql}
			"""

	bindings = [
		['Bind', ['pilot', 'id']]
		['Bind', ['pilot', 'name']]
		exprBindings...
	]
	test '/pilot(1)?$filter=' + odata, 'PATCH', bindings, { name }, (result) ->
		it 'should update the pilot with id 1', ->
			expect(result.query).to.equal """
				UPDATE "pilot"
				SET "id" = ?,
					"name" = ?
				WHERE "pilot"."id" = 1
				AND "pilot"."id" IN ((
					SELECT "pilot"."id"
					FROM "pilot"
					WHERE #{sql}
				))
			"""

	test '/pilot(1)?$filter=' + odata, 'PUT', bindings, { name }, (result) ->
		describe 'should upsert the pilot with id 1', ->
			it 'should be an upsert', ->
				expect(result).to.be.an.array
			it 'that inserts', ->
				expect(result[0].query).to.equal """
					INSERT INTO "pilot" ("id", "name")
					SELECT "pilot"."id", "pilot"."name"
					FROM (
						SELECT NULL AS "created at", CAST(? AS INTEGER) AS "id", NULL AS "is experienced", CAST(? AS VARCHAR(255)) AS "name", NULL AS "age", NULL AS "favourite colour", NULL AS "team", NULL AS "licence", NULL AS "hire date"
					) AS "pilot"
					WHERE #{sql}
				"""
			it 'and updates', ->
				expect(result[1].query).to.equal """
					UPDATE "pilot"
					SET "created at" = DEFAULT,
						"id" = ?,
						"is experienced" = DEFAULT,
						"name" = ?,
						"age" = DEFAULT,
						"favourite colour" = DEFAULT,
						"team" = DEFAULT,
						"licence" = DEFAULT,
						"hire date" = DEFAULT
					WHERE "pilot"."id" = 1
					AND "pilot"."id" IN ((
						SELECT "pilot"."id"
						FROM "pilot"
						WHERE #{sql}
					))
				"""

do ->
	oneEqOne = createExpression(1, 'eq', 1)
	{odata, sql} = createExpression(oneEqOne, 'or', oneEqOne)
	test '/pilot(1)/pilot__can_fly__plane?$filter=' + odata, (result) ->
		it 'should select from pilot__can_fly__plane where "' + odata + '"', ->
			expect(result.query).to.equal """
				SELECT #{pilotCanFlyPlaneFields}
				FROM "pilot",
					"pilot-can_fly-plane"
				WHERE "pilot"."id" = 1
				AND #{sql}
				AND "pilot"."id" = "pilot-can_fly-plane"."pilot"
			"""

methodTest('contains', 'name', "'et'")
methodTest('endswith', 'name', "'ete'")
methodTest('startswith', 'name', "'P'")
operandTest(createMethodCall('length', 'name'), 'eq', 4)
operandTest(createMethodCall('indexof', 'name', "'Pe'"), 'eq', 0)
operandTest(createMethodCall('substring', 'name', 1), 'eq', "'ete'")
operandTest(createMethodCall('substring', 'name', 1, 2), 'eq', "'et'")
operandTest(createMethodCall('tolower', 'name'), 'eq', "'pete'")
operandTest(createMethodCall('tolower', 'licence/name'), 'eq', "'pete'")
operandTest(createMethodCall('toupper', 'name'), 'eq', "'PETE'")
do ->
	concat = createMethodCall('concat', 'name', "'%20'")
	operandTest(createMethodCall('trim', concat), 'eq', "'Pete'")
	operandTest(concat, 'eq', "'Pete%20'")
operandTest(createMethodCall('round', 'age'), 'eq', 25)
operandTest(createMethodCall('floor', 'age'), 'eq', 25)
operandTest(createMethodCall('ceiling', 'age'), 'eq', 25)

methodTest('substringof', "'Pete'", 'name')
operandTest(createMethodCall('replace', 'name', "'ete'", "'at'"), 'eq', "'Pat'")

test "/pilot?$filter=pilot__can_fly__plane/any(d:d/plane/name eq 'Concorde')", 'GET', [['Text', 'Concorde']], (result) ->
	it 'should select from pilot where ...', ->
		expect(result.query).to.equal """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE EXISTS (
				SELECT 1
				FROM "pilot-can_fly-plane",
					"plane"
				WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				AND "plane"."id" = "pilot-can_fly-plane"."plane"
				AND "plane"."name" = ?
			)
		"""

test "/pilot?$filter=pilot__can_fly__plane/all(d:d/plane/name eq 'Concorde')", 'GET', [['Text', 'Concorde']], (result) ->
	it 'should select from pilot where ...', ->
		expect(result.query).to.equal """
			SELECT #{pilotFields}
			FROM "pilot"
			WHERE NOT EXISTS (
				SELECT 1
				FROM "pilot-can_fly-plane",
					"plane"
				WHERE NOT (
					"pilot"."id" = "pilot-can_fly-plane"."pilot"
					AND "plane"."id" = "pilot-can_fly-plane"."plane"
					AND "plane"."name" = ?
				)
			)
		"""

test "/pilot?$filter=pilot__can_fly__plane/plane/any(d:d/name eq 'Concorde')", 'GET', [['Text', 'Concorde']], (result) ->
	it 'should select from pilot where ...', ->
		expect(result.query).to.equal """
			SELECT #{pilotFields}
			FROM "pilot",
				"pilot-can_fly-plane"
			WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
			AND EXISTS (
				SELECT 1
				FROM "plane"
				WHERE "plane"."id" = "pilot-can_fly-plane"."plane"
				AND "plane"."name" = ?
			)
		"""

test "/pilot?$filter=pilot__can_fly__plane/plane/all(d:d/name eq 'Concorde')", 'GET', [['Text', 'Concorde']], (result) ->
	it 'should select from pilot where ...', ->
		expect(result.query).to.equal """
			SELECT #{pilotFields}
			FROM "pilot",
				"pilot-can_fly-plane"
			WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
			AND NOT EXISTS (
				SELECT 1
				FROM "plane"
				WHERE NOT (
					"plane"."id" = "pilot-can_fly-plane"."plane"
					AND "plane"."name" = ?
				)
			)
		"""

# Switch operandToSQL permanently to using 'team' as the resource,
# as we are switch to using that as our base resource from here on.
operandToSQL = _.partialRight(operandToSQL, 'team')
do ->
	favouriteColour = 'purple'
	{odata, sql, bindings} = createExpression('favourite_colour', 'eq', "'#{favouriteColour}'")
	test '/team?$filter=' + odata, 'POST', [['Bind', ['team', 'favourite_colour']]].concat(bindings), {favourite_colour: favouriteColour}, (result) ->
		it 'should insert into team where "' + odata + '"', ->
			expect(result.query).to.equal '''
				INSERT INTO "team" ("favourite colour")
				SELECT "team"."favourite colour"
				FROM (
					SELECT NULL AS "created at", CAST(? AS INTEGER) AS "favourite colour"
				) AS "team"
				WHERE ''' + sql

do ->
	{odata, sql, bindings} = createExpression('pilot/pilot__can_fly__plane/plane/name', 'eq', "'Concorde'")
	test '/team?$filter=' + odata, 'GET', bindings, (result) ->
		it 'should select from team where "' + odata + '"', ->
			expect(result.query).to.equal """
				SELECT #{teamFields}
				FROM "team",
					"pilot",
					"pilot-can_fly-plane",
					"plane"
				WHERE "team"."favourite colour" = "pilot"."team"
				AND "pilot"."id" = "pilot-can_fly-plane"."pilot"
				AND "plane"."id" = "pilot-can_fly-plane"."plane"
				AND #{sql}
			"""
