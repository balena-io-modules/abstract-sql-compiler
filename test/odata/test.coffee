require('ometa-js')
ODataParser = require('@resin/odata-parser').ODataParser.createInstance()
OData2AbstractSQL = require('@resin/odata-to-abstract-sql').OData2AbstractSQL.createInstance()
OData2AbstractSQL.clientModel = require('../client-model.json')
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

x = describe.only
runExpectation = (describe, engine, input, method, expectedBindings, body, expectation) ->
	# return if describe isnt x
	if !expectation?
		if !body?
			if !expectedBindings?
				expectation = method
				method = 'GET'
			else
				expectation = expectedBindings
			expectedBindings = false
		else
			expectation = body
		body = {}

	describe 'Parsing ' + method + ' ' + input, ->
		try
			input = ODataParser.matchAll(input, 'Process')
			input = OData2AbstractSQL.match(input.tree, 'Process', [method, body])
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
		expectation(result)

bindRunExpectation = (engine) ->
	bound = runExpectation.bind(null, describe, engine)
	bound.skip = runExpectation.bind(null, describe.skip, engine)
	bound.only = runExpectation.bind(null, describe.only, engine)
	return bound

module.exports = bindRunExpectation('postgres')
module.exports.postgres = bindRunExpectation('postgres')
module.exports.mysql = bindRunExpectation('mysql')
module.exports.websql = bindRunExpectation('websql')
