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
			mapping = clientModel.resourceToSQLMappings[fieldParts[0]][fieldParts[1]]
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

createExpression = (lhs, op, rhs) ->
	return {
		odata: (lhs.odata ? lhs) + ' ' + op + ' ' + (rhs.odata ? rhs)
		sql: (lhs.sql ? operandToSQL(lhs)) + sqlOps[op] + ' ' + (rhs.sql ? operandToSQL(rhs))
	}

operandTest = (lhs, op, rhs = 'name') ->
	{odata, sql} = createExpression(lhs, op, rhs)
	test '/pilot?$filter=' + odata, (result) ->
		it 'should select from pilot where "' + odata + '"', ->
			expect(result.query).to.equal('''
				SELECT "pilot".*
				FROM "pilot"
				WHERE ''' + sql)

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
