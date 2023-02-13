import * as AbstractSQLCompiler from '../..';
import { expect } from 'chai';

describe('generate informative reference schema', () => {
	it('reference type informative produces just a column without foreign key / constraint', () => {
		expect(
			AbstractSQLCompiler.postgres.compileSchema({
				tables: {
					term: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'term',
						indexes: [],
						idField: 'id',
						resourceName: 'term',
					},
					'term history': {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-term',
								required: true,
								references: {
									resourceName: 'term',
									fieldName: 'id',
									type: 'informative',
								},
							},
						],
						primitive: false,
						name: 'term history',
						indexes: [],
						idField: 'id',
						resourceName: 'term history',
					},
				},
				relationships: {},
				rules: [],
				synonyms: {},
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
);`,
			]);
	});

	it('reference type informative produces just a column without foreign key / constraint - mixed mode', () => {
		expect(
			AbstractSQLCompiler.postgres.compileSchema({
				tables: {
					term: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'term',
						indexes: [],
						idField: 'id',
						resourceName: 'term',
					},
					termterm: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'termterm',
						indexes: [],
						idField: 'id',
						resourceName: 'termterm',
					},
					'term history': {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-term',
								required: true,
								references: {
									resourceName: 'term',
									fieldName: 'id',
									type: 'informative',
								},
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-termterm',
								required: true,
								references: {
									resourceName: 'termterm',
									fieldName: 'id',
								},
							},
						],
						primitive: false,
						name: 'term history',
						indexes: [],
						idField: 'id',
						resourceName: 'term history',
					},
				},
				relationships: {},
				rules: [],
				synonyms: {},
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "termterm" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
,	"references-termterm" INTEGER NOT NULL
,	FOREIGN KEY ("references-termterm") REFERENCES "termterm" ("id")
);`,
			]);
	});
	it('reference type strict produces a column foreign key / constraint', () => {
		expect(
			AbstractSQLCompiler.postgres.compileSchema({
				tables: {
					term: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'term',
						indexes: [],
						idField: 'id',
						resourceName: 'term',
					},
					'term history': {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-term',
								required: true,
								references: {
									resourceName: 'term',
									fieldName: 'id',
									type: 'strict',
								},
							},
						],
						primitive: false,
						name: 'term history',
						indexes: [],
						idField: 'id',
						resourceName: 'term history',
					},
				},
				relationships: {},
				rules: [],
				synonyms: {},
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
,	FOREIGN KEY ("references-term") REFERENCES "term" ("id")
);`,
			]);
	});

	it('reference type undefined produces a column foreign key / constraint', () => {
		expect(
			AbstractSQLCompiler.postgres.compileSchema({
				tables: {
					term: {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
						],
						primitive: false,
						name: 'term',
						indexes: [],
						idField: 'id',
						resourceName: 'term',
					},
					'term history': {
						fields: [
							{
								dataType: 'Date Time',
								fieldName: 'created at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Date Time',
								fieldName: 'modified at',
								required: true,
								defaultValue: 'CURRENT_TIMESTAMP',
							},
							{
								dataType: 'Serial',
								fieldName: 'id',
								required: true,
								index: 'PRIMARY KEY',
							},
							{
								dataType: 'ForeignKey',
								fieldName: 'references-term',
								required: true,
								references: {
									resourceName: 'term',
									fieldName: 'id',
								},
							},
						],
						primitive: false,
						name: 'term history',
						indexes: [],
						idField: 'id',
						resourceName: 'term history',
					},
				},
				relationships: {},
				rules: [],
				synonyms: {},
				lfInfo: { rules: {} },
			}),
		)
			.to.have.property('createSchema')
			.that.deep.equals([
				`\
CREATE TABLE IF NOT EXISTS "term" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
);`,
				`\
CREATE TABLE IF NOT EXISTS "term history" (
	"created at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"modified at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
,	"id" SERIAL NOT NULL PRIMARY KEY
,	"references-term" INTEGER NOT NULL
,	FOREIGN KEY ("references-term") REFERENCES "term" ("id")
);`,
			]);
	});
});
