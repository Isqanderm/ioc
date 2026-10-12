import type { ProviderToken } from "../interfaces";
import { formatToken } from "./provider-errors";

/** inject() was called while no provider was being created. */
export class InjectionContextError extends Error {
	constructor(public readonly token: ProviderToken) {
		super(
			`inject(${formatToken(token)}) was called outside of an injection context. inject() only works synchronously while the container creates a provider: in field initializers, constructor bodies and factory functions (before the first await).`,
		);
		this.name = "InjectionContextError";
		Object.setPrototypeOf(this, InjectionContextError.prototype);
	}
}

/** A dependency cycle that passes through inject() or the synchronous creation path. */
export class CircularInjectionError extends Error {
	constructor(public readonly path: ProviderToken[]) {
		super(
			`Circular dependency via inject(): ${path.map(formatToken).join(" -> ")}`,
		);
		this.name = "CircularInjectionError";
		Object.setPrototypeOf(this, CircularInjectionError.prototype);
	}
}

/** inject() reached a provider whose factory is async and that is not created yet. */
export class AsyncProviderInjectionError extends Error {
	/**
	 * @param path The resolution chain that reached the provider, outermost
	 *   first and ending with `token`; shown in the message when it has more
	 *   than one entry.
	 */
	constructor(
		public readonly token: ProviderToken,
		public readonly path: ProviderToken[] = [],
	) {
		const via =
			path.length > 1 ? ` (via ${path.map(formatToken).join(" -> ")})` : "";
		super(
			`Provider "${formatToken(token)}" has an async factory and is not created yet${via}; inject() is synchronous. Inject it with @Inject() instead, or make sure it is created first.`,
		);
		this.name = "AsyncProviderInjectionError";
		Object.setPrototypeOf(this, AsyncProviderInjectionError.prototype);
	}
}
