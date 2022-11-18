import { AbstractSqlQuery } from '../../src/AbstractSQLCompiler';

type TestCb = (
	result: { query: string },
	sqlEquals: (a: string, b: string) => void,
) => void;
// tslint:disable-next-line no-var-requires
const test = require('./test') as (
	query: AbstractSqlQuery,
	binds: any[][] | TestCb,
	cb?: TestCb,
) => void;

describe('ExtractJSONPathAsText', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'ExtractJSONPathAsText',
						['ReferencedField', 'foo', 'bar'],
						['TextArray'],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid select with given empty text array', () => {
				sqlEquals(
					result.query,
					`SELECT "foo"."bar" #>> CAST(ARRAY[] as TEXT[])`,
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'ExtractJSONPathAsText',
						['ReferencedField', 'foo', 'bar'],
						['TextArray', ['EmbeddedText', 'buz'], ['EmbeddedText', 'baz']],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid select with given populated text array', () => {
				sqlEquals(result.query, `SELECT "foo"."bar" #>> ARRAY['buz', 'baz']`);
			});
		},
	);
});

describe('ToJSON', () => {
	test(
		[
			'SelectQuery',
			['Select', [['ToJSON', ['ReferencedField', 'foo', 'bar']]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid to_json select statement', () => {
				sqlEquals(result.query, 'SELECT TO_JSON("foo"."bar")');
			});
		},
	);
});
