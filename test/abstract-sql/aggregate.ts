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
			it('should produce a valid addition statement', () => {
				sqlEquals(result.query, 'SELECT 5 + 3');
			});
		},
	);
});

describe('Subtract', () => {
	test(
		['SelectQuery', ['Select', [['Subtract', ['Number', 5], ['Number', 3]]]]],
		(result, sqlEquals) => {
			it('should produce a valid subtraction statement', () => {
				sqlEquals(result.query, 'SELECT 5 - 3');
			});
		},
	);
});

describe('Multiply', () => {
	test(
		['SelectQuery', ['Select', [['Multiply', ['Number', 5], ['Number', 3]]]]],
		(result, sqlEquals) => {
			it('should produce a valid multiplication statement', () => {
				sqlEquals(result.query, 'SELECT 5 * 3');
			});
		},
	);
});

describe('Divide', () => {
	test(
		['SelectQuery', ['Select', [['Divide', ['Number', 10], ['Number', 5]]]]],
		(result, sqlEquals) => {
			it('should produce a valid division statement', () => {
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
			it('should produce a valid extract year statement', () => {
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
			it('should produce a valid extract month statement', () => {
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
			it('should produce a valid extract day statement', () => {
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
			it('should produce a valid extract hour statement', () => {
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
			it('should produce a valid extract minute statement', () => {
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
			it('should produce a valid extract fractionalseconds statement', () => {
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
			it('should produce a valid interval statement', () => {
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
			it('should produce a valid concatenate statement', () => {
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
			it('should produce a valid concatenate with separator statement', () => {
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
			it('should produce a valid replace statement', () => {
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
			it('should produce a valid character length statement', () => {
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
			it('should produce a valid string position statement', () => {
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
			it('should produce a valid interval statement', () => {
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
			it('should produce a valid substring statement', () => {
				sqlEquals(result.query, `SELECT SUBSTRING('foobar', 0, 5)`);
			});
		},
	);
});
