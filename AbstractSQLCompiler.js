// Generated by CoffeeScript 1.10.0
(function() {
  var hasProp = {}.hasOwnProperty;

  (function(root, factory) {
    if (typeof define === 'function' && define.amd) {
      return define(['@resin/abstract-sql-compiler/AbstractSQLOptimiser', '@resin/abstract-sql-compiler/AbstractSQLRules2SQL', '@resin/sbvr-types', 'lodash', 'bluebird'], factory);
    } else if (typeof exports === 'object') {
      return module.exports = factory(require('./AbstractSQLOptimiser'), require('./AbstractSQLRules2SQL'), require('@resin/sbvr-types'), require('lodash'), require('bluebird'));
    } else {
      return root.AbstractSQLCompiler = factory(root.AbstractSQLOptimiser, root.AbstractSQLRules2SQL, root.sbvrTypes, root._, root.Promise);
    }
  })(this, function(arg, arg1, sbvrTypes, _, Promise) {
    var AbstractSQLOptimiser, AbstractSQLRules2SQL, compileRule, compileSchema, dataTypeGen, dataTypeValidate, validateTypes;
    AbstractSQLOptimiser = arg.AbstractSQLOptimiser;
    AbstractSQLRules2SQL = arg1.AbstractSQLRules2SQL;
    validateTypes = _.mapValues(sbvrTypes, function(arg2) {
      var validate;
      validate = arg2.validate;
      if (validate != null) {
        return Promise.promisify(validate);
      }
    });
    dataTypeValidate = function(value, field, callback) {
      var dataType, required;
      dataType = field.dataType, required = field.required;
      if (value === null) {
        if (required) {
          return Promise.rejected('cannot be null');
        } else {
          return Promise.fulfilled(null);
        }
      } else if (validateTypes[dataType] != null) {
        return validateTypes[dataType](value, required);
      } else {
        return Promise.rejected('is an unsupported type: ' + dataType);
      }
    };
    dataTypeGen = function(engine, dataType, necessity, index, defaultValue) {
      var dbType, ref, ref1;
      if (index == null) {
        index = '';
      }
      necessity = necessity ? ' NOT NULL' : ' NULL';
      defaultValue = defaultValue ? " DEFAULT " + defaultValue : void 0;
      if (index !== '') {
        index = ' ' + index;
      }
      dbType = (ref = sbvrTypes[dataType]) != null ? (ref1 = ref.types) != null ? ref1[engine] : void 0 : void 0;
      if (dbType != null) {
        if (_.isFunction(dbType)) {
          return dbType(necessity, index);
        }
        if (defaultValue == null) {
          defaultValue = '';
        }
        return dbType + defaultValue + necessity + index;
      } else {
        throw "Unknown data type '" + dataType + "' for engine: " + engine;
      }
    };
    compileRule = (function() {
      var compiler, optimiser;
      optimiser = AbstractSQLOptimiser.createInstance();
      compiler = AbstractSQLRules2SQL.createInstance();
      return function(abstractSQL, engine) {
        abstractSQL = optimiser.match(abstractSQL, 'Process');
        compiler.engine = engine;
        return compiler.match(abstractSQL, 'Process');
      };
    })();
    compileSchema = function(sqlModel, engine, ifNotExists) {
      var createSQL, createSchemaStatements, dataType, defaultValue, dependency, depends, dropSQL, dropSchemaStatements, e, error, fieldName, foreignKey, foreignKeys, hasDependants, i, index, j, k, l, len, len1, len2, len3, len4, len5, m, n, ref, ref1, ref2, ref3, ref4, ref5, references, required, resourceName, rule, ruleBody, ruleSE, ruleSQL, ruleStatements, schemaDependencyMap, schemaInfo, table, tableName, tableNames, unsolvedDependency;
      ifNotExists = ifNotExists ? 'IF NOT EXISTS ' : '';
      hasDependants = {};
      schemaDependencyMap = {};
      ref = sqlModel.tables;
      for (resourceName in ref) {
        if (!hasProp.call(ref, resourceName)) continue;
        table = ref[resourceName];
        if (!(!_.isString(table))) {
          continue;
        }
        foreignKeys = [];
        depends = [];
        dropSQL = 'DROP TABLE "' + table.name + '";';
        createSQL = 'CREATE TABLE ' + ifNotExists + '"' + table.name + '" (\n\t';
        ref1 = table.fields;
        for (i = 0, len = ref1.length; i < len; i++) {
          ref2 = ref1[i], dataType = ref2.dataType, fieldName = ref2.fieldName, required = ref2.required, index = ref2.index, references = ref2.references, defaultValue = ref2.defaultValue;
          createSQL += '"' + fieldName + '" ' + dataTypeGen(engine, dataType, required, index, defaultValue) + '\n,\t';
          if (dataType === 'ForeignKey' || dataType === 'ConceptType') {
            foreignKeys.push({
              fieldName: fieldName,
              references: references
            });
            depends.push(references.tableName);
            hasDependants[references.tableName] = true;
          }
        }
        for (j = 0, len1 = foreignKeys.length; j < len1; j++) {
          foreignKey = foreignKeys[j];
          createSQL += 'FOREIGN KEY ("' + foreignKey.fieldName + '") REFERENCES "' + foreignKey.references.tableName + '" ("' + foreignKey.references.fieldName + '")' + '\n,\t';
        }
        ref3 = table.indexes;
        for (k = 0, len2 = ref3.length; k < len2; k++) {
          index = ref3[k];
          createSQL += index.type + '("' + index.fields.join('", "') + '")\n,\t';
        }
        createSQL = createSQL.slice(0, -2) + ');';
        schemaDependencyMap[table.name] = {
          resourceName: resourceName,
          primitive: table.primitive,
          createSQL: createSQL,
          dropSQL: dropSQL,
          depends: depends
        };
      }
      createSchemaStatements = [];
      dropSchemaStatements = [];
      tableNames = [];
      while (tableNames.length !== (tableNames = Object.keys(schemaDependencyMap)).length && tableNames.length > 0) {
        for (l = 0, len3 = tableNames.length; l < len3; l++) {
          tableName = tableNames[l];
          schemaInfo = schemaDependencyMap[tableName];
          unsolvedDependency = false;
          ref4 = schemaInfo.depends;
          for (m = 0, len4 = ref4.length; m < len4; m++) {
            dependency = ref4[m];
            if (dependency !== schemaInfo.resourceName) {
              if (schemaDependencyMap.hasOwnProperty(dependency)) {
                unsolvedDependency = true;
                break;
              }
            }
          }
          if (unsolvedDependency === false) {
            if (sqlModel.tables[schemaInfo.resourceName].exists = schemaInfo.primitive === false || (hasDependants[tableName] != null)) {
              if (schemaInfo.primitive !== false) {
                console.warn("We're adding a primitive table??", schemaInfo.resourceName);
              }
              createSchemaStatements.push(schemaInfo.createSQL);
              dropSchemaStatements.push(schemaInfo.dropSQL);
            }
            delete schemaDependencyMap[tableName];
          }
        }
      }
      if (schemaDependencyMap.length > 0) {
        console.error('Failed to resolve all schema dependencies', schemaDependencyMap);
        throw 'Failed to resolve all schema dependencies';
      }
      dropSchemaStatements = dropSchemaStatements.reverse();
      ruleStatements = [];
      try {
        ref5 = sqlModel.rules;
        for (n = 0, len5 = ref5.length; n < len5; n++) {
          rule = ref5[n];
          ruleBody = _.find(rule, {
            0: 'Body'
          })[1];
          ruleSE = _.find(rule, {
            0: 'StructuredEnglish'
          })[1];
          ruleSQL = compileRule(ruleBody, engine);
          ruleStatements.push({
            structuredEnglish: ruleSE,
            sql: ruleSQL
          });
        }
      } catch (error) {
        e = error;
        console.error('Failed to compile the rule', JSON.stringify(rule, null, '\t'));
        console.error(e, e.stack);
        throw e;
      }
      return {
        tables: sqlModel.tables,
        createSchema: createSchemaStatements,
        dropSchema: dropSchemaStatements,
        rules: ruleStatements
      };
    };
    return module.exports = _.mapValues({
      postgres: true,
      mysql: true,
      websql: false
    }, function(ifNotExists, engine) {
      return {
        compileSchema: _.partial(compileSchema, _, engine, ifNotExists),
        compileRule: _.partial(compileRule, _, engine),
        dataTypeValidate: dataTypeValidate
      };
    });
  });

}).call(this);
