fs = require('fs')
require('ometa-js')
ODataParser = require('@resin/odata-parser').ODataParser.createInstance()
OData2AbstractSQL = require('@resin/odata-to-abstract-sql').OData2AbstractSQL.createInstance()
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
OData2AbstractSQL.setClientModel(clientModel)

bindingsTest = (actualBindings, expectedBindings = false) ->
	if expectedBindings is false
		it 'should not have any bindings', ->
			expect(actualBindings).to.be.empty
	else
		it 'should have matching bindings', ->
			expect(actualBindings).to.deep.equal(expectedBindings)

x = describe.only
runExpectation = (describe, engine, namespace, input, method, expectedBindings, body, expectation) ->
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
	if namespace
		description = "Parsing #{method} #{input} #{namespace}"
	else
		description = "Parsing #{method} #{input}"

	describe description, ->
		try
			input = ODataParser.matchAll(input, 'Process')
			{ tree, extraBodyVars } = OData2AbstractSQL.match(input.tree, 'Process', [method, _.keys(body)])
			_.assign(body, extraBodyVars)
			result = AbstractSQLCompiler[engine].compileRule(tree, namespace)
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

bindRunExpectation = (engine, namespace = null) ->
	bound = runExpectation.bind(null, describe, engine, namespace)
	bound.skip = runExpectation.bind(null, describe.skip, engine, namespace)
	bound.only = runExpectation.bind(null, describe.only, engine, namespace)
	return bound

module.exports = bindRunExpectation('postgres')
module.exports.clientModel = clientModel
module.exports.postgres = bindRunExpectation('postgres')
module.exports.mysql = bindRunExpectation('mysql')
module.exports.websql = bindRunExpectation('websql')
module.exports.namespace = (v) -> bindRunExpectation('postgres', v)
