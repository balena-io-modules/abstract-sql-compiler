import * as fs from 'node:fs';
import * as ODataParser from '@balena/odata-parser';
import { OData2AbstractSQL } from '@balena/odata-to-abstract-sql';
const sbvrModel = fs.readFileSync(require.resolve('../model.sbvr'), 'utf8');

import * as AbstractSQLCompiler from '../..';

import { expect } from 'chai';
import _ from 'lodash';

const generateClientModel = function (input: string) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const sbvrTypes = require('@balena/sbvr-types').default;
	const typeVocab = fs.readFileSync(
		require.resolve('@balena/sbvr-types/Type.sbvr'),
		'utf8',
	);

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const SBVRParser = require('@balena/sbvr-parser').SBVRParser.createInstance();
	SBVRParser.enableReusingMemoizations(SBVRParser._sideEffectingRules);
	SBVRParser.AddCustomAttribute('Database ID Field:');
	SBVRParser.AddCustomAttribute('Database Table Name:');
	SBVRParser.AddBuiltInVocab(typeVocab);

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const LF2AbstractSQL = require('@balena/lf-to-abstract-sql');
	const LF2AbstractSQLTranslator = LF2AbstractSQL.createTranslator(sbvrTypes);

	const lf = SBVRParser.matchAll(input, 'Process');
	const abstractSql = LF2AbstractSQLTranslator(lf, 'Process');
	return abstractSql;
};

export const clientModel = generateClientModel(sbvrModel);
const odata2AbstractSQL = new OData2AbstractSQL(clientModel);

const bindingsTest = function (
	actualBindings: AbstractSQLCompiler.Binding[],
	expectedBindings: AbstractSQLCompiler.Binding[] | false = false,
) {
	if (expectedBindings === false) {
		it('should not have any bindings', () => {
			expect(actualBindings).to.be.empty;
		});
	} else {
		it('should have matching bindings', () => {
			expect(actualBindings).to.deep.equal(expectedBindings);
		});
	}
};

type SqlEquals = (
	actual:
		| AbstractSQLCompiler.SqlResult
		| AbstractSQLCompiler.SqlResult[]
		| string,
	expected: string,
) => void;
const equals: SqlEquals = (actual, expected) => {
	if (typeof actual !== 'string') {
		if (Array.isArray(actual)) {
			throw new Error('Expected a single query, got multiple');
		}
		actual = actual.query;
	}
	expect(actual).to.equal(expected);
};
const sqlEquals = {
	websql: equals,
	mysql: equals,
	postgres(actual, expected) {
		let num = 1;
		while (_.includes(expected, '?')) {
			expected = expected.replace('?', '$' + num);
			num++;
		}
		equals(actual, expected);
	},
} satisfies Record<string, SqlEquals>;

type ExpectedBindings = ReadonlyArray<
	Readonly<AbstractSQLCompiler.Binding | AbstractSQLCompiler.Binding[]>
>;

type ExpectationSuccessFn = (
	result:
		| AbstractSQLCompiler.SqlResult
		| [AbstractSQLCompiler.SqlResult, AbstractSQLCompiler.SqlResult],
	sqlEquals: SqlEquals,
) => void;
type ExpectationFailFn = (result: Error) => void;
type ExpectationFn<ExpectFail extends boolean> = ExpectFail extends true
	? ExpectationFailFn
	: ExpectationSuccessFn;

