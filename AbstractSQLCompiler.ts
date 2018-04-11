import { AbstractSQLOptimiser } from './AbstractSQLOptimiser'
import { AbstractSQLRules2SQL, Binding, SqlResult } from './AbstractSQLRules2SQL'
export { Binding, SqlResult } from './AbstractSQLRules2SQL'
type DatabaseType = string | ((necessity: string, index: string) => string)
const sbvrTypes: {
	[dataType: string]: {
		types: {
			[engine: string]: DatabaseType
		}
		validate(value: any, required: boolean, cb: (err: any, value: any) => void): void
	}
} = require('@resin/sbvr-types')
import * as _ from 'lodash'
import * as Promise from 'bluebird'

export interface AbstractSqlField {
	fieldName: string
	dataType: string
	required: boolean
	index: string
	references?: {
		resourceName: string
		fieldName: string
	}
	defaultValue?: string
	necessity: boolean
}
export interface AbstractSqlTable {
	name: string
	resourceName: string
	idField: string
	fields: AbstractSqlField[]
	indexes: Array<{
		type: string
		fields: string[]
	}>
	primitive: false | string
}
export interface ReferencedFields {
	[alias: string]: string[]
}
export interface SqlRule {
	sql: string
	bindings: Binding[]
	structuredEnglish: string
	referencedFields?: ReferencedFields
}
export type RelationshipMapping = [string, [string, string]]
export interface Relationship {
	$: RelationshipMapping
	// TODO: This should action be just Relationship, but we can't declare that in typescript currently
	[ resourceName: string ]: Relationship | RelationshipMapping
}
export interface AbstractSqlQuery extends Array<AbstractSqlQuery | string> {}
export interface AbstractSqlModel {
	synonyms: ResourceMap<string>
	relationships: ResourceMap<Relationship>
	tables: ResourceMap<AbstractSqlTable>
	rules: AbstractSqlQuery[]
}
export interface SqlModel {
	synonyms: ResourceMap<string>
	relationships: ResourceMap<Relationship>
	tables: ResourceMap<AbstractSqlTable>
	rules: SqlRule[]
	createSchema: string[]
	dropSchema: string[]
}

export interface HasDependants {
	[dependant: string]: true
}

export interface SchemaDependencyMap {
	[tableName: string]: {
		resourceName: string
		primitive: AbstractSqlTable['primitive']
		createSQL: string
		dropSQL: string
		depends: string[]
	}
}

export interface ResourceMap<T> {
	[ resourceName: string ]: T
}

export interface ModifiedFields {
	table: string
	fields?: {}[]
}

type ToSQLFn<T> = (element: T) => string | undefined
type MatchFn<T> = (haystack:Array<T>, needle:T) => (T | undefined)
interface Pair<T> { src: T, dst: T }
interface Split<T> { inserted: Array<T>, deleted: Array<T>, modified: Array<Pair<T>> }

export enum Engines {
	postgres = 'postgres',
	mysql = 'mysql',
	websql = 'websql',
}
export interface EngineInstance {
	compileSchema: (abstractSqlModel: AbstractSqlModel) => SqlModel,
	compileRule: (abstractSQL: AbstractSqlQuery) => SqlResult | SqlResult[],
	dataTypeValidate: (value: any, field: AbstractSqlField) => any,
	getReferencedFields: (ruleBody: AbstractSqlQuery) => ReferencedFields,
	getModifiedFields: (abstractSqlQuery: AbstractSqlQuery) => undefined | ModifiedFields | Array<undefined | ModifiedFields>,
}

const validateTypes = _.mapValues(sbvrTypes, ({ validate }) => {
	if (validate != null) {
		return Promise.promisify(validate)
	}
})

