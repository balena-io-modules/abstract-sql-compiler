import test from './test.ts';

describe('TextArray', () => {
	test(
		['SelectQuery', ['Select', [['TextArray', ['Text', 'a'], ['Text', 'b']]]]],
		[
			['Text', 'a'],
			['Text', 'b'],
		],
		(result, sqlEquals) => {
			it('should produce a valid TextArray statement', () => {
				sqlEquals(result, `SELECT ARRAY[$1, $2]`);
			});
		},
	);
	test(['SelectQuery', ['Select', [['TextArray']]]], (result, sqlEquals) => {
		it('should produce a valid empty TextArray statement', () => {
			sqlEquals(result, `SELECT CAST(ARRAY[] as TEXT[])`);
		});
	});
});
