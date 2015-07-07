* Added support for specifying a `defaultValue` for a field.
* Added schema generation support.
* Changed the exported `compile(engine, abstractSQL)` function to `[engine].compileRule(abstractsql)`

v0.3.2

* Fixed an issue with auto incrementing fields of websql/mysql.

v0.3.1

* Updated lodash to ^3.0.0
* Updated sbvr-types to v0.1.1

v0.3.0

* Updated sbvr-types to v0.1.0
* Updated lodash to ~3.0.0

v0.2.1

* Optimised not exists statements.
* Added tests for true/false.
* Added support for `'Null'` as well as `null` for null valus.
* Changed comparisons against null to use `IS NULL`/`IS NOT NULL`
