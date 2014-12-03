expect = require('chai').expect
test = require('./test')
clientModel = require('./client-model.json')
_ = require('lodash')
{pilotFields, pilotCanFlyPlaneFields} = require('./fields')
pilotFields = pilotFields.join(', ')
pilotCanFlyPlaneFields = pilotCanFlyPlaneFields.join(', ')

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
	return []

operandToSQL = (operand, resource = 'pilot') ->
	if operand.sql?
		return operand.sql
	if _.isNumber(operand)
		return operand
	if _.isDate(operand)
		return '?'
	if _.isString(operand)
		if operand.charAt(0) is "'"
			return decodeURIComponent(operand)
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
	INDEXOF: 'STRPOS'

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
		when 'SUBSTRINGOF'
			return {
				sql: args[1].sql + " LIKE ('%' || " + args[0].sql + " || '%')"
				bindings: args[1].bindings.concat(args[0].bindings)
				odata
			}
		when 'STARTSWITH'
			return {
				sql: args[1].sql + ' LIKE (' + args[0].sql + " || '%')"
				bindings: args[1].bindings.concat(args[0].bindings)
				odata
			}
		when 'ENDSWITH'
			return {
				sql: args[1].sql + " LIKE ('%' || " + args[0].sql + ')'
				bindings: args[1].bindings.concat(args[0].bindings)
				odata
			}
		when 'CONCAT'
			return {
				sql: '(' + (arg.sql for arg in args).join(' || ') + ')'
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
			if method is 'STRPOS'
				sql = "(#{sql} + 1)"
			return {
				sql: sql
				bindings: [].concat((arg.bindings for arg in args)...)
				odata
			}

operandTest = (lhs, op, rhs) ->
	{odata, sql, bindings} = createExpression(lhs, op, rhs)
	test '/pilot?$filter=' + odata, 'GET', bindings, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotFields + '\n' + '''
				FROM "pilot"
				WHERE ''' + sql

methodTest = (args...) ->
	{odata, sql, bindings} = createMethodCall(args...)
	test '/pilot?$filter=' + odata, 'GET', bindings, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotFields + '\n' + '''
				FROM "pilot"
				WHERE ''' + sql

operandTest(2, 'eq', 'name')
operandTest(2, 'ne', 'name')
operandTest(2, 'gt', 'name')
operandTest(2, 'ge', 'name')
operandTest(2, 'lt', 'name')
operandTest(2, 'le', 'name')

# Test each combination of operands
do ->
	operands = [
			2
			2.5
			"'bar'"
			"name"
			"pilot/name"
			new Date()
		]
	for lhs in operands
		for rhs in operands
			operandTest(lhs, 'eq', rhs)

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
	test '/pilot?$filter=' + odata, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotFields + '\n' + '''
				FROM "pilot",
					"pilot-can_fly-plane"
				WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				AND ''' + sql

do ->
	{odata, sql} = createExpression('plane/id', 'eq', 10)
	test '/pilot(1)/pilot__can_fly__plane?$filter=' + odata, (result) ->
		it 'should select from pilot__can_fly__plane where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotCanFlyPlaneFields + '\n' + '''
				FROM "pilot",
					"pilot-can_fly-plane",
					"plane"
				WHERE "pilot"."id" = 1
				AND "plane"."id" = "pilot-can_fly-plane"."plane"
				AND ''' + sql + '\n' + '''
				AND "pilot"."id" = "pilot-can_fly-plane"."pilot"'''

do ->
	{odata, sql} = createExpression('pilot__can_fly__plane/plane/id', 'eq', 10)
	test '/pilot?$filter=' + odata, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotFields + '\n' + '''
				FROM "pilot",
					"pilot-can_fly-plane",
					"plane"
				WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				AND "plane"."id" = "pilot-can_fly-plane"."plane"
				AND ''' + sql

	test '/pilot?$filter=' + odata, 'PATCH', [['Bind', ['pilot', 'name']]], name: 'Peter', (result) ->
		it 'should update pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				UPDATE "pilot"
				SET "name" = ?
				WHERE "pilot"."id" IN ((
					SELECT "pilot"."id"
					FROM "pilot-can_fly-plane",
						"plane",
						"pilot"
					WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
					AND "plane"."id" = "pilot-can_fly-plane"."plane"
					AND "plane"."id" = 10
				))
				'''

	test '/pilot?$filter=' + odata, 'DELETE', (result) ->
		it 'should delete from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				DELETE FROM "pilot"
				WHERE "pilot"."id" IN ((
					SELECT "pilot"."id"
					FROM "pilot-can_fly-plane",
						"plane",
						"pilot"
					WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
					AND "plane"."id" = "pilot-can_fly-plane"."plane"
					AND "plane"."id" = 10
				))
				'''

do ->
	name = 'Peter'
	{odata, sql} = createExpression('name', 'eq', "'#{name}'")
	test '/pilot?$filter=' + odata, 'POST', [['Bind', ['pilot', 'name']]], {name}, (result) ->
		it 'should insert into pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				INSERT INTO "pilot" ("name")
				SELECT "pilot".*
				FROM (
					SELECT CAST(? AS VARCHAR(255)) AS "name"
				) AS "pilot"
				WHERE ''' + sql

	bindings = [
		['Bind', ['pilot', 'id']]
		['Bind', ['pilot', 'name']]
	]
	test '/pilot(1)?$filter=' + odata, 'PATCH', bindings, {name}, (result) ->
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
				))"""

	bindings = [
		['Bind', ['pilot', 'id']]
		['Bind', ['pilot', 'name']]
	]
	test '/pilot(1)?$filter=' + odata, 'PUT', bindings, {name}, (result) ->
		describe 'should upsert the pilot with id 1', ->
			it 'should be an upsert', ->
				expect(result).to.be.an.array
			it 'that inserts', ->
				expect(result[0].query).to.equal """
					INSERT INTO "pilot" ("id", "name")
					SELECT "pilot".*
					FROM (
						SELECT CAST(? AS INTEGER) AS "id", CAST(? AS VARCHAR(255)) AS "name"
					) AS "pilot"
					WHERE "pilot"."name" = 'Peter'
					"""
			it 'and updates', ->
				expect(result[1].query).to.equal """
					UPDATE "pilot"
					SET "id" = ?,
						"is experienced" = DEFAULT,
						"name" = ?,
						"age" = DEFAULT,
						"favourite colour" = DEFAULT,
						"licence" = DEFAULT
					WHERE "pilot"."id" = 1
					AND "pilot"."id" IN ((
						SELECT "pilot"."id"
						FROM "pilot"
						WHERE #{sql}
					))"""

do ->
	oneEqOne = createExpression(1, 'eq', 1)
	{odata, sql} = createExpression(oneEqOne, 'or', oneEqOne)
	test '/pilot(1)/pilot__can_fly__plane?$filter=' + odata, (result) ->
		it 'should select from pilot__can_fly__plane where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotCanFlyPlaneFields + '\n' + '''
				FROM "pilot",
					"pilot-can_fly-plane"
				WHERE "pilot"."id" = 1
				AND ''' + sql + '\n' + '''
				AND "pilot"."id" = "pilot-can_fly-plane"."pilot"'''

methodTest('substringof', "'Pete'", 'name')
methodTest('startswith', 'name', "'P'")
methodTest('endswith', 'name', "'ete'")
operandTest(createMethodCall('length', 'name'), 'eq', 4)
operandTest(createMethodCall('indexof', 'name', "'Pe'"), 'eq', 0)
operandTest(createMethodCall('replace', 'name', "'ete'", "'at'"), 'eq', "'Pat'")
operandTest(createMethodCall('substring', 'name', 1), 'eq', "'ete'")
operandTest(createMethodCall('substring', 'name', 1, 2), 'eq', "'et'")
operandTest(createMethodCall('tolower', 'name'), 'eq', "'pete'")
operandTest(createMethodCall('toupper', 'name'), 'eq', "'PETE'")

do ->
	concat = createMethodCall('concat', 'name', "'%20'")
	operandTest(concat, 'eq', "'Pete%20'")
	operandTest(createMethodCall('trim', concat), 'eq', "'Pete'")

operandTest(createMethodCall('round', 'age'), 'eq', 25)
operandTest(createMethodCall('floor', 'age'), 'eq', 25)
operandTest(createMethodCall('ceiling', 'age'), 'eq', 25)

test "/pilot?$filter=pilot__can_fly__plane/any(d:d/plane/name eq 'Concorde')", (result) ->
	it 'should select from pilot where ...', ->
		expect(result.query).to.equal '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			WHERE EXISTS (
				SELECT 1
				FROM "pilot-can_fly-plane",
					"plane"
				WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				AND "plane"."id" = "pilot-can_fly-plane"."plane"
				AND "plane"."name" = 'Concorde'
			)'''

test "/pilot?$filter=pilot__can_fly__plane/all(d:d/plane/name eq 'Concorde')", (result) ->
	it 'should select from pilot where ...', ->
		expect(result.query).to.equal '''
			SELECT ''' + pilotFields + '\n' + '''
			FROM "pilot"
			WHERE NOT (
				EXISTS (
					SELECT 1
					FROM "pilot-can_fly-plane",
						"plane"
					WHERE NOT (
						"pilot"."id" = "pilot-can_fly-plane"."pilot"
						AND "plane"."id" = "pilot-can_fly-plane"."plane"
						AND "plane"."name" = 'Concorde'
					)
				)
			)'''

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
				SELECT "team".*
				FROM (
					SELECT CAST(? AS INTEGER) AS "favourite colour"
				) AS "team"
				WHERE ''' + sql
