import type { ProviderToken } from "../interfaces";
import { Scope } from "../interfaces";

export function formatToken(token: ProviderToken): string {
	if (typeof token === "function") {
		return token.name || "<anonymous class>";
	}
	return String(token);
}

/** No provider with this token exists in the container or any parent. */
export class ProviderNotFoundError extends Error {
	constructor(
		public readonly token: ProviderToken,
		public readonly requestedBy?: ProviderToken,
	) {
		super(
			`No provider found for token "${formatToken(token)}".${
				requestedBy === undefined
					? ""
					: ` (requested by "${formatToken(requestedBy)}" via inject())`
			}`,
		);
		this.name = "ProviderNotFoundError";
		Object.setPrototypeOf(this, ProviderNotFoundError.prototype);
	}
}

/** The singleton exists but has not been created yet (lazy mode or not loaded). */
export class ProviderNotInstantiatedError extends Error {
	constructor(public readonly token: ProviderToken) {
		super(
			`Provider "${formatToken(token)}" is not instantiated yet. Use resolve() to create it, or bootstrap without lazy().`,
		);
		this.name = "ProviderNotInstantiatedError";
		Object.setPrototypeOf(this, ProviderNotInstantiatedError.prototype);
	}
}

/** get() only serves singletons; Transient providers are created per call. */
export class ProviderScopeError extends Error {
	constructor(
		public readonly token: ProviderToken,
		public readonly scope: Scope,
	) {
		super(
			`Provider "${formatToken(token)}" has scope ${Scope[scope] ?? String(scope)}; get() only returns singletons. Use resolve() instead.`,
		);
		this.name = "ProviderScopeError";
		Object.setPrototypeOf(this, ProviderScopeError.prototype);
	}
}

/** The application was closed; it can no longer provide instances. */
export class ContainerClosedError extends Error {
	constructor() {
		super("The container is closed.");
		this.name = "ContainerClosedError";
		Object.setPrototypeOf(this, ContainerClosedError.prototype);
	}
}

/** A useFactory returned a promise; factories must be synchronous. */
export class AsyncFactoryError extends Error {
	constructor(public readonly token: ProviderToken) {
		super(
			`Provider "${formatToken(token)}": useFactory must return the value synchronously; move async setup into onModuleInit of the provided class, or create the value before bootstrap and register it with useValue.`,
		);
		this.name = "AsyncFactoryError";
		Object.setPrototypeOf(this, AsyncFactoryError.prototype);
	}
}
