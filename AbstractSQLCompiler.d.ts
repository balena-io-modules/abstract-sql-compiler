/// <reference types="lodash" />
import { Binding, SqlResult } from './AbstractSQLRules2SQL';
export { Binding, SqlResult } from './AbstractSQLRules2SQL';
import * as _ from 'lodash';
export interface AbstractSqlField {
    fieldName: string;
    dataType: string;
    required: boolean;
    index: string;
    references?: {
        resourceName: string;
        fieldName: string;
    };
    defaultValue?: string;
    necessity: boolean;
}
export interface AbstractSqlTable {
    name: string;
    resourceName: string;
    idField: string;
    fields: AbstractSqlField[];
    indexes: Array<{
        type: string;
        fields: string[];
    }>;
    primitive: false | string;
}
export interface ReferencedFields {
    [alias: string]: string[];
}
export interface SqlRule {
    sql: string;
    bindings: Binding[];
    structuredEnglish: string;
    referencedFields?: ReferencedFields;
}
export declare type RelationshipMapping = [string, [string, string]];
export interface Relationship {
    $: RelationshipMapping;
    [resourceName: string]: Relationship | RelationshipMapping;
}
export interface AbstractSqlQuery extends Array<AbstractSqlQuery | string> {
}
export interface AbstractSqlModel {
    synonyms: ResourceMap<string>;
    relationships: ResourceMap<Relationship>;
    tables: ResourceMap<AbstractSqlTable>;
    rules: AbstractSqlQuery[];
}
export interface SqlModel {
    synonyms: ResourceMap<string>;
    relationships: ResourceMap<Relationship>;
    tables: ResourceMap<AbstractSqlTable>;
    rules: SqlRule[];
    createSchema: string[];
    dropSchema: string[];
}
export interface HasDependants {
    [dependant: string]: true;
}
export interface SchemaDependencyMap {
    [tableName: string]: {
        resourceName: string;
        primitive: AbstractSqlTable['primitive'];
        createSQL: string;
        dropSQL: string;
        depends: string[];
    };
}
export interface ResourceMap<T> {
    [resourceName: string]: T;
}
export interface ModifiedFields {
    table: string;
    fields?: {}[];
}
export declare enum Engines {
    postgres = "postgres",
    mysql = "mysql",
    websql = "websql",
}
export interface EngineInstance {
    compileSchema: (abstractSqlModel: AbstractSqlModel) => SqlModel;
    compileRule: (abstractSQL: AbstractSqlQuery) => SqlResult | SqlResult[];
    dataTypeValidate: (value: any, field: AbstractSqlField) => any;
    getReferencedFields: (ruleBody: AbstractSqlQuery) => ReferencedFields;
    getModifiedFields: (abstractSqlQuery: AbstractSqlQuery) => undefined | ModifiedFields | Array<undefined | ModifiedFields>;
}
export declare const postgres: {
    compileSchema: _.Function1<AbstractSqlModel, SqlModel>;
    compileRule: _.Function1<AbstractSqlQuery, SqlResult | SqlResult[]>;
    diffSchemas: _.Function2<AbstractSqlModel, AbstractSqlModel, any[]>;
    dataTypeValidate: (value: any, field: AbstractSqlField) => any;
    getReferencedFields: (ruleBody: AbstractSqlQuery) => ReferencedFields;
    getModifiedFields: (abstractSqlQuery: AbstractSqlQuery) => ModifiedFields | (ModifiedFields | undefined)[] | undefined;
};
export declare const mysql: {
    compileSchema: _.Function1<AbstractSqlModel, SqlModel>;
    compileRule: _.Function1<AbstractSqlQuery, SqlResult | SqlResult[]>;
    diffSchemas: _.Function2<AbstractSqlModel, AbstractSqlModel, any[]>;
    dataTypeValidate: (value: any, field: AbstractSqlField) => any;
    getReferencedFields: (ruleBody: AbstractSqlQuery) => ReferencedFields;
    getModifiedFields: (abstractSqlQuery: AbstractSqlQuery) => ModifiedFields | (ModifiedFields | undefined)[] | undefined;
};
export declare const websql: {
    compileSchema: _.Function1<AbstractSqlModel, SqlModel>;
    compileRule: _.Function1<AbstractSqlQuery, SqlResult | SqlResult[]>;
    diffSchemas: _.Function2<AbstractSqlModel, AbstractSqlModel, any[]>;
    dataTypeValidate: (value: any, field: AbstractSqlField) => any;
    getReferencedFields: (ruleBody: AbstractSqlQuery) => ReferencedFields;
    getModifiedFields: (abstractSqlQuery: AbstractSqlQuery) => ModifiedFields | (ModifiedFields | undefined)[] | undefined;
};
