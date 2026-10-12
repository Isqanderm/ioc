import type { ProviderToken } from "../interfaces";
import { formatToken } from "./provider-errors";

/** inject() was called while no provider was being created. */
export class InjectionContextError extends Error {
	constructor(public readonly token: ProviderToken) {
		super(
			`inject(${formatToken(token)}) was called outside of an injection context. inject() only works synchronously while the container creates a provider: in field initializers, constructor bodies and factory functions.`,
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