const dataTypeValidate: EngineInstance['dataTypeValidate'] = (value, field) => {
	// In case one of the validation types throws an error.
	const { dataType, required } = field
	if (value == null) {
		if (required) {
			return Promise.reject('cannot be null')
		} else {
			return Promise.resolve(null)
		}
	} else {
		const validateFn = validateTypes[dataType]
		if (validateFn != null) {
			return validateFn(value, required)
		} else {
			return Promise.reject('is an unsupported type: ' + dataType)
		}
	}
}

const dataTypeGen = (engine: Engines, { dataType, required, index, defaultValue }: AbstractSqlField): string => {
	let requiredStr
	if (required) {
		requiredStr = ' NOT NULL'
	} else {
		requiredStr = ' NULL'
	}
	if (defaultValue != null) {
		defaultValue = ` DEFAULT ${defaultValue}`
	} else {
		defaultValue = ''
	}
	if (index == null) {
		index = ''
	} else if (index !== '') {
		index = ' ' + index
	}
	const dbType: DatabaseType = _.get(sbvrTypes, [dataType, 'types', engine])
	if (dbType != null) {
		if (_.isFunction(dbType)) {
			return dbType(requiredStr, index)
		}
		return dbType + defaultValue + requiredStr + index
	} else {
		throw new Error(`Unknown data type '${dataType}' for engine: ${engine}`)
	}
}

const getReferencedFields: EngineInstance['getReferencedFields'] = (ruleBody) => {
	const tableAliases: {
		[alias: string]: string
	} = {}
	const referencedFields: ReferencedFields = {}
	const recurse = (rulePart: AbstractSqlQuery) => {
		_.each(rulePart, (part) => {
			if (_.isArray(part)) {
				if (part[0] === 'ReferencedField') {
					const [ , tableName, fieldName ] = part
					if (!_.isString(tableName) || !_.isString(fieldName)) {
						throw new Error('Invalid ReferencedField')
					}
					if (referencedFields[tableName] == null) {
						referencedFields[tableName] = []
					}
					referencedFields[tableName].push(fieldName)
					return
				}
				if (part[0] === 'Field') {
					throw new Error('Cannot find queried fields for unreferenced fields')
				}
				if (part[0] === 'From') {
					const nested = part[1]
					if (_.isArray(nested)) {
						const [ table, alias ] = nested
						if (!_.isString(table) || !_.isString(alias)) {
							throw new Error('Cannot handle aliased select queries')
						}
						tableAliases[alias] = table
					}
				}
				recurse(part)
			}
		})
	}
	recurse(ruleBody)

	for (const alias in tableAliases) {
		const table = tableAliases[alias]
		const tableFields = referencedFields[table] || []
		const aliasFields = referencedFields[alias] || []
		referencedFields[table] = tableFields.concat(aliasFields)
	}

	return referencedFields
}

const checkQuery = (query: AbstractSqlQuery): ModifiedFields | undefined => {
	const queryType = query[0]
	if (!_.includes([ 'InsertQuery', 'UpdateQuery', 'DeleteQuery' ], queryType)) {
		return
	}

	const froms = _.filter(query, { 0: 'From' } as Partial<AbstractSqlQuery>)
	if (froms.length !== 1) {
		return
	}

	const table = froms[0][1]
	if (!_.isString(table)) {
		return
	}

	if (queryType in [ 'InsertQuery', 'DeleteQuery' ]) {
		return { table }
	}

	const fields = _(query)
		.filter({ 0: 'Fields' } as Partial<AbstractSqlQuery>)
		.flatMap('1')
		.value()
	return { table, fields }
}
const getModifiedFields: EngineInstance['getModifiedFields'] = (abstractSqlQuery: AbstractSqlQuery) => {
	if (_.isArray(abstractSqlQuery[0])) {
		return _.map(abstractSqlQuery, checkQuery)
	} else {
		return checkQuery(abstractSqlQuery)
	}
}

const optimiser = AbstractSQLOptimiser.createInstance()
const compiler = AbstractSQLRules2SQL.createInstance()
const compileRule = (abstractSQL: AbstractSqlQuery, engine: Engines) => {
	abstractSQL = optimiser.match(abstractSQL, 'Process')
	compiler.engine = engine
	return compiler.match(abstractSQL, 'Process')
}

