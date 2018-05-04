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
var mkSchemaDependencyMap = function (tables, engine, ifNotExists) {
    var ifNotExistsStr;
    if (ifNotExists) {
        ifNotExistsStr = 'IF NOT EXISTS ';
    }
    else {
        ifNotExistsStr = '';
    }
    var hasDependants = {};
    var schemaDependencyMap = {};
    _.forOwn(tables, function (table, resourceName) {
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
            var referencedTable = tables[references.resourceName];
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
    return { hasDependants: hasDependants, schemaDependencyMap: schemaDependencyMap };
};
var compileSchema = function (abstractSqlModel, engine, ifNotExists) {
    var _a = mkSchemaDependencyMap(abstractSqlModel.tables, engine, ifNotExists), hasDependants = _a.hasDependants, schemaDependencyMap = _a.schemaDependencyMap;
    var createSchemaStatements = [];
    var dropSchemaStatements = [];
    var resourceNames = [];
    while (resourceNames.length !== (resourceNames = Object.keys(schemaDependencyMap)).length && resourceNames.length > 0) {
        for (var _i = 0, resourceNames_1 = resourceNames; _i < resourceNames_1.length; _i++) {
            var resourceName = resourceNames_1[_i];
            var schemaInfo = schemaDependencyMap[resourceName];
            var unsolvedDependency = false;
            for (var _b = 0, _c = schemaInfo.depends; _b < _c.length; _b++) {
                var dependency = _c[_b];
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
var generateSplit = function (src, dst, matchFn) {
    var modified = [];
    return _.reduce(src, function (acc, value) {
        var match = matchFn(acc.inserted, value);
        if (match == null) {
            return acc;
        }
        else {
            acc.inserted = _.without(acc.inserted, match);
            acc.deleted = _.without(acc.deleted, value);
            acc.modified.push({ src: value, dst: match });
            return acc;
        }
    }, { inserted: dst, deleted: src, modified: modified });
};
var generateDiff = function (insFn, delFn, modFn, matchFn, src, dst) {
    var split = generateSplit(src, dst, matchFn);
    var diff = _.map(split.modified, modFn)
        .concat(_.map(split.deleted, delFn))
        .concat(_.map(split.inserted, insFn));
    return _.reject(diff, _.isNil);
};
var diffFields = function (src, dst, mappings, engine, ifNotExists) {
    var ifNotExistsStr;
    var ifExistsStr;
    if (ifNotExists) {
        ifNotExistsStr = 'IF NOT EXISTS ';
        ifExistsStr = 'IF EXISTS ';
    }
    else {
        ifNotExistsStr = '';
        ifExistsStr = '';
    }
    var matchFn = function (fieldArray, field) {
        var match = _.find(fieldArray, { fieldName: field.fieldName });
        if (match != null) {
            return match;
        }
        else {
            if (_.isString(mappings[field.fieldName])) {
                return _.find(fieldArray, { fieldName: mappings[field.fieldName] });
            }
        }
    };
    var insFn = function (field) {
        return 'ADD COLUMN ' + ifNotExistsStr + '"' + field.fieldName + '" ' + dataTypeGen(engine, field) + ';';
    };
    var delFn = function (field) {
        return 'DROP COLUMN ' + ifExistsStr + '"' + field.fieldName + '";';
    };
    var modFn = function (_a) {
        var src = _a.src, dst = _a.dst;
        if (_.isEqual(src, dst)) {
            return;
        }
        if (_.isEqual(_.omit(src, ['fieldName', 'references']), _.omit(dst, ['fieldName', 'references']))) {
            return 'RENAME COLUMN "' + src.fieldName + '" TO "' + dst.fieldName + '";';
        }
        throw Error("Can not migrate pre-existing field " + src.fieldName + " of type " + src.dataType + " to " + dst.fieldName + " of type " + dst.dataType);
    };
    return generateDiff(insFn, delFn, modFn, matchFn, src, dst);
};
var diffSchemas = function (src, dst, engine, ifNotExists) {
    var srcSDM = mkSchemaDependencyMap(src.tables, engine, ifNotExists).schemaDependencyMap;
    var dstSDM = mkSchemaDependencyMap(dst.tables, engine, ifNotExists).schemaDependencyMap;
    var matchFn = function (tables, srcTable) {
        var match = _.find(tables, { name: srcTable.name });
        if (match != null) {
            return match;
        }
        else {
            var relations_1 = src.relationships[srcTable.name];
            if (relations_1 == null) {
                return;
            }
            else {
                return _.find(tables, function (dstTable) {
                    var verb = dstTable.name.split('-').slice(1, -1).join(' ');
                    return relations_1[verb] != null;
                });
            }
        }
    };
    var insFn = function (table) {
        if (!_.isString(table) && !table.primitive) {
            return dstSDM[table.name].createSQL;
        }
    };
    var delFn = function (table) {
        if (!_.isString(table) && !table.primitive) {
            return srcSDM[table.name].dropSQL;
        }
    };
    var modFn = function (_a) {
        var srcTbl = _a.src, dstTbl = _a.dst;
        if (_.isEqual(srcTbl, dstTbl)) {
            return;
        }
        else if (_.isEqual(_.omit(srcTbl, 'fields'), _.omit(dstTbl, 'fields'))) {
            var fields = diffFields(srcTbl.fields, dstTbl.fields, _.invert(src.synonyms), engine, ifNotExists);
            var alterTbl_1 = 'ALTER TABLE "' + srcTbl.name + '"\n\t';
            return _.map(fields, function (field) { return alterTbl_1 + field; }).join('\n');
        }
        else {
            var _b = extractMappings(srcTbl.name), srcResource = _b[0], srcRest = _b[1];
            var _c = extractMappings(dstTbl.name), dstResource = _c[0], dstRest = _c[1];
            var mappings = (_d = {},
                _d[srcResource] = dstRest,
                _d[srcRest] = dstResource,
                _d);
            var fields = diffFields(srcTbl.fields, dstTbl.fields, mappings, engine, ifNotExists);
            var renameTable = "ALTER TABLE \"" + srcTbl.name + "\"\n\tRENAME TO \"" + dstTbl.name + "\";";
            var alterTbl_2 = 'ALTER TABLE "' + dstTbl.name + '"\n\t';
            return _.concat(renameTable, _.map(fields, function (field) { return alterTbl_2 + field; })).join('\n');
        }
        var _d;
    };
    return generateDiff(insFn, delFn, modFn, matchFn, _.values(src.tables), _.values(dst.tables));
};
var extractMappings = function (resource) {
    var _a = resource.split('-'), subject = _a[0], rest = _a.slice(1);
    return [subject, rest.join('-')];
};
var generateExport = function (engine, ifNotExists) {
    return {
        compileSchema: _.partial(compileSchema, _, engine, ifNotExists),
        compileRule: _.partial(compileRule, _, engine),
        diffSchemas: _.partial(diffSchemas, _, _, engine, ifNotExists),
        dataTypeValidate: dataTypeValidate,
        getReferencedFields: getReferencedFields,
        getModifiedFields: getModifiedFields
    };
};
exports.postgres = generateExport(Engines.postgres, true);
exports.mysql = generateExport(Engines.mysql, true);
exports.websql = generateExport(Engines.websql, false);
//# sourceMappingURL=AbstractSQLCompiler.js.map