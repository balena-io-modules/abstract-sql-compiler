import { stripIndent } from 'common-tags';
import { AbstractSqlQuery } from '../../src/AbstractSQLCompiler';

type TestCb = (
	result: { query: string },
	sqlEquals: (a: string, b: string) => void,
) => void;
// tslint:disable-next-line no-var-requires
const test = require('./test') as ((
	query: AbstractSqlQuery,
	binds: any[][] | TestCb,
	cb?: TestCb,
) => void) & {
	mysql: (
		query: AbstractSqlQuery,
		binds: any[][] | TestCb,
		cb?: TestCb,
	) => void;
};

describe('Date trunc function on ReferencedField for milliseconds', () => {
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			[
				'Where',
				[
					'GreaterThan',
					[
						'DateTrunc',
						['EmbeddedText', 'milliseconds'],
						['ReferencedField', 'table', 'created at'],
					],
					['Bind', 0],
				],
			],
		],
		[['Bind', 0]],
		(result, sqlEquals) => {
			it('Generate a postgresql DATE_TRUNC query for referenced field with milliseconds resoluton and binding', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE DATE_TRUNC('milliseconds', "table"."created at") > $1
					`,
				);
			});
		},
	);

	test.mysql(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			[
				'Where',
				[
					'GreaterThan',
					[
						'DateTrunc',
						['EmbeddedText', 'milliseconds'],
						['ReferencedField', 'table', 'created at'],
					],
					['Bind', 0],
				],
			],
		],
		[['Bind', 0]],
		(result, sqlEquals) => {
			it('Ignore DATE_TRUNC in mysql query for referenced field with milliseconds resoluton and binding', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE "table"."created at" > ?
					`,
				);
			});
		},
	);
});
