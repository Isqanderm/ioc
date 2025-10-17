// biome-ignore lint/complexity/noBannedTypes: Function type needed for constructor interface
// biome-ignore lint/suspicious/noExplicitAny: constructor interface
export interface Type<T = any> extends Function {
	// biome-ignore lint/suspicious/noExplicitAny: constructor interface
	new (...args: any[]): T;
}
