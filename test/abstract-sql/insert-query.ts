import { expect } from 'chai';
import test from './test.js';

describe('Insert boolean value', () => {
	test(
		[
			'InsertQuery',
			['From', ['Table', 'test']],
			['Fields', ['foo']],
			['Values', [['Boolean', true]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid insert boolean statement', () => {
				sqlEquals(
					result,
					`\
INSERT INTO "test" ("foo")
VALUES (TRUE)`,
				);
			});
		},
	);
});

describe('Insert with mismatched fields and values', () => {
	test.fail(
		[
			'InsertQuery',
			['From', ['Table', 'test']],
			['Fields', ['foo', 'bar']],
			['Values', [['Boolean', true]]],
		],
		(err) => {
			it('should be rejected by the optimizer', () => {
				expect(err)
					.to.be.instanceOf(SyntaxError)
					.with.property(
						'message',
						"'InsertQuery' requires Fields and Values components to have the same length or use a query for Values",
					);
			});
		},
	);
});
