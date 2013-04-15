require('ometa-js')
ODataParser = require('odata-parser').ODataParser.createInstance()
OData2AbstractSQL = require('odata-to-abstract-sql').OData2AbstractSQL.createInstance()
OData2AbstractSQL.clientModel = require('./client-model.json')
AbstractSQLCompiler = require('../index')

describex = describe
runExpectation = (describe, input, method, expectation) ->
	if !expectation?
		expectation = method
		method = 'GET'

	describe 'Parsing ' + input, ->
		try
			input = ODataParser.matchAll(input, 'OData')
			# if describe is describex.only
				# console.log input
			input = OData2AbstractSQL.match(input, 'Process', [method])
			if describe is describex.only
				console.log input
				console.log input[1]
			result = AbstractSQLCompiler.compile(null, input)
			if describe is describex.only
				console.log result
			expectation(result)
		catch e
			expectation(e)

module.exports = runExpectation.bind(null, describe)
module.exports.skip = runExpectation.bind(null, describe.skip)
module.exports.only = runExpectation.bind(null, describe.only)