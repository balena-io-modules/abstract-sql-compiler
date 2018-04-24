"use strict";
exports.__esModule = true;
var AbstractSQLOptimiser_1 = require("./AbstractSQLOptimiser");
var AbstractSQLRules2SQL_1 = require("./AbstractSQLRules2SQL");
var sbvrTypes = require('@resin/sbvr-types');
var _ = require("lodash");
var Promise = require("bluebird");
var Engines;
(function (Engines) {
    Engines["postgres"] = "postgres";
    Engines["mysql"] = "mysql";
    Engines["websql"] = "websql";
})(Engines = exports.Engines || (exports.Engines = {}));
var validateTypes = _.mapValues(sbvrTypes, function (_a) {
    var validate = _a.validate;
    if (validate != null) {
        return Promise.promisify(validate);
    }
});
var dataTypeValidate = function (value, field) {
    var dataType = field.dataType, required = field.required;
    if (value == null) {
        if (required) {
            return Promise.reject('cannot be null');
        }
        else {
            return Promise.resolve(null);
        }
    }
    else {
        var validateFn = validateTypes[dataType];
        if (validateFn != null) {
            return validateFn(value, required);
        }
        else {
            return Promise.reject('is an unsupported type: ' + dataType);
        }
    }
};
var dataTypeGen = function (engine, _a) {
    var dataType = _a.dataType, required = _a.required, index = _a.index, defaultValue = _a.defaultValue;
    var requiredStr;
    if (required) {
        requiredStr = ' NOT NULL';
    }
    else {
        requiredStr = ' NULL';
    }
    if (defaultValue != null) {
        defaultValue = " DEFAULT " + defaultValue;
    }
    else {
        defaultValue = '';
    }
    if (index == null) {
        index = '';
    }
    else if (index !== '') {
        index = ' ' + index;
    }
    var dbType = _.get(sbvrTypes, [dataType, 'types', engine]);
    if (dbType != null) {
        if (_.isFunction(dbType)) {
            return dbType(requiredStr, index);
        }
        return dbType + defaultValue + requiredStr + index;
    }
    else {
        throw new Error("Unknown data type '" + dataType + "' for engine: " + engine);
    }
};
var getReferencedFields = function (ruleBody) {
    var tableAliases = {};
    var referencedFields = {};
    var recurse = function (rulePart) {
        _.each(rulePart, function (part) {
            if (_.isArray(part)) {
                if (part[0] === 'ReferencedField') {
                    var tableName = part[1], fieldName = part[2];
                    if (!_.isString(tableName) || !_.isString(fieldName)) {
                        throw new Error('Invalid ReferencedField');
                    }
                    if (referencedFields[tableName] == null) {
                        referencedFields[tableName] = [];
                    }
                    referencedFields[tableName].push(fieldName);
                    return;
                }
                if (part[0] === 'Field') {
                    throw new Error('Cannot find queried fields for unreferenced fields');
                }
                if (part[0] === 'From') {
                    var nested = part[1];
                    if (_.isArray(nested)) {
                        var table = nested[0], alias = nested[1];
                        if (!_.isString(table) || !_.isString(alias)) {
                            throw new Error('Cannot handle aliased select queries');
                        }
                        tableAliases[alias] = table;
                    }
                }
                recurse(part);
            }
        });
    };
    recurse(ruleBody);
    for (var alias in tableAliases) {
        var table = tableAliases[alias];
        var tableFields = referencedFields[table] || [];
        var aliasFields = referencedFields[alias] || [];
        referencedFields[table] = tableFields.concat(aliasFields);
    }
    return referencedFields;
};
var checkQuery = function (query) {
    var queryType = query[0];
    if (!_.includes(['InsertQuery', 'UpdateQuery', 'DeleteQuery'], queryType)) {
        return;
    }
    var froms = _.filter(query, { 0: 'From' });
    if (froms.length !== 1) {
        return;
    }
    var table = froms[0][1];
    if (!_.isString(table)) {
        return;
    }
    if (queryType in ['InsertQuery', 'DeleteQuery']) {
        return { table: table };
    }
    var fields = _(query)
        .filter({ 0: 'Fields' })
        .flatMap('1')
        .value();
    return { table: table, fields: fields };
};
var getModifiedFields = function (abstractSqlQuery) {
    if (_.isArray(abstractSqlQuery[0])) {
        return _.map(abstractSqlQuery, checkQuery);
    }
    else {
        return checkQuery(abstractSqlQuery);
    }
};
var optimiser = AbstractSQLOptimiser_1.AbstractSQLOptimiser.createInstance();
var compiler = AbstractSQLRules2SQL_1.AbstractSQLRules2SQL.createInstance();
var compileRule = function (abstractSQL, engine) {
    abstractSQL = optimiser.match(abstractSQL, 'Process');
    compiler.engine = engine;
    return compiler.match(abstractSQL, 'Process');
};
var compileSchema = function (abstractSqlModel, engine, ifNotExists) {
    var ifNotExistsStr;
    if (ifNotExists) {
        ifNotExistsStr = 'IF NOT EXISTS ';
    }
    else {
        ifNotExistsStr = '';
    }
    var hasDependants = {};
    var schemaDependencyMap = {};
    _.forOwn(abstractSqlModel.tables, function (table, resourceName) {
        if (_.isString(table)) {
            return;
        }
        var foreignKeys = [];
        var depends = [];
        var dropSQL = "DROP TABLE \"" + table.name + "\";";
        var createSQL = "CREATE TABLE " + ifNotExistsStr + "\"" + table.name + "\" (\n\t";
        for (var _i = 0, _a = table.fields; _i < _a.length; _i++) {
            var field = _a[_i];
            var fieldName = field.fieldName, references = field.references, dataType = field.dataType;
            createSQL += '"' + fieldName + '" ' + dataTypeGen(engine, field) + '\n,\t';
            if (_.includes(['ForeignKey', 'ConceptType'], dataType) && references != null) {
                foreignKeys.push({ fieldName: fieldName, references: references });
                depends.push(references.resourceName);
                hasDependants[references.resourceName] = true;
            }
        }
        for (var _b = 0, foreignKeys_1 = foreignKeys; _b < foreignKeys_1.length; _b++) {
            var _c = foreignKeys_1[_b], fieldName = _c.fieldName, references = _c.references;
            var referencedTable = abstractSqlModel.tables[references.resourceName];
            createSQL += "FOREIGN KEY (\"" + fieldName + "\") REFERENCES \"" + referencedTable.name + "\" (\"" + references.fieldName + "\")\n,\t";
        }
        for (var _d = 0, _e = table.indexes; _d < _e.length; _d++) {
            var index = _e[_d];
            createSQL += index.type + '("' + index.fields.join('", "') + '")\n,\t';
        }
        createSQL = createSQL.slice(0, -2) + ');';
        schemaDependencyMap[table.resourceName] = {
            resourceName: resourceName,
            primitive: table.primitive,
            createSQL: createSQL,
            dropSQL: dropSQL,
            depends: depends
        };
    });
    var createSchemaStatements = [];
    var dropSchemaStatements = [];
    var resourceNames = [];
    while (resourceNames.length !== (resourceNames = Object.keys(schemaDependencyMap)).length && resourceNames.length > 0) {
        for (var _i = 0, resourceNames_1 = resourceNames; _i < resourceNames_1.length; _i++) {
            var resourceName = resourceNames_1[_i];
            var schemaInfo = schemaDependencyMap[resourceName];
            var unsolvedDependency = false;
            for (var _a = 0, _b = schemaInfo.depends; _a < _b.length; _a++) {
                var dependency = _b[_a];
                if (dependency !== resourceName && schemaDependencyMap.hasOwnProperty(dependency)) {
                    unsolvedDependency = true;
                    break;
                }
            }
            if (unsolvedDependency === false) {
                if (schemaInfo.primitive === false || hasDependants[resourceName] != null) {
                    if (schemaInfo.primitive !== false) {
                        console.warn("We're adding a primitive table??", schemaInfo.resourceName);
                    }
                    createSchemaStatements.push(schemaInfo.createSQL);
                    dropSchemaStatements.push(schemaInfo.dropSQL);
                }
                delete schemaDependencyMap[resourceName];
            }
        }
    }
    if (_.size(schemaDependencyMap) > 0) {
        console.error('Failed to resolve all schema dependencies', schemaDependencyMap);
        throw new Error('Failed to resolve all schema dependencies');
    }
    dropSchemaStatements = dropSchemaStatements.reverse();
    var ruleStatements;
    ruleStatements = _.map(abstractSqlModel.rules, function (rule) {
        var ruleBody = _.find(rule, { 0: 'Body' });
        if (ruleBody == null || _.isString(ruleBody)) {
            throw new Error('Invalid rule');
        }
        ruleBody = ruleBody[1];
        if (_.isString(ruleBody)) {
            throw new Error('Invalid rule');
        }
        var ruleSE = _.find(rule, { 0: 'StructuredEnglish' });
        if (ruleSE == null) {
            throw new Error('Invalid structured English');
        }
        ruleSE = ruleSE[1];
        if (!_.isString(ruleSE)) {
            throw new Error('Invalid structured English');
        }
        var _a = compileRule(ruleBody, engine), ruleSQL = _a.query, ruleBindings = _a.bindings;
        var referencedFields;
        try {
            referencedFields = getReferencedFields(ruleBody);
        }
        catch (e) {
            console.warn('Error fetching referenced fields', e);
        }
        return {
            structuredEnglish: ruleSE,
            sql: ruleSQL,
            bindings: ruleBindings,
            referencedFields: referencedFields
        };
    });
    return {
        synonyms: abstractSqlModel.synonyms,
        relationships: abstractSqlModel.relationships,
        tables: abstractSqlModel.tables,
        createSchema: createSchemaStatements,
        dropSchema: dropSchemaStatements,
        rules: ruleStatements
    };
};
var generateExport = function (engine, ifNotExists) {
    return {
        compileSchema: _.partial(compileSchema, _, engine, ifNotExists),
        compileRule: _.partial(compileRule, _, engine),
        dataTypeValidate: dataTypeValidate,
        getReferencedFields: getReferencedFields,
        getModifiedFields: getModifiedFields
    };
};
exports.postgres = generateExport(Engines.postgres, true);
exports.mysql = generateExport(Engines.mysql, true);
exports.websql = generateExport(Engines.websql, false);
//# sourceMappingURL=AbstractSQLCompiler.js.map