const mkSchemaDependencyMap = (tables: ResourceMap<AbstractSqlTable>, engine: Engines, ifNotExists: boolean) => {
	let ifNotExistsStr: string
	if (ifNotExists) {
		ifNotExistsStr = 'IF NOT EXISTS '
	} else {
		ifNotExistsStr = ''
	}
	const hasDependants: HasDependants = {}
	const schemaDependencyMap: SchemaDependencyMap = {}

	_.forOwn(tables, (table, resourceName) => {
		if (_.isString(table)) {
			return
		}
		const foreignKeys = []
		const depends = []
		const dropSQL = `DROP TABLE "${table.name}";`
		let createSQL = `CREATE TABLE ${ifNotExistsStr}"${table.name}" (\n\t`

		for (const field of table.fields) {
			const { fieldName, references, dataType } = field
			createSQL += '"' + fieldName + '" ' + dataTypeGen(engine, field) + '\n,\t'
			if (_.includes([ 'ForeignKey', 'ConceptType' ], dataType) && references != null) {
				foreignKeys.push({ fieldName, references })
				depends.push(references.resourceName)
				hasDependants[references.resourceName] = true
			}
		}

		for (const { fieldName, references } of foreignKeys) {
			const referencedTable = tables[references.resourceName]
			createSQL += `FOREIGN KEY ("${fieldName}") REFERENCES "${referencedTable.name}" ("${references.fieldName}")\n,\t`
		}
		for (const index of table.indexes) {
			createSQL += index.type + '("' + index.fields.join('", "') + '")\n,\t'
		}
		createSQL = createSQL.slice(0, -2) + ');'
		schemaDependencyMap[table.resourceName] = {
			resourceName,
			primitive: table.primitive,
			createSQL,
			dropSQL,
			depends,
		}
	})

	return { hasDependants, schemaDependencyMap }
}

const compileSchema = (abstractSqlModel: AbstractSqlModel, engine: Engines, ifNotExists: boolean): SqlModel => {
	const { hasDependants, schemaDependencyMap } = mkSchemaDependencyMap(abstractSqlModel.tables, engine, ifNotExists)

	const createSchemaStatements = []
	let dropSchemaStatements = []
	let resourceNames: string[] = []
	while (resourceNames.length !== (resourceNames = Object.keys(schemaDependencyMap)).length && resourceNames.length > 0) {
		for(const resourceName of resourceNames) {
			const schemaInfo = schemaDependencyMap[resourceName]
			let unsolvedDependency = false
			for (const dependency of schemaInfo.depends) {
				// Self-dependencies are ok.
				if (dependency !== resourceName && schemaDependencyMap.hasOwnProperty(dependency)) {
					unsolvedDependency = true
					break
				}
			}
			if (unsolvedDependency === false) {
				if (schemaInfo.primitive === false || hasDependants[resourceName] != null) {
					if (schemaInfo.primitive !== false) {
						console.warn("We're adding a primitive table??", schemaInfo.resourceName)
					}
					createSchemaStatements.push(schemaInfo.createSQL)
					dropSchemaStatements.push(schemaInfo.dropSQL)
				}
				delete schemaDependencyMap[resourceName]
			}
		}
	}
	if (_.size(schemaDependencyMap) > 0) {
		console.error('Failed to resolve all schema dependencies', schemaDependencyMap)
		throw new Error('Failed to resolve all schema dependencies')
	}
	dropSchemaStatements = dropSchemaStatements.reverse()

	let ruleStatements: SqlRule[]
	ruleStatements = _.map(abstractSqlModel.rules, (rule): SqlRule => {
		let ruleBody = _.find(rule, { 0: 'Body' } as Partial<AbstractSqlQuery>)
		if (ruleBody == null || _.isString(ruleBody)) {
			throw new Error('Invalid rule')
		}
		ruleBody = ruleBody[1]
		if (_.isString(ruleBody)) {
			throw new Error('Invalid rule')
		}
		let ruleSE = _.find(rule, { 0: 'StructuredEnglish' } as Partial<AbstractSqlQuery>)
		if (ruleSE == null) {
			throw new Error('Invalid structured English')
		}
		ruleSE = ruleSE[1]
		if (!_.isString(ruleSE)) {
			throw new Error('Invalid structured English')
		}
		const { query: ruleSQL, bindings: ruleBindings } = compileRule(ruleBody, engine) as SqlResult
		let referencedFields: ReferencedFields | undefined
		try {
			referencedFields = getReferencedFields(ruleBody)
		} catch (e) {
			console.warn('Error fetching referenced fields', e)
		}

		return {
			structuredEnglish: ruleSE,
			sql: ruleSQL,
			bindings: ruleBindings,
			referencedFields,
		}
	})

	return {
		synonyms: abstractSqlModel.synonyms,
		relationships: abstractSqlModel.relationships,
		tables: abstractSqlModel.tables,
		createSchema: createSchemaStatements,
		dropSchema: dropSchemaStatements,
		rules: ruleStatements,
	}
}

