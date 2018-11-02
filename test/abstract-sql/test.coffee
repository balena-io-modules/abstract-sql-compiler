AbstractSQLCompiler = require('../..')

expect = require('chai').expect
_ = require('lodash')

bindingsTest = (actualBindings, expectedBindings = false) ->
	if expectedBindings is false
		it 'should not have any bindings', ->
			expect(actualBindings).to.be.empty
	else
		it 'should have matching bindings', ->
			expect(actualBindings).to.deep.equal(expectedBindings)

equals = (actual, expected) ->
	expect(actual).to.equal(expected)
sqlEquals =
	websql: equals
	mysql: equals
	postgres: (actual, expected) ->
		num = 1
		while _.includes(expected, '?')
			expected = expected.replace('?', '$' + num)
			num++
		equals(actual, expected)

runExpectation = (describe, engine, input, expectedBindings, body, expectation) ->
	if !expectation?
		if !body?
			expectedBindings = false
		else
			expectation = body
		body = {}

	describe 'Parsing ' + JSON.stringify(input), ->
		try
			result = AbstractSQLCompiler[engine].compileRule(input)
		catch e
			expectation(e)
			return
		if _.isArray(result)
			for actualResult, i in result
				if expectedBindings[0][0] is 'Bind'
					bindingsTest(actualResult.bindings, expectedBindings)
				else
					bindingsTest(actualResult.bindings, expectedBindings[i])
		else
			bindingsTest(result.bindings, expectedBindings)
		expectation(result, sqlEquals[engine])

bindRunExpectation = (engine) ->
	bound = runExpectation.bind(null, describe, engine)
	bound.skip = runExpectation.bind(null, describe.skip, engine)
	bound.only = runExpectation.bind(null, describe.only, engine)
	return bound

module.exports = bindRunExpectation('postgres')
module.exports.postgres = bindRunExpectation('postgres')
module.exports.mysql = bindRunExpectation('mysql')
module.exports.websql = bindRunExpectation('websql')

