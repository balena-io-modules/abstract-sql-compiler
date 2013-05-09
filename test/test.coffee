require('ometa-js')
ODataParser = require('odata-parser').ODataParser.createInstance()
OData2AbstractSQL = require('odata-to-abstract-sql').OData2AbstractSQL.createInstance()
OData2AbstractSQL.clientModel = require('./client-model.json')
AbstractSQLCompiler = require('../index')

expect = require('chai').expect
_ = require('lodash')

bindingsTest = (actualBindings, expectedBindings = false) ->
	if expectedBindings is false
		it 'should not have any bindings', ->
			expect(actualBindings).to.be.empty
	else
		it 'should not have matching bindings', ->
			expect(actualBindings).to.deep.equal(expectedBindings)

runExpectation = (describe, input, method, expectedBindings, body, expectation) ->
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
			input = ODataParser.matchAll(input, 'OData')
			input = OData2AbstractSQL.match(input, 'Process', [method, body])
			result = AbstractSQLCompiler.compile(null, input)
			if _.isArray(result)
				for actualResult in result
					bindingsTest(actualResult.bindings, expectedBindings)
			else
				bindingsTest(result.bindings, expectedBindings)
			expectation(result)
		catch e
			expectation(e)

module.exports = runExpectation.bind(null, describe)
module.exports.skip = runExpectation.bind(null, describe.skip)
module.exports.only = runExpectation.bind(null, describe.only)