const generateSplit = <T>(src:Array<T>, dst: Array<T>, matchFn: MatchFn<T>): Split<T> => {
	const modified: Array<Pair<T>> = []
	return _.reduce(src, (acc, value) => {
		const match = matchFn(acc.inserted, value)
		if (match == null) {
			return acc
		} else {
			acc.inserted = _.without(acc.inserted, match)
			acc.deleted = _.without(acc.deleted, value)
			acc.modified.push( { src: value, dst: match } )
			return acc
		}
	}
	, { inserted: dst, deleted: src, modified: modified } )
}
//  genDiff expects src and dst arrays formatted as described in
//  genSplit, and three functions to be called in the case of
//  insertion, deletion or modification.
//  The match function describes how to find the corresponding T inside a T[].
//  The result of the match function will be either the element that should be matched to
//  the argument or undefined if no such element is found.
const generateDiff = <T>(insFn: ToSQLFn<T>, delFn: ToSQLFn<T>, modFn: ToSQLFn<Pair<T>>, matchFn: MatchFn<T>, src: Array<T>, dst: Array<T>) => {
	const split = generateSplit(src, dst, matchFn)

	const diff = _.map(split.modified, modFn)
	.concat(_.map(split.deleted, delFn))
	.concat(_.map(split.inserted, insFn))

	return _.reject(diff, _.isNil)
}

const diffFields = (src: AbstractSqlField[], dst: AbstractSqlField[], mappings: ResourceMap<string>, engine: Engines, ifNotExists: boolean) => {
	let ifNotExistsStr: string
	let ifExistsStr: string

	if (ifNotExists) {
		ifNotExistsStr = 'IF NOT EXISTS '
		ifExistsStr = 'IF EXISTS '
	} else {
		ifNotExistsStr = ''
		ifExistsStr = ''
	}

	const matchFn: MatchFn<AbstractSqlField> = (fieldArray, field) => {
		const match = _.find(fieldArray, { fieldName: field.fieldName })
		if (match != null) {
			return match
		}
		else {
			if (_.isString(mappings[field.fieldName])) {
				return _.find(fieldArray, { fieldName: mappings[field.fieldName] } )
			}
		}
	}

	const insFn: ToSQLFn<AbstractSqlField> = (field) => {
		return 'ADD COLUMN ' + ifNotExistsStr + '"' + field.fieldName + '" ' + dataTypeGen(engine, field) + ';'
	}

	const delFn: ToSQLFn<AbstractSqlField> = (field) => {
		return 'DROP COLUMN ' + ifExistsStr + '"' + field.fieldName + '";'
	}

	const modFn: ToSQLFn<Pair<AbstractSqlField>> = ({src, dst}) => {
		if (_.isEqual(src, dst)) {
			return
		}
		if (_.isEqual(_.omit(src, ['fieldName', 'references']), _.omit(dst, ['fieldName', 'references']))) {
			return 'RENAME COLUMN "' + src.fieldName + '" TO "' + dst.fieldName + '";'
		}
		throw Error(`Can not migrate pre-existing field ${src.fieldName} of type ${src.dataType} to ${dst.fieldName} of type ${dst.dataType}`)
	}

	return generateDiff(insFn, delFn, modFn, matchFn, src, dst)
}

