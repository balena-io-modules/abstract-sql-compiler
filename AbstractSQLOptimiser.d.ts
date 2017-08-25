import { AbstractSqlQuery } from './AbstractSQLCompiler'

export var AbstractSQLOptimiser: {
	createInstance: () => {
		match: (abstractSQL: AbstractSqlQuery, rule: 'Process') => AbstractSqlQuery
	}
}
