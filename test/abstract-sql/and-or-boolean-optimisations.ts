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

describe('Unnecessary booleans should be removed', () => {
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			[
				'Where',
				[
					'And',
					['Equals', ['ReferencedField', 'table', 'field1'], ['Text', 'a']],
					['Boolean', true],
				],
			],
		],
		[['Text', 'a']],
		(result, sqlEquals) => {
			it('should simplify `... AND true` to `...`', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE "table"."field1" = $1
					`,
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			[
				'Where',
				[
					'Or',
					['Equals', ['ReferencedField', 'table', 'field1'], ['Text', 'a']],
					['Boolean', false],
				],
			],
		],
		[['Text', 'a']],
		(result, sqlEquals) => {
			it('should simplify `... OR false` to `...`', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE "table"."field1" = $1
					`,
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			[
				'Where',
				[
					'And',
					['Equals', ['ReferencedField', 'table', 'field1'], ['Text', 'a']],
					['Boolean', false],
				],
			],
		],
		(result, sqlEquals) => {
			it('should simplify `... AND false` to `false`', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE false
					`,
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			[
				'Where',
				[
					'Or',
					['Equals', ['ReferencedField', 'table', 'field1'], ['Text', 'a']],
					['Boolean', true],
				],
			],
		],
		(result, sqlEquals) => {
			it('should simplify `... AND true` to `true`', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE true
					`,
				);
			});
		},
	);
});