const diffSchemas = (src: AbstractSqlModel, dst: AbstractSqlModel, engine: Engines, ifNotExists: boolean) => {
	const srcSDM = mkSchemaDependencyMap(src.tables, engine, ifNotExists).schemaDependencyMap
	const dstSDM = mkSchemaDependencyMap(dst.tables, engine, ifNotExists).schemaDependencyMap

	const matchFn:MatchFn<AbstractSqlTable> = (tables, srcTable) => {
		const match = _.find(tables, { name: srcTable.name })
		if (match != null) {
			return match
		} else {
			const relations = src.relationships[srcTable.name]
			if (relations == null) {
				return
			} else {
				return _.find(tables, (dstTable) => {
					const verb = dstTable.name.split('-').slice(1, -1).join(' ')
					return relations[verb] != null
				})
			}

		}
	}

	const insFn: ToSQLFn<AbstractSqlTable> = (table) => {
		if (!_.isString(table) && !table.primitive) {
			return dstSDM[table.name].createSQL
		}
	}

	const delFn: ToSQLFn<AbstractSqlTable> = (table) => {
		if (!_.isString(table) && !table.primitive) {
			return srcSDM[table.name].dropSQL
		}
	}

	const modFn: ToSQLFn<Pair<AbstractSqlTable>> = ({ src: srcTbl, dst: dstTbl }) => {
		if (_.isEqual(srcTbl, dstTbl)) {
			return
		} else if (_.isEqual(_.omit(srcTbl, 'fields'), _.omit(dstTbl, 'fields'))) {
			const fields = diffFields(srcTbl.fields, dstTbl.fields, _.invert(src.synonyms), engine, ifNotExists)
			const alterTbl = 'ALTER TABLE "' + srcTbl.name + '"\n\t'
			return _.map(fields, (field) => alterTbl + field).join('\n')
		} else {
			const [srcResource, srcRest] = extractMappings(srcTbl.name)
			const [dstResource, dstRest] = extractMappings(dstTbl.name)

			const mappings = {
				[srcResource]: dstRest,
				[srcRest]: dstResource
			}
			const fields = diffFields(srcTbl.fields, dstTbl.fields, mappings, engine, ifNotExists)
			const renameTable = `ALTER TABLE "${srcTbl.name}"\n\tRENAME TO "${dstTbl.name}";`
			const alterTbl = 'ALTER TABLE "' + dstTbl.name + '"\n\t'
			return _.concat(renameTable, _.map(fields, (field) => alterTbl + field)).join('\n')
		}
	}

	return generateDiff(insFn, delFn, modFn, matchFn, _.values(src.tables), _.values(dst.tables))
}

const extractMappings = (resource:string):[string, string] => {
	const [ subject, ...rest ] = resource.split('-')
	return [ subject, rest.join('-') ]
}
const generateExport = (engine: Engines, ifNotExists: boolean) => {
	return {
		compileSchema: _.partial(compileSchema, _, engine, ifNotExists),
		compileRule: _.partial(compileRule, _, engine),
		diffSchemas: _.partial(diffSchemas, _, _, engine, ifNotExists),
		dataTypeValidate,
		getReferencedFields,
		getModifiedFields,
	}
}
export const postgres = generateExport(Engines.postgres, true)
export const mysql = generateExport(Engines.mysql, true)
export const websql = generateExport(Engines.websql, false)
