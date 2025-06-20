import test from './test.js';

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
				sqlEquals(result, `SELECT "foo"."bar" #>> CAST(ARRAY[] as TEXT[])`);
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
				sqlEquals(result, `SELECT "foo"."bar" #>> ARRAY['buz', 'baz']`);
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
				sqlEquals(result, 'SELECT TO_JSON("foo"."bar")');
			});
		},
	);
});
