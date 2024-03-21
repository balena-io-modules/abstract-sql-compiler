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

describe('Concatenate', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[['Concatenate', ['EmbeddedText', 'foo'], ['EmbeddedText', 'bar']]],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Concatenate statement', () => {
				sqlEquals(result.query, `SELECT ('foo' || 'bar')`);
			});
		},
	);
});

describe('ConcatenateWithSeparator', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'ConcatenateWithSeparator',
						['EmbeddedText', '|'],
						['EmbeddedText', 'foo'],
						['EmbeddedText', 'bar'],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid ConcatenateWithSeparator statement', () => {
				sqlEquals(result.query, `SELECT CONCAT_WS('|', 'foo', 'bar')`);
			});
		},
	);
});

describe('Replace', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Replace',
						['EmbeddedText', 'foobar'],
						['EmbeddedText', 'bar'],
						['EmbeddedText', 'baz'],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Replace statement', () => {
				sqlEquals(result.query, `SELECT REPLACE('foobar', 'bar', 'baz')`);
			});
		},
	);
});

describe('CharacterLength', () => {
	test(
		[
			'SelectQuery',
			['Select', [['CharacterLength', ['EmbeddedText', 'foobar']]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid CharacterLength statement', () => {
				sqlEquals(result.query, `SELECT LENGTH('foobar')`);
			});
		},
	);
});

describe('StrPos', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[['StrPos', ['EmbeddedText', 'foobar'], ['EmbeddedText', 'b']]],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid StrPos statement', () => {
				sqlEquals(result.query, `SELECT STRPOS('foobar', 'b')`);
			});
		},
	);
});

describe('Substring', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Substring',
						['EmbeddedText', 'foobar'],
						['Number', 0],
						['Number', 5],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Substring statement', () => {
				sqlEquals(result.query, `SELECT SUBSTRING('foobar', 0, 5)`);
			});
		},
	);
});

describe('Right', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Right', ['EmbeddedText', 'foobar'], ['Number', 1]]]],
		],
		(result, sqlEquals) => {
			it('should produce a valid Right statement', () => {
				sqlEquals(result.query, `SELECT RIGHT('foobar', 1)`);
			});
		},
	);
});

describe('Lower', () => {
	test(
		['SelectQuery', ['Select', [['Lower', ['EmbeddedText', 'FOOBAR']]]]],
		(result, sqlEquals) => {
			it('should produce a valid Lower statement', () => {
				sqlEquals(result.query, `SELECT LOWER('FOOBAR')`);
			});
		},
	);
});

describe('Upper', () => {
	test(
		['SelectQuery', ['Select', [['Upper', ['EmbeddedText', 'foobar']]]]],
		(result, sqlEquals) => {
			it('should produce a valid Upper statement', () => {
				sqlEquals(result.query, `SELECT UPPER('foobar')`);
			});
		},
	);
});

describe('Trim', () => {
	test(
		['SelectQuery', ['Select', [['Trim', ['EmbeddedText', ' foobar ']]]]],
		(result, sqlEquals) => {
			it('should produce a valid Trim statement', () => {
				sqlEquals(result.query, `SELECT TRIM(' foobar ')`);
			});
		},
	);
});
