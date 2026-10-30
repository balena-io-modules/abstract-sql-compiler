import * as AbstractSQLCompiler from '../../out/abstract-sql-compiler.js';
import { expect } from 'chai';

describe('dataTypeValidate', () => {
	it('should resolve with the validated value for a supported type', async () => {
		expect(
			await AbstractSQLCompiler.postgres.dataTypeValidate('5', {
				dataType: 'Integer',
			}),
		).to.equal(5);
	});

	it('should reject for an unsupported type', async () => {
		let error: unknown;
		try {
			await AbstractSQLCompiler.postgres.dataTypeValidate('5', {
				dataType: 'Not A Type',
			});
		} catch (e) {
			error = e;
		}
		expect(error)
			.to.be.instanceOf(Error)
			.with.property('message', 'is an unsupported type: Not A Type');
	});
});
