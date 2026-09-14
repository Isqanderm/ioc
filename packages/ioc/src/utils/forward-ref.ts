export interface ForwardRef<T = unknown> {
	forwardRef: () => T;
}

export function forwardRef<T = unknown>(fn: () => T): ForwardRef<T> {
	return { forwardRef: fn };
}

export function isForwardRef(token: unknown): token is ForwardRef {
	return (
		typeof token === "object" &&
		token !== null &&
		"forwardRef" in token &&
		typeof (token as ForwardRef).forwardRef === "function"
	);
}
