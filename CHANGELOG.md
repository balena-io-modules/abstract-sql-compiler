v2.3.1

* Fixed added referenced fields to rules

v2.3.0

* Add `getReferencedFields` and `getModifiedFields` functions.
* Add `referencedFields` info to compiled rules.
* Update coffeescript to ~1.12.6

v2.2.0

* Added support for numbered binds.
* Added a test for a self-referential expand (`pilot?$expand=pilot`)

v2.1.0

* Added a test for a rule with numbered terms.
* Added some tests from the sbvr-parser that were missing here.
* Added a non-primitive concept type test to the pilots tests.
* Added support for $count
* Added tests for $count
* Updated the client model for tests
* Updated tests

v2.0.0

* Stopped treating an empty string as null.

v1.2.0

* Added support for duration literals.
* Added support for `Contains`, `Now`, `Year`, `Month`, `Day`, `Hour`, `Minute`, `Second`, `FractionalSeconds`, `ToDate`, `ToTime`, and `TotalSeconds`.
* Avoided issues with wildchard characters in `Substringof`, `StartsWith`, and `EndsWith`.
* Fixed `InStr` and `IndexOf`.
* Updated the sbvr model for tests.

v1.1.0

* `AggregateJSON` now returns an empty array instead of null in the case of zero results.
* Updated to lodash 4

v1.0.2

* Update ometa-js

v1.0.1

* Correctly adjust INSTR/STRPOS, INSTR is the zero-indexed one!
* Change startswith and endswith from `(needle, haystack)` to `(haystack, needle)`, to match the OData spec.
* Updated to bluebird 3.

v0.4.2

* Update @resin/odata-to-abstract-sql to ~0.3.0, adding matching tests.

v0.4.1

* Fixed requirejs import path.

v0.4.0

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

v0.2.0

* Switch to using bind vars for embedded number/text values.
* Switched to using multiple part UPSERT queries, allowing greater flexibility.
* Simplified NULL handling.

v0.1.1

* Added support for CAST.

v0.1.0

* Added support for select queries in the values clause.
