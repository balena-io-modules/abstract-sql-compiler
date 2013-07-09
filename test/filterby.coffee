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
	if _.isDate(operand)
		return [['Date', operand]]
	return []

operandToSQL = (operand) ->
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
			mapping = clientModel.resourceToSQLMappings['pilot'][operand]
		return '"' + mapping.join('"."') + '"'
	throw 'Unknown operand type: ' + operand

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
	toupper: 'UPPER'
	tolower: 'LOWER'

createExpression = (lhs, op, rhs) ->
	if lhs is 'not'
		return {
			odata: 'not ' + if op.odata? then '(' + op.odata + ')' else operandToOData(op)
			sql: 'NOT (\n\t' + (op.sql ? operandToSQL(op)) + '\n)'
		}
	lhsSql = operandToSQL(lhs)
	rhsSql = operandToSQL(rhs)
	bindings = [].concat(
		operandToBindings(lhs)
		operandToBindings(rhs)
	)
	sql = lhsSql + sqlOps[op] + ' ' + rhsSql
	if sqlOpBrackets[op]
		sql = '(' + sql + ')'
	return {
		odata: operandToOData(lhs) + ' ' + op + ' ' + operandToOData(rhs)
		sql
		bindings
	}
createMethodCall = (method, args...) ->
	return {
		odata: method + '(' + (operandToOData(arg) for arg in args).join(',') + ')'
		sql: (
			switch method
				when 'substringof'
					operandToSQL(args[1]) + " LIKE ('%' || " + operandToSQL(args[0]) + " || '%')"
				else
					if methodMaps.hasOwnProperty(method)
						method = methodMaps[method]
					method + '(' + (operandToSQL(arg) for arg in args).join(', ') + ')'
		)
	}

operandTest = (lhs, op, rhs = 'name') ->
	{odata, sql, bindings} = createExpression(lhs, op, rhs)
	test '/pilot?$filter=' + odata, 'GET', bindings, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotFields + '\n' + '''
				FROM "pilot"
				WHERE ''' + sql

methodTest = (args...) ->
	{odata, sql} = createMethodCall.apply(null, args)
	test '/pilot?$filter=' + odata, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT ''' + pilotFields + '\n' + '''
				FROM "pilot"
				WHERE ''' + sql

operandTest(2, 'eq')
operandTest(2, 'ne')
operandTest(2, 'gt')
operandTest(2, 'ge')
operandTest(2, 'lt')
operandTest(2, 'le')

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
# methodTest('startswith', 'name', "'P'")
# methodTest('endswith', 'name', "'ete'")
# operandTest(createMethodCall('length', 'name'), 'eq', 4)
# operandTest(createMethodCall('indexof', 'name', "'Pe'"), 'eq', 0)
# operandTest(createMethodCall('replace', 'name', "'ete'", "'at'"), 'eq', "'Pat'")
# operandTest(createMethodCall('substring', 'name', 1), 'eq', "'ete'")
# operandTest(createMethodCall('substring', 'name', 1, 2), 'eq', "'et'")
operandTest(createMethodCall('tolower', 'name'), 'eq', "'pete'")
operandTest(createMethodCall('toupper', 'name'), 'eq', "'PETE'")

# do ->
	# concat = createMethodCall('concat', 'name', "'%20'")
	# operandTest(concat, 'eq', "'Pete%20'")
	# operandTest(createMethodCall('trim', concat), 'eq', "'Pete'")

# operandTest(createMethodCall('round', 'age'), 'eq', 25)
# operandTest(createMethodCall('floor', 'age'), 'eq', 25)
# operandTest(createMethodCall('ceiling', 'age'), 'eq', 25)

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
