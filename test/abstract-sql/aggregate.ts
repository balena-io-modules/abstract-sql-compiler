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

describe('Count', () => {
	test(['SelectQuery', ['Select', [['Count', '*']]]], (result, sqlEquals) => {
		it('should produce a valid COUNT(*) statement', () => {
			sqlEquals(result.query, 'SELECT COUNT(*)');
		});
	});
});

describe('Average', () => {
	test(
		['SelectQuery', ['Select', [['Average', ['Number', 5]]]]],
		(result, sqlEquals) => {
			it('should produce a valid AVG(5) statement', () => {
				sqlEquals(result.query, 'SELECT AVG(5)');
			});
		},
	);
});

describe('Sum', () => {
	test(
		['SelectQuery', ['Select', [['Sum', ['Number', 5]]]]],
		(result, sqlEquals) => {
			it('should produce a valid SUM(5) statement', () => {
				sqlEquals(result.query, 'SELECT SUM(5)');
			});
		},
	);
});

describe('Add', () => {
	test(
		['SelectQuery', ['Select', [['Add', ['Number', 5], ['Number', 3]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Add statement', () => {
				sqlEquals(result.query, 'SELECT 5 + 3');
			});
		},
	);
});

describe('Subtract', () => {
	test(
		['SelectQuery', ['Select', [['Subtract', ['Number', 5], ['Number', 3]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Subtract statement', () => {
				sqlEquals(result.query, 'SELECT 5 - 3');
			});
		},
	);
});

describe('Multiply', () => {
	test(
		['SelectQuery', ['Select', [['Multiply', ['Number', 5], ['Number', 3]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Multiply statement', () => {
				sqlEquals(result.query, 'SELECT 5 * 3');
			});
		},
	);
});

describe('Divide', () => {
	test(
		['SelectQuery', ['Select', [['Divide', ['Number', 10], ['Number', 5]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Divide statement', () => {
				sqlEquals(result.query, 'SELECT 10 / 5');
			});
		},
	);
});

describe('Year', () => {
	test(
		['SelectQuery', ['Select', [['Year', ['Date', '2022-10-10']]]]],
		[['Date', '2022-10-10']],
		(result, sqlEquals) => {
			it('should produce a valid Year statement', () => {
				sqlEquals(result.query, `SELECT EXTRACT('YEAR' FROM $1)`);
			});
		},
	);
});

describe('Month', () => {
	test(
		['SelectQuery', ['Select', [['Month', ['Date', '2022-10-10']]]]],
		[['Date', '2022-10-10']],
		(result, sqlEquals) => {
			it('should produce a valid Month statement', () => {
				sqlEquals(result.query, `SELECT EXTRACT('MONTH' FROM $1)`);
			});
		},
	);
});

describe('Day', () => {
	test(
		['SelectQuery', ['Select', [['Day', ['Date', '2022-10-10']]]]],
		[['Date', '2022-10-10']],
		(result, sqlEquals) => {
			it('should produce a valid Day statement', () => {
				sqlEquals(result.query, `SELECT EXTRACT('DAY' FROM $1)`);
			});
		},
	);
});

describe('Hour', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Hour', ['Date', '2022-10-10T10:10:10.000Z']]]],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Hour statement', () => {
				sqlEquals(result.query, `SELECT EXTRACT('HOUR' FROM $1)`);
			});
		},
	);
});

describe('Minute', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Minute', ['Date', '2022-10-10T10:10:10.000Z']]]],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Minute statement', () => {
				sqlEquals(result.query, `SELECT EXTRACT('MINUTE' FROM $1)`);
			});
		},
	);
});

describe('Second', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Second', ['Date', '2022-10-10T10:10:10.000Z']]]],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid extract second statement', () => {
				sqlEquals(result.query, `SELECT FLOOR(EXTRACT('SECOND' FROM $1))`);
			});
		},
	);
});

describe('Fractionalseconds', () => {
	test(
		[
			'SelectQuery',
			['Select', [['Fractionalseconds', ['Date', '2022-10-10T10:10:10.000Z']]]],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid extract Fractionalseconds statement', () => {
				sqlEquals(
					result.query,
					`SELECT EXTRACT('SECOND' FROM $1) - FLOOR(EXTRACT('SECOND' FROM $1))`,
				);
			});
		},
	);
});

describe('Totalseconds', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Totalseconds',
						[
							'Duration',
							{
								day: 1,
							},
						],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Totalseconds statement', () => {
				sqlEquals(
					result.query,
					`SELECT EXTRACT(EPOCH FROM INTERVAL '1 0:0:0.0')`,
				);
			});
		},
	);
});

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

describe('Duration', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Duration',
						{
							negative: false,
							day: 1,
							hour: 2,
							minute: 3,
							second: 4,
						},
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid Duration statement', () => {
				sqlEquals(result.query, `SELECT INTERVAL '1 2:3:4.0'`);
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

describe('Round', () => {
	test(
		['SelectQuery', ['Select', [['Round', ['Number', 10.4]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Round statement', () => {
				sqlEquals(result.query, `SELECT ROUND(10.4)`);
			});
		},
	);
});

describe('Floor', () => {
	test(
		['SelectQuery', ['Select', [['Floor', ['Number', 10.4]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Floor statement', () => {
				sqlEquals(result.query, `SELECT FLOOR(10.4)`);
			});
		},
	);
});

describe('Ceiling', () => {
	test(
		['SelectQuery', ['Select', [['Ceiling', ['Number', 10.4]]]]],
		(result, sqlEquals) => {
			it('should produce a valid Ceiling statement', () => {
				sqlEquals(result.query, `SELECT CEILING(10.4)`);
			});
		},
	);
});

describe('ToDate', () => {
	test(
		['SelectQuery', ['Select', [['ToDate', ['Date', '2022-10-10']]]]],
		[['Date', '2022-10-10']],
		(result, sqlEquals) => {
			it('should produce a valid ToDate statement', () => {
				sqlEquals(result.query, `SELECT DATE($1)`);
			});
		},
	);
});

describe('DateTrunc', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[['DateTrunc', ['EmbeddedText', 'year'], ['Date', '2022-10-10']]],
			],
		],
		[['Date', '2022-10-10']],
		(result, sqlEquals) => {
			it('should produce a valid DateTrunc statement', () => {
				sqlEquals(result.query, `SELECT DATE_TRUNC('year', $1)`);
			});
		},
	);
});

describe('ToTime', () => {
	test(
		[
			'SelectQuery',
			['Select', [['ToTime', ['Date', '2022-10-10T10:10:10.000Z']]]],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid ToTime statement', () => {
				sqlEquals(result.query, `SELECT CAST($1 AS TIME)`);
			});
		},
	);
});
