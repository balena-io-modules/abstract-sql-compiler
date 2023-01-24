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

describe('AddDateNumber', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'AddDateNumber',
						['Date', '2022-10-10T10:10:10.000Z'],
						['Number', 10],
					],
				],
			],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Date addition statement', () => {
				sqlEquals(result.query, `SELECT $1 + 10`);
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
						'AddDateNumber',
						['Date', '2022-10-10T10:10:10.000Z'],
						['Subtract', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Date addition statement when the second operand is a math operation', () => {
				sqlEquals(result.query, `SELECT $1 + (4 - 5)`);
			});
		},
	);
});

describe('SubtractDateNumber', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'SubtractDateNumber',
						['Date', '2022-10-10T10:10:10.000Z'],
						['Number', 10],
					],
				],
			],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Date subtraction statement', () => {
				sqlEquals(result.query, `SELECT $1 - 10`);
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
						'SubtractDateNumber',
						['Date', '2022-10-10T10:10:10.000Z'],
						['Subtract', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Date subtraction statement when the second operand is a math operation', () => {
				sqlEquals(result.query, `SELECT $1 - (4 - 5)`);
			});
		},
	);
});
