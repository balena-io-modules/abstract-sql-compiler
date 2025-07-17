import test from './test.js';

describe('Year', () => {
	test(
		['SelectQuery', ['Select', [['Year', ['Date', '2022-10-10']]]]],
		[['Date', '2022-10-10']],
		(result, sqlEquals) => {
			it('should produce a valid Year statement', () => {
				sqlEquals(result, `SELECT EXTRACT('YEAR' FROM $1)`);
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
				sqlEquals(result, `SELECT EXTRACT('MONTH' FROM $1)`);
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
				sqlEquals(result, `SELECT EXTRACT('DAY' FROM $1)`);
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
				sqlEquals(result, `SELECT EXTRACT('HOUR' FROM $1)`);
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
				sqlEquals(result, `SELECT EXTRACT('MINUTE' FROM $1)`);
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
				sqlEquals(result, `SELECT FLOOR(EXTRACT('SECOND' FROM $1))`);
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
					result,
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
				sqlEquals(result, `SELECT DATE($1)`);
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
				sqlEquals(result, `SELECT DATE_TRUNC('year', $1)`);
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
						'DateTrunc',
						['EmbeddedText', 'year'],
						['Date', '2022-10-10'],
						['EmbeddedText', 'UTC'],
					],
				],
			],
		],
		[['Date', '2022-10-10']],
		(result, sqlEquals) => {
			it('should produce a valid DateTrunc statement', () => {
				sqlEquals(result, `SELECT DATE_TRUNC('year', $1, 'UTC')`);
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
				sqlEquals(result, `SELECT CAST($1 AS TIME)`);
			});
		},
	);
});

describe('AddDateDuration', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'AddDateDuration',
						['Date', '2022-10-10T10:10:10.000Z'],
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
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Date addition statement', () => {
				sqlEquals(result, `SELECT $1 + INTERVAL '1 0:0:0.0'`);
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
						'AddDateDuration',
						[
							'AddDateDuration',
							['Date', '2022-10-10T10:10:10.000Z'],
							[
								'Duration',
								{
									day: 1,
								},
							],
						],
						[
							'Duration',
							{
								day: 2,
							},
						],
					],
				],
			],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Date addition statement when the first operand returns a Date node', () => {
				sqlEquals(
					result,
					`SELECT ($1 + INTERVAL '1 0:0:0.0') + INTERVAL '2 0:0:0.0'`,
				);
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
				sqlEquals(result, `SELECT $1 + 10`);
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
				sqlEquals(result, `SELECT $1 + (4 - 5)`);
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
				sqlEquals(result, `SELECT $1 - 10`);
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
				sqlEquals(result, `SELECT $1 - (4 - 5)`);
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
						[
							'AddDateNumber',
							['Date', '2022-10-10T10:10:10.000Z'],
							['Number', 1],
						],
						['Subtract', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Date subtraction statement when first operand returns a Date and the second operand is a math operation', () => {
				sqlEquals(result, `SELECT ($1 + 1) - (4 - 5)`);
			});
		},
	);
});

describe('SubtractDateDate', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'Multiply',
						['SubtractDateDate', ['CurrentTimestamp'], ['CurrentTimestamp']],
						['Number', 4],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid multiplication statement when the first operand is a SubtractDateDate operation and the second a number', () => {
				sqlEquals(result, `SELECT (CURRENT_TIMESTAMP - CURRENT_TIMESTAMP) * 4`);
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
						'Multiply',
						['SubtractDateDate', ['CurrentTimestamp'], ['CurrentTimestamp']],
						['Subtract', ['Number', 4], ['Number', 5]],
					],
				],
			],
		],
		(result, sqlEquals) => {
			it('should produce a valid multiplication statement when the first operand is a SubtractDateDate operation and the second a math subtraction', () => {
				sqlEquals(
					result,
					`SELECT (CURRENT_TIMESTAMP - CURRENT_TIMESTAMP) * (4 - 5)`,
				);
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
						'SubtractDateDate',
						[
							'AddDateDuration',
							['CurrentTimestamp'],
							[
								'Duration',
								{
									day: 1,
								},
							],
						],
						[
							'AddDateDuration',
							['Date', '2022-10-10T10:10:10.000Z'],
							[
								'Duration',
								{
									day: 2,
								},
							],
						],
					],
				],
			],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid SubtractDateDate operation when the operands return a Date node', () => {
				sqlEquals(
					result,
					`SELECT (CURRENT_TIMESTAMP + INTERVAL '1 0:0:0.0') - ($1 + INTERVAL '2 0:0:0.0')`,
				);
			});
		},
	);
});

describe('SubtractDateDuration', () => {
	test(
		[
			'SelectQuery',
			[
				'Select',
				[
					[
						'SubtractDateDuration',
						['Date', '2022-10-10T10:10:10.000Z'],
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
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Date subtraction statement', () => {
				sqlEquals(result, `SELECT $1 - INTERVAL '1 0:0:0.0'`);
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
						'SubtractDateDuration',
						[
							'AddDateDuration',
							['Date', '2022-10-10T10:10:10.000Z'],
							[
								'Duration',
								{
									day: 1,
								},
							],
						],
						[
							'Duration',
							{
								day: 2,
							},
						],
					],
				],
			],
		],
		[['Date', '2022-10-10T10:10:10.000Z']],
		(result, sqlEquals) => {
			it('should produce a valid Date subtraction statement when the first operand returns a Date node', () => {
				sqlEquals(
					result,
					`SELECT ($1 + INTERVAL '1 0:0:0.0') - INTERVAL '2 0:0:0.0'`,
				);
			});
		},
	);
});
