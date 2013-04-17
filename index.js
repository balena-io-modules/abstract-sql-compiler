(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['abstract-sql-compiler/../AbstractSQLOptimiser', 'abstract-sql-compiler/../AbstractSQLRules2SQL'], factory);
	} else if (typeof exports === 'object') {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like enviroments that support module.exports,
		// like Node.
		module.exports = factory(
			require('./AbstractSQLOptimiser'),
			require('./AbstractSQLRules2SQL')
		);
	} else {
		// Browser globals
		root.AbstractSQLCompiler = factory(AbstractSQLOptimiser, AbstractSQLRules2SQL);
	}
}(this, function (AbstractSQLOptimiser, AbstractSQLRules2SQL) {
	AbstractSQLOptimiser = AbstractSQLOptimiser.AbstractSQLOptimiser;
	AbstractSQLRules2SQL = AbstractSQLRules2SQL.AbstractSQLRules2SQL;
	return {
		AbstractSQLOptimiser: AbstractSQLOptimiser,
		AbstractSQLRules2SQL: AbstractSQLRules2SQL,
		compile: (function() {
			var optimiser = AbstractSQLOptimiser.createInstance(),
				compiler = AbstractSQLRules2SQL.createInstance();
			return function(engine, abstractSQL) {
				abstractSQL = optimiser.match(abstractSQL, 'Process');
				compiler.engine = engine;
				return compiler.match(abstractSQL, 'Process');
			};
		})()
	}
}));