// biome-ignore lint/complexity/noBannedTypes: <explanation>
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export interface Type<T = any> extends Function {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	new (...args: any[]): T;
}