function runExpectation<ExpectFail extends boolean>(
	describe: Mocha.SuiteFunction,
	engine: keyof typeof sqlEquals,
	expectFailure: ExpectFail,
	input: string,
	method: ODataParser.SupportedMethod,
	expectedBindings: ExpectedBindings | false,
	body: Record<string, unknown>,
	expectation: ExpectationFn<ExpectFail>,
): void;
function runExpectation<ExpectFail extends boolean>(
	describe: Mocha.SuiteFunction,
	engine: keyof typeof sqlEquals,
	expectFailure: ExpectFail,
	input: string,
	method: ODataParser.SupportedMethod,
	expectedBindings: ExpectedBindings | false,
	expectation: ExpectationFn<ExpectFail>,
): void;
function runExpectation<ExpectFail extends boolean>(
	describe: Mocha.SuiteFunction,
	engine: keyof typeof sqlEquals,
	expectFailure: ExpectFail,
	input: string,
	method: ODataParser.SupportedMethod,
	expectation: ExpectationFn<ExpectFail>,
): void;
function runExpectation<ExpectFail extends boolean>(
	describe: Mocha.SuiteFunction,
	engine: keyof typeof sqlEquals,
	expectFailure: ExpectFail,
	input: string,
	expectation: ExpectationFn<ExpectFail>,
): void;
function runExpectation<ExpectFail extends boolean>(
	describe: Mocha.SuiteFunction,
	engine: keyof typeof sqlEquals,
	expectFailure: ExpectFail,
	input: string,
	...args:
		| [expectation: ExpectationFn<ExpectFail>]
		| [
				method: ODataParser.SupportedMethod,
				expectation: ExpectationFn<ExpectFail>,
		  ]
		| [
				method: ODataParser.SupportedMethod,
				expectedBindings: ExpectedBindings | false,
				expectation: ExpectationFn<ExpectFail>,
		  ]
		| [
				method: ODataParser.SupportedMethod,
				expectedBindings: ExpectedBindings | false,
				body: Record<string, unknown>,
				expectation: ExpectationFn<ExpectFail>,
		  ]
): void {
	let method: ODataParser.SupportedMethod = 'GET';
	let expectedBindings: ExpectedBindings | false = false;
	let body: Record<string, unknown> = {};
	let expectation: ExpectationFn<ExpectFail>;
	switch (args.length) {
		case 1:
			[expectation] = args;
			break;
		case 2:
			[method, expectation] = args;
			break;
		case 3:
			[method, expectedBindings, expectation] = args;
			break;
		case 4:
			[method, expectedBindings, body, expectation] = args;
			break;
	}

	describe(
		'Parsing ' + method + ' ' + _.truncate(input, { length: 100 }),
		function () {
			let result;
			try {
				const odataAST = ODataParser.parse(input);
				const { tree, extraBodyVars } = odata2AbstractSQL.match(
					odataAST.tree,
					method,
					_.keys(body),
					0,
				);
				_.assign(body, extraBodyVars);
				result = AbstractSQLCompiler[engine].compileRule(tree);
			} catch (e: any) {
				if (!expectFailure) {
					throw e;
				}
				(expectation as ExpectationFailFn)(e);
				return;
			}
			if (Array.isArray(result)) {
				for (let i = 0; i < result.length; i++) {
					const actualResult = result[i];
					if (expectedBindings === false) {
						bindingsTest(actualResult.bindings, false);
					} else if (expectedBindings[0][0] === 'Bind') {
						bindingsTest(
							actualResult.bindings,
							expectedBindings as AbstractSQLCompiler.Binding[],
						);
					} else {
						bindingsTest(
							actualResult.bindings,
							expectedBindings[i] as AbstractSQLCompiler.Binding[],
						);
					}
				}
			} else {
				bindingsTest(
					result.bindings,
					expectedBindings as AbstractSQLCompiler.Binding[],
				);
			}
			(expectation as ExpectationSuccessFn)(result, sqlEquals[engine]);
		},
	);
}

interface BoundRunExpectation<ExpectFail extends boolean> {
	(
		input: string,
		method: ODataParser.SupportedMethod,
		expectedBindings: ExpectedBindings | false,
		body: Record<string, unknown>,
		expectation: ExpectationFn<ExpectFail>,
	): void;
	(
		input: string,
		method: ODataParser.SupportedMethod,
		expectedBindings: ExpectedBindings | false,
		expectation: ExpectationFn<ExpectFail>,
	): void;
	(
		input: string,
		method: ODataParser.SupportedMethod,
		expectation: ExpectationFn<ExpectFail>,
	): void;
	(input: string, expectation: ExpectationFn<ExpectFail>): void;
	(
		input: string,
		...args:
			| [expectation: ExpectationFn<ExpectFail>]
			| [
					method: ODataParser.SupportedMethod,
					expectation: ExpectationFn<ExpectFail>,
			  ]
			| [
					method: ODataParser.SupportedMethod,
					expectedBindings: ExpectedBindings | false,
					expectation: ExpectationFn<ExpectFail>,
			  ]
			| [
					method: ODataParser.SupportedMethod,
					expectedBindings: ExpectedBindings | false,
					body: Record<string, unknown>,
					expectation: ExpectationFn<ExpectFail>,
			  ]
	): void;
}

type MochaBoundRunExpectation = BoundRunExpectation<false> & {
	fail: BoundRunExpectation<true>;
	skip: BoundRunExpectation<false>;
	only: BoundRunExpectation<false>;
};
const bindRunExpectation = function (engine: keyof typeof sqlEquals) {
	const bound: MochaBoundRunExpectation = runExpectation.bind(
		null,
		describe,
		engine,
		false,
	);
	bound.fail = runExpectation.bind(null, describe, engine, true);
	bound.skip = runExpectation.bind(null, describe.skip, engine, false);
	// eslint-disable-next-line no-only-tests/no-only-tests -- this is a false positive
	bound.only = runExpectation.bind(null, describe.only, engine, false);
	return bound;
};

const testFn = bindRunExpectation('postgres') as MochaBoundRunExpectation & {
	postgres: MochaBoundRunExpectation;
	mysql: MochaBoundRunExpectation;
	websql: MochaBoundRunExpectation;
};
testFn.postgres = bindRunExpectation('postgres');
testFn.mysql = bindRunExpectation('mysql');
testFn.websql = bindRunExpectation('websql');

export default testFn;
