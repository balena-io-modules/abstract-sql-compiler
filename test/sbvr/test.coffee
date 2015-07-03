_ = require 'lodash'
sbvrTypes = require '@resin/sbvr-types'

expect = require('chai').expect
AbstractSQLCompiler = require('../..')

module.exports = exports = (builtInVocab = false) ->
	SBVRParser = require('@resin/sbvr-parser').SBVRParser.createInstance()
	SBVRParser.enableReusingMemoizations(SBVRParser._sideEffectingRules)

	LF2AbstractSQL = require '@resin/lf-to-abstract-sql'
	LF2AbstractSQLTranslator = LF2AbstractSQL.createTranslator(sbvrTypes)

	if builtInVocab
		SBVRParser.AddBuiltInVocab(builtInVocab)

	seSoFar = ''

	runExpectation = (describe, input, expectation) ->
		it input, ->
			try
				seSoFar += input + '\n'
				SBVRParser.reset()
				lf = SBVRParser.matchAll(seSoFar, 'Process')
				schema = LF2AbstractSQLTranslator(lf, 'Process')
				result = AbstractSQLCompiler.postgres.compileSchema(schema)
			catch e
				expectation?(e)
				throw e

			if _.isFunction(expectation)
				expectation(result)
			else
				expect(result).to.have.property('createSchema')
				# Individually match the statements in order to get a nicer diff if they don't match.
				for i in [0...Math.max(result.createSchema.length, expectation.length)]
					expect(result.createSchema[i]).to.equal(expectation[i])

	ret = runExpectation.bind(null, describe)
	ret.skip = runExpectation.bind(null, describe.skip)
	ret.only = runExpectation.bind(null, describe.only)
	return ret
