import * as AbstractSQLCompiler from '../..';

import { expect } from 'chai';
import * as _ from 'lodash';

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
	expectedBindings,
	body,
	expectation,
) {
	if (expectation == null) {
		if (body == null) {
			expectation = expectedBindings;
			expectedBindings = false;
		} else {
			expectation = body;
		}
		body = {};
	}

	describe('Parsing ' + JSON.stringify(input), function () {
		let result;
		try {
			result = AbstractSQLCompiler[engine].compileRule(input);
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
		return expectation(result, sqlEquals[engine]);
	});
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
