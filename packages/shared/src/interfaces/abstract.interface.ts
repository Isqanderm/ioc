// biome-ignore lint/complexity/noBannedTypes: Function type is required for abstract class representation
export interface Abstract<T> extends Function {
	prototype: T;
}
