fs = require('fs')
ODataParser = require('@resin/odata-parser')
{ OData2AbstractSQL } = require('@resin/odata-to-abstract-sql')
sbvrModel = fs.readFileSync(require.resolve('../model.sbvr'), 'utf8')

AbstractSQLCompiler = require('../..')

expect = require('chai').expect
_ = require('lodash')

generateClientModel = (input) ->
	sbvrTypes = require '@resin/sbvr-types'
	typeVocab = fs.readFileSync(require.resolve('@resin/sbvr-types/Type.sbvr'), 'utf8')

	SBVRParser = require('@resin/sbvr-parser').SBVRParser.createInstance()
	SBVRParser.enableReusingMemoizations(SBVRParser._sideEffectingRules)
	SBVRParser.AddCustomAttribute('Database ID Field:')
	SBVRParser.AddCustomAttribute('Database Table Name:')
	SBVRParser.AddBuiltInVocab(typeVocab)

	LF2AbstractSQL = require('@resin/lf-to-abstract-sql')
	LF2AbstractSQLTranslator = LF2AbstractSQL.createTranslator(sbvrTypes)

	lf = SBVRParser.matchAll(input, 'Process')
	abstractSql = LF2AbstractSQLTranslator(lf, 'Process')
	return abstractSql

clientModel = generateClientModel(sbvrModel)
odata2AbstractSQL = new OData2AbstractSQL(clientModel)

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

runExpectation = (describe, engine, input, method, expectedBindings, body, expectation) ->
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

	describe 'Parsing ' + method + ' ' + _.truncate(input, { length: 100 }), ->
		try
			input = ODataParser.parse(input)
			{ tree, extraBodyVars } = odata2AbstractSQL.match(input.tree, method, _.keys(body))
			_.assign(body, extraBodyVars)
			result = AbstractSQLCompiler[engine].compileRule(tree)
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
module.exports.clientModel = clientModel
module.exports.postgres = bindRunExpectation('postgres')
module.exports.mysql = bindRunExpectation('mysql')
module.exports.websql = bindRunExpectation('websql')
