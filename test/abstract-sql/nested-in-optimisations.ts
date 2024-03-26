import { stripIndent } from 'common-tags';
import type { AnyTypeNodes } from '../../src/AbstractSQLCompiler';

type TestCb = (
	result: { query: string },
	sqlEquals: (a: string, b: string) => void,
) => void;
import $test from './test';
const test = $test as (
	query: AnyTypeNodes,
	binds: any[][] | TestCb,
	cb?: TestCb,
) => void;

describe('Nested OR EQUALs should create a single IN statement', () => {
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
					[
						'Or',
						['Equals', ['ReferencedField', 'table', 'field1'], ['Text', 'b']],
						[
							'Or',
							['Equals', ['ReferencedField', 'table', 'field1'], ['Text', 'c']],
							['Equals', ['ReferencedField', 'table', 'field1'], ['Text', 'd']],
						],
					],
				],
			],
		],
		[
			['Text', 'a'],
			['Text', 'b'],
			['Text', 'c'],
			['Text', 'd'],
		],
		(result, sqlEquals) => {
			it('should produce a single IN statement', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE "table"."field1" IN ($1, $2, $3, $4)
					`,
				);
			});
		},
	);
});

describe('Nested AND NOT EQUALs should create a single NOT IN statement', () => {
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			[
				'Where',
				[
					'And',
					['NotEquals', ['ReferencedField', 'table', 'field1'], ['Text', 'a']],
					[
						'And',
						[
							'NotEquals',
							['ReferencedField', 'table', 'field1'],
							['Text', 'b'],
						],
						[
							'And',
							[
								'NotEquals',
								['ReferencedField', 'table', 'field1'],
								['Text', 'c'],
							],
							[
								'NotEquals',
								['ReferencedField', 'table', 'field1'],
								['Text', 'd'],
							],
						],
					],
				],
			],
		],
		[
			['Text', 'a'],
			['Text', 'b'],
			['Text', 'c'],
			['Text', 'd'],
		],
		(result, sqlEquals) => {
			it('should produce a single IN statement', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE "table"."field1" NOT IN ($1, $2, $3, $4)
					`,
				);
			});
		},
	);
});

describe('OR IN/EQUALs should create a single IN statement', () => {
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			[
				'Where',
				[
					'Or',
					[
						'In',
						['ReferencedField', 'table', 'field1'],
						['Text', 'a'],
						['Text', 'b'],
					],
					[
						'Or',
						['Equals', ['ReferencedField', 'table', 'field1'], ['Text', 'c']],
						['Equals', ['ReferencedField', 'table', 'field1'], ['Text', 'd']],
					],
				],
			],
		],
		[
			['Text', 'a'],
			['Text', 'b'],
			['Text', 'c'],
			['Text', 'd'],
		],
		(result, sqlEquals) => {
			it('should produce a single in statement', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE "table"."field1" IN ($1, $2, $3, $4)
					`,
				);
			});
		},
	);
});

describe('AND NOT IN/NOT EQUALs should create a single NOT IN statement', () => {
	test(
		[
			'SelectQuery',
			['Select', []],
			['From', ['Table', 'table']],
			[
				'Where',
				[
					'And',
					[
						'NotIn',
						['ReferencedField', 'table', 'field1'],
						['Text', 'a'],
						['Text', 'b'],
					],
					[
						'And',
						[
							'NotEquals',
							['ReferencedField', 'table', 'field1'],
							['Text', 'c'],
						],
						[
							'NotEquals',
							['ReferencedField', 'table', 'field1'],
							['Text', 'd'],
						],
					],
				],
			],
		],
		[
			['Text', 'a'],
			['Text', 'b'],
			['Text', 'c'],
			['Text', 'd'],
		],
		(result, sqlEquals) => {
			it('should produce a single not in statement', () => {
				sqlEquals(
					result.query,
					stripIndent`
						SELECT 1
						FROM "table"
						WHERE "table"."field1" NOT IN ($1, $2, $3, $4)
					`,
				);
			});
		},
	);
});
