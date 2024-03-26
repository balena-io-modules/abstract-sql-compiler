import * as fs from 'node:fs';
import * as ODataParser from '@balena/odata-parser';
import { OData2AbstractSQL } from '@balena/odata-to-abstract-sql';
const sbvrModel = fs.readFileSync(require.resolve('../model.sbvr'), 'utf8');

import * as AbstractSQLCompiler from '../..';

import { expect } from 'chai';
import * as _ from 'lodash';

const generateClientModel = function (input) {
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

const bindingsTest = function (actualBindings, expectedBindings) {
	if (expectedBindings == null) {
		expectedBindings = false;
	}
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

const equals = (actual, expected) => {
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
};

const runExpectation = function (
	describe,
	engine,
	input,
	method,
	expectedBindings,
	body,
	expectation,
) {
	if (expectation == null) {
		if (body == null) {
			if (expectedBindings == null) {
				expectation = method;
				method = 'GET';
			} else {
				expectation = expectedBindings;
			}
			expectedBindings = false;
		} else {
			expectation = body;
		}
		body = {};
	}

	describe(
		'Parsing ' + method + ' ' + _.truncate(input, { length: 100 }),
		function () {
			let result;
			try {
				input = ODataParser.parse(input);
				const { tree, extraBodyVars } = odata2AbstractSQL.match(
					input.tree,
					method,
					_.keys(body),
					0,
				);
				_.assign(body, extraBodyVars);
				result = AbstractSQLCompiler[engine].compileRule(tree);
			} catch (e) {
				expectation(e);
				return;
			}
			if (Array.isArray(result)) {
				for (let i = 0; i < result.length; i++) {
					const actualResult = result[i];
					if (expectedBindings[0][0] === 'Bind') {
						bindingsTest(actualResult.bindings, expectedBindings);
					} else {
						bindingsTest(actualResult.bindings, expectedBindings[i]);
					}
				}
			} else {
				bindingsTest(result.bindings, expectedBindings);
			}
			expectation(result, sqlEquals[engine]);
		},
	);
};

const bindRunExpectation = function (engine) {
	const bound = runExpectation.bind(null, describe, engine);
	bound.skip = runExpectation.bind(null, describe.skip, engine);
	// eslint-disable-next-line no-only-tests/no-only-tests -- this is a false positive
	bound.only = runExpectation.bind(null, describe.only, engine);
	return bound;
};

const testFn = bindRunExpectation('postgres');
testFn.postgres = bindRunExpectation('postgres');
testFn.mysql = bindRunExpectation('mysql');
testFn.websql = bindRunExpectation('websql');

export default testFn;
