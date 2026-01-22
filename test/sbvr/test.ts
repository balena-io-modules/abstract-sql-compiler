import _ from 'lodash';
import $sbvrTypes from '@balena/sbvr-types';
const { default: sbvrTypes } = $sbvrTypes;
// @ts-expect-error @balena/sbvr-parser doesn't have types
import { SBVRParser } from '@balena/sbvr-parser';
// @ts-expect-error @balena/lf-to-abstract-sql doesn't have types
import LF2AbstractSQL from '@balena/lf-to-abstract-sql';

import { expect } from 'chai';
import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';

export function getTestHelpers(builtInVocab: string | boolean = false) {
	const sbvrParser = SBVRParser.createInstance();
	sbvrParser.enableReusingMemoizations(sbvrParser._sideEffectingRules);

	const LF2AbstractSQLTranslator = LF2AbstractSQL.createTranslator(sbvrTypes);

	if (builtInVocab) {
		sbvrParser.AddBuiltInVocab(builtInVocab);
	}

	let seSoFar = '';

	const runExpectation = (
		it: Mocha.TestFunction,
		input: string,
		expectation: (result: AbstractSQLCompiler.SqlModel | Error) => void,
	) => {
		it(input, function () {
			let result;
			try {
				sbvrParser.reset();
				const lf = sbvrParser.matchAll(seSoFar + input, 'Process');
				const schema = LF2AbstractSQLTranslator(lf, 'Process');
				result = AbstractSQLCompiler.postgres.compileSchema(schema);
			} catch (e: any) {
				expectation(e);
				return;
			}
			expectation(result);
		});
	};

	const runSchema = (
		it: Mocha.TestFunction,
		input: string,
		expectation:
			| ((result: AbstractSQLCompiler.SqlModel | Error) => void)
			| string[],
	) => {
		runExpectation(it, input, function (result) {
			seSoFar += input + '\n';
			if (_.isFunction(expectation)) {
				expectation(result);
			} else if (_.isError(result)) {
				throw result;
			} else {
				expect(result).to.have.property('createSchema');
				// Individually match the statements in order to get a nicer diff if they don't match.
				const len = Math.max(result.createSchema.length, expectation.length);
				for (let i = 0; i < len; i++) {
					expect(result.createSchema[i]).to.equal(expectation[i]);
				}
				expect(result.createSchema.length).to.equal(expectation.length);
			}
		});
	};

	const runRule = (
		it: Mocha.TestFunction,
		input: string,
		expectation:
			| ((result: AbstractSQLCompiler.SqlModel | Error) => void)
			| string,
	) => {
		runExpectation(it, 'Rule: ' + input, function (result) {
			if (_.isFunction(expectation)) {
				expectation(result);
			} else if (_.isError(result)) {
				throw result;
			} else {
				expect(result).to.have.property('rules');
				const lastRule = result.rules.at(-1);
				expect(lastRule)
					.to.have.property('structuredEnglish')
					.that.equals(input);
				expect(lastRule).to.have.property('sql').that.equals(expectation);
			}
		});
	};

	const ret = runSchema.bind(null, it);
	ret.skip = runSchema.bind(null, it.skip);
	// eslint-disable-next-line no-only-tests/no-only-tests -- this is a false positive
	ret.only = runSchema.bind(null, it.only);
	ret.rule = runRule.bind(null, it);
	ret.rule.skip = runRule.bind(null, it.skip);
	// eslint-disable-next-line no-only-tests/no-only-tests -- this is a false positive
	ret.rule.only = runRule.bind(null, it.only);
	return ret;
}
