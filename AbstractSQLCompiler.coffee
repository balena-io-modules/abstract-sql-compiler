((root, factory) ->
	if typeof define is 'function' and define.amd
		# AMD. Register as an anonymous module.
		define([
			'@resin/abstract-sql-compiler/AbstractSQLOptimiser'
			'@resin/abstract-sql-compiler/AbstractSQLRules2SQL'
			'@resin/sbvr-types'
			'lodash'
			'bluebird'
		], factory)
	else if typeof exports is 'object'
		# Node. Does not work with strict CommonJS, but
		# only CommonJS-like enviroments that support module.exports,
		# like Node.
		module.exports = factory(
			require('./AbstractSQLOptimiser')
			require('./AbstractSQLRules2SQL')
			require('@resin/sbvr-types')
			require('lodash')
			require('bluebird')
		)
	else
		# Browser globals
		root.AbstractSQLCompiler = factory(root.AbstractSQLOptimiser, root.AbstractSQLRules2SQL, root.sbvrTypes, root._, root.Promise)
) this, ({ AbstractSQLOptimiser }, { AbstractSQLRules2SQL }, sbvrTypes, _, Promise) ->
	validateTypes = _.mapValues sbvrTypes, ({ validate }) ->
		if validate?
			Promise.promisify(validate)

	dataTypeValidate = (value, field, callback) ->
		# In case one of the validation types throws an error.
		{ dataType, required } = field
		if value == null
			if required
				Promise.rejected('cannot be null')
			else
				Promise.fulfilled(null)
		else if validateTypes[dataType]?
			validateTypes[dataType](value, required)
		else
			Promise.rejected('is an unsupported type: ' + dataType)

	dataTypeGen = (engine, dataType, necessity, index = '', defaultValue) ->
		necessity = if necessity then ' NOT NULL' else ' NULL'
		defaultValue = if defaultValue then " DEFAULT #{defaultValue}"
		if index != ''
			index = ' ' + index
		dbType = sbvrTypes[dataType]?.types?[engine]
		if dbType?
			if _.isFunction(dbType)
				return dbType(necessity, index)
			defaultValue ?= ''
			return dbType + defaultValue + necessity + index
		else
			throw new Error("Unknown data type '#{dataType}' for engine: #{engine}")

	getReferencedFields = (ruleBody) ->
		tableAliases = {}
		referencedFields = {}
		recurse = (rulePart) ->
			_.each rulePart, (part) ->
				if _.isArray(part)
					if part[0] is 'ReferencedField'
						referencedFields[part[1]] ?= []
						referencedFields[part[1]].push(part[2])
						return
					if part[0] is 'Field'
						throw new Error('Cannot find queried fields for unreferenced fields')
					if part[0] is 'From'
						if _.isArray(part[1])
							nested = part[1]
							if _.isArray(nested[1])
								throw new Error('Cannot handle aliased select queries')
							table = nested[0]
							alias = nested[1]
							tableAliases[alias] = table
					recurse(part)
		recurse(ruleBody)

		for alias, table of tableAliases
			tableFields = referencedFields[table] ? []
			aliasFields = referencedFields[alias] ? []
			referencedFields[table] = tableFields.concat(aliasFields)

		return referencedFields

	getModifiedFields = do ->
		checkQuery = (query) ->
			queryType = query[0]
			if queryType not in [ 'InsertQuery', 'UpdateQuery', 'DeleteQuery' ]
				return

			froms = _.filter(query, 0: 'From')
			if froms.length isnt 1
				return

			table = froms[0][1]

			if queryType in [ 'InsertQuery', 'DeleteQuery' ]
				return { table }

			fields = _.filter(query, 0: 'Fields')
			fields = _.flatMap(fields, 1)
			return { table, fields }

		return (abstractSqlQuery) ->
			if _.isArray(abstractSqlQuery[0])
				_.map(abstractSqlQuery, checkQuery)
			else
				checkQuery(abstractSqlQuery)


	compileRule = do ->
		optimiser = AbstractSQLOptimiser.createInstance()
		compiler = AbstractSQLRules2SQL.createInstance()
		return (abstractSQL, engine) ->
			abstractSQL = optimiser.match(abstractSQL, 'Process')
			compiler.engine = engine
			return compiler.match(abstractSQL, 'Process')

	compileSchema = (sqlModel, engine, ifNotExists) ->
		ifNotExists = if ifNotExists then 'IF NOT EXISTS ' else ''
		hasDependants = {}
		schemaDependencyMap = {}
		for own resourceName, table of sqlModel.tables when !_.isString(table)
			foreignKeys = []
			depends = []
			dropSQL = 'DROP TABLE "' + table.name + '";'
			createSQL = 'CREATE TABLE ' + ifNotExists + '"' + table.name + '" (\n\t'

			for { dataType, fieldName, required, index, references, defaultValue } in table.fields
				createSQL += '"' + fieldName + '" ' + dataTypeGen(engine, dataType, required, index, defaultValue) + '\n,\t'
				if dataType in [ 'ForeignKey', 'ConceptType' ]
					foreignKeys.push({ fieldName, references })
					depends.push(references.tableName)
					hasDependants[references.tableName] = true

			for foreignKey in foreignKeys
				createSQL += 'FOREIGN KEY ("' + foreignKey.fieldName + '") REFERENCES "' + foreignKey.references.tableName + '" ("' + foreignKey.references.fieldName + '")' + '\n,\t'
			for index in table.indexes
				createSQL += index.type + '("' + index.fields.join('", "') + '")\n,\t'
			createSQL = createSQL[0...-2] + ');'
			schemaDependencyMap[table.name] =
				resourceName: resourceName
				primitive: table.primitive
				createSQL: createSQL
				dropSQL: dropSQL
				depends: depends

		createSchemaStatements = []
		dropSchemaStatements = []
		tableNames = []
		while tableNames.length != (tableNames = Object.keys(schemaDependencyMap)).length && tableNames.length > 0
			for tableName in tableNames
				schemaInfo = schemaDependencyMap[tableName]
				unsolvedDependency = false
				for dependency in schemaInfo.depends when dependency != schemaInfo.resourceName # Self-dependencies are ok.
					if schemaDependencyMap.hasOwnProperty(dependency)
						unsolvedDependency = true
						break
				if unsolvedDependency == false
					if sqlModel.tables[schemaInfo.resourceName].exists = (schemaInfo.primitive == false || hasDependants[tableName]?)
						if schemaInfo.primitive != false
							console.warn("We're adding a primitive table??", schemaInfo.resourceName)
						createSchemaStatements.push(schemaInfo.createSQL)
						dropSchemaStatements.push(schemaInfo.dropSQL)
					delete schemaDependencyMap[tableName]
		if schemaDependencyMap.length > 0
			console.error('Failed to resolve all schema dependencies', schemaDependencyMap)
			throw new Error('Failed to resolve all schema dependencies')
		dropSchemaStatements = dropSchemaStatements.reverse()

		ruleStatements = []
		try
			for rule in sqlModel.rules
				ruleBody = _.find(rule, 0: 'Body')[1]
				ruleSE = _.find(rule, 0: 'StructuredEnglish')[1]
				ruleSQL = compileRule(ruleBody, engine)
				try
					referencedFields = AbstractSQLCompiler.getReferencedFields(ruleBody)
				catch e
					console.warn('Error fetching referenced fields', e)

				ruleStatements.push(
					structuredEnglish: ruleSE
					sql: ruleSQL
					referencedFields: referencedFields
				)
		catch e
			console.error('Failed to compile the rule', JSON.stringify(rule, null, '\t'))
			console.error(e, e.stack)
			throw e

		return {
			tables: sqlModel.tables
			createSchema: createSchemaStatements
			dropSchema: dropSchemaStatements
			rules: ruleStatements
		}


	module.exports =
		_.mapValues
			postgres: true
			mysql: true
			websql: false
			(ifNotExists, engine) ->
				compileSchema: _.partial(compileSchema, _, engine, ifNotExists)
				compileRule: _.partial(compileRule, _, engine)
				dataTypeValidate: dataTypeValidate
				getReferencedFields: getReferencedFields
				getModifiedFields: getModifiedFields
