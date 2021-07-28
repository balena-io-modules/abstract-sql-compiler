import { stripIndent } from 'common-tags';
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

describe('Date trunc function on ReferencedField', () => {
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
						['Text', 'milliseconds'],
						['ReferencedField', 'table', 'created at'],
					],
					['Bind', 0],
				],
			],
		],
		[
			['Text', 'milliseconds'],
			['Bind', 0],
		],
		(result, sqlEquals) => {
			it('Generate a postgresql DATE_TRUNC query for referenced field with milliseconds resoluton and binding', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE DATE_TRUNC($1, "table"."created at") > $2
					`,
				);
			});
		},
	);
});
