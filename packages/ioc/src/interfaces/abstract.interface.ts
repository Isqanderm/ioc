// biome-ignore lint/complexity/noBannedTypes: Function type needed for abstract interface
export interface Abstract<T> extends Function {
	prototype: T;
}
