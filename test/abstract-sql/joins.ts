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

const joinTest = (joinType: string, sqlJoinType: string) => {
	describe(joinType, () => {
		test(
			[
				'SelectQuery',
				[
					'Select',
					[
						['ReferencedField', 'table', 'field1'],
						['ReferencedField', 'table2', 'field2'],
					],
				],
				['From', ['Table', 'table']],
				[
					joinType,
					['Table', 'table2'],
					[
						'On',
						[
							'Equals',
							['ReferencedField', 'table', 'field1'],
							['ReferencedField', 'table2', 'field2'],
						],
					],
				],
			],
			(result, sqlEquals) => {
				it('should produce a valid join statement', () => {
					sqlEquals(
						result.query,
						stripIndent`
							SELECT "table"."field1", "table2"."field2"
							FROM "table"
							${sqlJoinType} "table2" ON "table"."field1" = "table2"."field2"
						`,
					);
				});
			},
		);
	});
};

joinTest('Join', 'JOIN');

joinTest('RightJoin', 'RIGHT JOIN');

joinTest('LeftJoin', 'LEFT JOIN');

joinTest('FullJoin', 'FULL JOIN');

describe('CrossJoin', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					['ReferencedField', 'table', 'field1'],
					['ReferencedField', 'table2', 'field2'],
				],
			],
			['From', ['Table', 'table']],
			['CrossJoin', ['Table', 'table2']],
		],
		(result, sqlEquals) => {
			it('should produce a valid join statement', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT "table"."field1", "table2"."field2"
						FROM "table"
						CROSS JOIN "table2"
					`,
				);
			});
		},
	);
});
