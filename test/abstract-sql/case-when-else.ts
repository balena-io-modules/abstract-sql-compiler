import type { CaseNode, SelectQueryNode } from '../../src/AbstractSQLCompiler';
import test from './test';

const buildSelect = (withElse: boolean): SelectQueryNode => {
	let caseNode: CaseNode = [
		'Case',
		['When', ['Equals', ['Number', -2], ['Number', -2]], ['Text', 'Equal']],
	];
	if (withElse) {
		caseNode = [...caseNode, ['Else', ['Text', 'Not Equal']]];
	}
	return ['SelectQuery', ['Select', [['Alias', caseNode, 'equal_alias']]]];
};

test(
	buildSelect(true),
	[
		['Text', 'Equal'],
		['Text', 'Not Equal'],
	],
	(result, sqlEquals) => {
		it('should produce a valid case statement', () => {
			sqlEquals(
				result,
				`\
SELECT CASE
	WHEN -2 = -2 THEN ?
	ELSE ?
END AS "equal_alias"`,
			);
		});
	},
);

test(buildSelect(false), [['Text', 'Equal']], (result, sqlEquals) => {
	it('should produce a valid case statement without an else', () => {
		sqlEquals(
			result,
			`\
SELECT CASE
	WHEN -2 = -2 THEN ?
END AS "equal_alias"`,
		);
	});
});
