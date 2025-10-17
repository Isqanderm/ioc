// biome-ignore lint/complexity/noBannedTypes: Function type is required for class constructor representation
// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter allows any class type
export interface Type<T = any> extends Function {
	// biome-ignore lint/suspicious/noExplicitAny: Constructor arguments can be of any type from DI container
	new (...args: any[]): T;
}
