import { expect } from 'chai';
import test from './test.js';

describe('ExtractJSONPathAsText argument count', () => {
	test.fail(
		['SelectQuery', ['Select', [['ExtractJSONPathAsText', ['Field', 'json']]]]],
		(err) => {
			it('should require both the json and the path', () => {
				expect(err)
					.to.be.instanceOf(SyntaxError)
					.with.property(
						'message',
						'"ExtractJSONPathAsText" requires 2 arg(s)',
					);
			});
		},
	);
});
