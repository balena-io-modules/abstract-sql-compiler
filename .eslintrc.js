module.exports = {
	extends: ['./node_modules/@balena/lint/config/.eslintrc.js'],
	parserOptions: {
		project: 'tsconfig.js.json',
		sourceType: 'module',
	},
	env: {
		// TODO: Drop this once we convert all .js tests to .ts
		mocha: true,
	},
	root: true,
};
