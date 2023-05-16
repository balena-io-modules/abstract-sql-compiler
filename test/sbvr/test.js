const _ = require('lodash');
const sbvrTypes = require('@balena/sbvr-types').default;

const { expect } = require('chai');
const AbstractSQLCompiler = require('../..');

module.exports = function (builtInVocab) {
	if (builtInVocab == null) {
		builtInVocab = false;
	}
	const SBVRParser = require('@balena/sbvr-parser').SBVRParser.createInstance();
	SBVRParser.enableReusingMemoizations(SBVRParser._sideEffectingRules);

	const LF2AbstractSQL = require('@balena/lf-to-abstract-sql');
	const LF2AbstractSQLTranslator = LF2AbstractSQL.createTranslator(sbvrTypes);

	if (builtInVocab) {
		SBVRParser.AddBuiltInVocab(builtInVocab);
	}

	let seSoFar = '';

	const runExpectation = (it, input, expectation) => {
		it(input, function () {
			let result;
			try {
				SBVRParser.reset();
				const lf = SBVRParser.matchAll(seSoFar + input, 'Process');
				const schema = LF2AbstractSQLTranslator(lf, 'Process');
				result = AbstractSQLCompiler.postgres.compileSchema(schema);
			} catch (e) {
				expectation(e);
				return;
			}
			expectation(result);
		});
	};

	const runSchema = (it, input, expectation) => {
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

	const runRule = (it, input, expectation) => {
		runExpectation(it, 'Rule: ' + input, function (result) {
			if (_.isFunction(expectation)) {
				expectation(result);
			} else if (_.isError(result)) {
				throw result;
			} else {
				expect(result).to.have.property('rules');
				const lastRule = _.last(result.rules);
				expect(lastRule)
					.to.have.property('structuredEnglish')
					.that.equals(input);
				expect(lastRule).to.have.property('sql').that.equals(expectation);
			}
		});
	};

	const ret = runSchema.bind(null, it);
	ret.skip = runSchema.bind(null, it.skip);
	ret.only = runSchema.bind(null, it.only);
	ret.rule = runRule.bind(null, it);
	ret.rule.skip = runRule.bind(null, it.skip);
	ret.rule.only = runRule.bind(null, it.only);
	return ret;
};
