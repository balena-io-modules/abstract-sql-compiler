((root, factory) ->
	if typeof define is 'function' and define.amd
		# AMD. Register as an anonymous module.
		define(['@resin/abstract-sql-compiler/AbstractSQLOptimiser', '@resin/abstract-sql-compiler/AbstractSQLSchema2SQL'], factory)
	else if typeof exports is 'object'
		# Node. Does not work with strict CommonJS, but
		# only CommonJS-like enviroments that support module.exports,
		# like Node.
		module.exports = factory(
			require('./AbstractSQLOptimiser')
			require('./AbstractSQLRules2SQL')
			require('@resin/sbvr-types')
		)
	else
		# Browser globals
		root.AbstractSQLCompiler = factory(root.AbstractSQLOptimiser, root.AbstractSQLRules2SQL)
) @, ({ AbstractSQLOptimiser }, { AbstractSQLRules2SQL }) ->
	compileRule = do ->
		optimiser = AbstractSQLOptimiser.createInstance()
		compiler = AbstractSQLRules2SQL.createInstance()
		return (abstractSQL, engine) ->
			abstractSQL = optimiser.match(abstractSQL, 'Process')
			compiler.engine = engine
			return compiler.match(abstractSQL, 'Process')

	module.exports =
		websql:
			compileRule: (rule) -> compileRule(rule, 'websql')
		postgres:
			compileRule: (rule) -> compileRule(rule, 'postgres')
		mysql:
			compileRule: (rule) -> compileRule(rule, 'mysql')
