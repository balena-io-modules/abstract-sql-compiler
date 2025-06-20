import * as AbstractSQLCompiler from '../../out/AbstractSQLCompiler.js';

import { expect } from 'chai';
import _ from 'lodash';

type ExpectedBindings = Array<
	AbstractSQLCompiler.Binding | AbstractSQLCompiler.Binding[]
>;
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
	input: AbstractSQLCompiler.AbstractSqlQuery,
	expectedBindings: ExpectedBindings | false,
	expectation: ExpectationFn<ExpectFail>,
): void;
function runExpectation<ExpectFail extends boolean>(
	describe: Mocha.SuiteFunction,
	engine: keyof typeof sqlEquals,
	expectFailure: ExpectFail,
	input: AbstractSQLCompiler.AbstractSqlQuery,
	expectation: ExpectationFn<ExpectFail>,
): void;
function runExpectation<ExpectFail extends boolean>(
	describe: Mocha.SuiteFunction,
	engine: keyof typeof sqlEquals,
	expectFailure: ExpectFail,
	input: AbstractSQLCompiler.AbstractSqlQuery,
	...args:
		| [expectation: ExpectationFn<ExpectFail>]
		| [
				expectedBindings: ExpectedBindings | false,
				expectation: ExpectationFn<ExpectFail>,
		  ]
): void {
	let expectedBindings: ExpectedBindings | false = false;
	let expectation: ExpectationFn<ExpectFail>;
	switch (args.length) {
		case 1:
			[expectation] = args;
			break;
		case 2:
			[expectedBindings, expectation] = args;
			break;
	}

	describe('Parsing ' + JSON.stringify(input), function () {
		let result;
		try {
			result = AbstractSQLCompiler[engine].compileRule(input);
		} catch (e: any) {
			if (!expectFailure) {
				throw e;
			}
			(expectation as ExpectationFailFn)(e);
			return;
		}
		if (expectFailure) {
			throw new Error("Expected failure but didn't get one");
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
	});
}

interface BoundRunExpectation<ExpectFail extends boolean> {
	(
		input: AbstractSQLCompiler.AbstractSqlQuery,
		expectedBindings: ExpectedBindings | false,
		expectation: ExpectationFn<ExpectFail>,
	): void;
	(
		input: AbstractSQLCompiler.AbstractSqlQuery,
		expectation: ExpectationFn<ExpectFail>,
	): void;
	(
		input: AbstractSQLCompiler.AbstractSqlQuery,
		...args:
			| [expectation: ExpectationFn<ExpectFail>]
			| [
					expectedBindings: ExpectedBindings | false,
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
