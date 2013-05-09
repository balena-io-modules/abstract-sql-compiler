expect = require('chai').expect
test = require('./test')
clientModel = require('./client-model.json')
_ = require('lodash')

operandToSQL = (operand) ->
	if _.isNumber(operand)
		return operand
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

createExpression = (lhs, op, rhs) ->
	if lhs is 'not'
		return {
			odata: 'not ' + if op.odata? then '(' + op.odata + ')' else op
			sql: 'NOT (\n\t' + (op.sql ? operandToSQL(op)) + '\n)'
		}
	lhsSql = lhs.sql ? operandToSQL(lhs)
	rhsSql = rhs.sql ? operandToSQL(rhs)
	sql = lhsSql + sqlOps[op] + ' ' + rhsSql
	if sqlOpBrackets[op]
		sql = '(' + sql + ')'
	return {
		odata: (lhs.odata ? lhs) + ' ' + op + ' ' + (rhs.odata ? rhs)
		sql
	}
createMethodCall = (method, args...) ->
	return {
		odata: method + '(' + (arg.odata ? arg for arg in args).join(',') + ')'
		sql: method + '(' + (arg.sql ? operandToSQL(arg) for arg in args).join(', ') + ')'
	}

operandTest = (lhs, op, rhs = 'name') ->
	{odata, sql} = createExpression(lhs, op, rhs)
	test '/pilot?$filter=' + odata, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT "pilot".*
				FROM "pilot"
				WHERE ''' + sql

methodTest = (args...) ->
	{odata, sql} = createMethodCall.apply(null, args)
	test.skip '/pilot?$filter=' + odata, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT "pilot".*
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
				SELECT "pilot".*
				FROM "pilot",
					"pilot-can_fly-plane"
				WHERE "pilot"."id" = "pilot-can_fly-plane"."pilot"
				AND ''' + sql

do ->
	{odata, sql} = createExpression('plane/id', 'eq', 10)
	test '/pilot(1)/pilot__can_fly__plane?$filter=' + odata, (result) ->
		it 'should select from pilot__can_fly__plane where "' + odata + '"', ->
			expect(result.query).to.equal '''
				SELECT "pilot-can_fly-plane".*
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
				SELECT "pilot".*
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
				SELECT "pilot-can_fly-plane".*
				FROM "pilot",
					"pilot-can_fly-plane"
				WHERE "pilot"."id" = 1
				AND ''' + sql + '\n' + '''
				AND "pilot"."id" = "pilot-can_fly-plane"."pilot"'''

# methodTest('substringof', "'Pete'", 'name')
# methodTest('startswith', 'name', "'P'")
# methodTest('endswith', 'name', "'ete'")
# operandTest(createMethodCall('length', 'name'), 'eq', 4)
# operandTest(createMethodCall('indexof', 'name', "'Pe'"), 'eq', 0)
# operandTest(createMethodCall('replace', 'name', "'ete'", "'at'"), 'eq', "'Pat'")
# operandTest(createMethodCall('substring', 'name', 1), 'eq', "'ete'")
# operandTest(createMethodCall('substring', 'name', 1, 2), 'eq', "'et'")
# operandTest(createMethodCall('tolower', 'name'), 'eq', "'pete'")
# operandTest(createMethodCall('toupper', 'name'), 'eq', "'PETE'")

# do ->
	# concat = createMethodCall('concat', 'name', "'%20'")
	# operandTest(concat, 'eq', "'Pete%20'")
	# operandTest(createMethodCall('trim', concat), 'eq', "'Pete'")

# operandTest(createMethodCall('round', 'age'), 'eq', 25)
# operandTest(createMethodCall('floor', 'age'), 'eq', 25)
# operandTest(createMethodCall('ceiling', 'age'), 'eq', 25)