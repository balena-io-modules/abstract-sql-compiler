import test from './test.js';

describe('RangeLower', () => {
	test(
		['SelectQuery', ['Select', [['RangeLower', ['Field', 'time_range']]]]],
		(result, sqlEquals) => {
			it('should produce a valid LOWER statement for a range field', () => {
				sqlEquals(result, `SELECT LOWER("time_range")`);
			});
		},
	);
});

describe('RangeUpper', () => {
	test(
		['SelectQuery', ['Select', [['RangeUpper', ['Field', 'time_range']]]]],
		(result, sqlEquals) => {
			it('should produce a valid UPPER statement for a range field', () => {
				sqlEquals(result, `SELECT UPPER("time_range")`);
			});
		},
	);
});
