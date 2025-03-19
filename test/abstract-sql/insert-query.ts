import test from './test';

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
