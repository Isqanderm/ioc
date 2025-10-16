// biome-ignore lint/complexity/noBannedTypes: <explanation>
export interface Abstract<T> extends Function {
	prototype: T;
}

