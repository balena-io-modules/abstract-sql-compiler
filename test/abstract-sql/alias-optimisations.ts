import { stripIndent } from 'common-tags';
import test from './test.js';

describe('Unnecessary aliases should be removed', () => {
	test(
		['SelectQuery', ['Select', []], ['From', ['Alias', ['Table', 't'], 't']]],
		(result, sqlEquals) => {
			it('should simplify `FROM "t" AS "t"` to `FROM "t"`', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT 1
						FROM "t"
					`,
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', [['Alias', ['Field', 'f'], 'f']]],
			['From', ['Alias', ['Table', 't'], 't']],
		],
		(result, sqlEquals) => {
			it('should simplify `SELECT "f" AS "f"` to `SELECT "f"`', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT "f"
						FROM "t"
					`,
				);
			});
		},
	);
	test(
		[
			'SelectQuery',
			['Select', [['Alias', ['ReferencedField', 't', 'f'], 'f']]],
			['From', ['Alias', ['Table', 't'], 't']],
		],
		(result, sqlEquals) => {
			it('should simplify `SELECT "t"."f" AS "f"` to `SELECT "t"."f"`', () => {
				sqlEquals(
					result,
					stripIndent`
						SELECT "t"."f"
						FROM "t"
					`,
				);
			});
		},
	);
});
