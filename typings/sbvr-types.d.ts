declare module '@resin/sbvr-types' {
	import * as Promise from 'bluebird';

	type DatabaseType = string | ((necessity: string, index: string) => string);
	const sbvrTypes: {
		[dataType: string]: {
			types: {
				[engine: string]: DatabaseType;
			};
			validate(value: any, required?: boolean): Promise<any>;
		};
	};
	export = sbvrTypes;
}
