import { Engines, AbstractSqlQuery } from './AbstractSQLCompiler'

export type Binding = [ string, any ] | [ 'Bind', number | any[] ]
export interface SqlResult {
	query: string
	bindings: Binding[]
}
export var AbstractSQLRules2SQL: {
	createInstance: () => {
		engine: Engines
		match: (abstractSQL: AbstractSqlQuery, rule: 'Process', args: (null | string)[]) => SqlResult | SqlResult[]
	}
}
