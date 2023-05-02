import { AnyTypeNodes } from '../../src/AbstractSQLCompiler';

type TestCb = (
	result: { query: string },
	sqlEquals: (a: string, b: string) => void,
) => void;
// tslint:disable-next-line no-var-requires
const test = require('./test') as (
	query: AnyTypeNodes,
	binds: any[][] | TestCb,
	cb?: TestCb,
) => void;

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
					result.query,
					`\
INSERT INTO "test" ("foo")
VALUES (TRUE)`,
				);
			});
		},
	);
});
