import { InjectionContextError } from "../../errors/injection-errors";
import type { ProviderToken } from "../../interfaces";

export interface InjectOptions {
	/** Return undefined instead of throwing when the token is not available. */
	optional?: boolean;
}

export interface InjectionContext {
	inject(token: ProviderToken, options: InjectOptions): unknown;
}

let current: InjectionContext | null = null;

/**
 * Runs `fn` with `ctx` as the current injection context and restores the
 * previous one afterwards, even if `fn` throws.
 *
 * @internal Not exported from the package entry point.
 */
export function withInjectionContext<R>(ctx: InjectionContext, fn: () => R): R {
	const previous = current;
	current = ctx;
	try {
		return fn();
	} finally {
		current = previous;
	}
}

/**
 * Returns the provider for `token` from the container that is currently
 * creating an instance. Callable only synchronously during creation: in
 * field initializers, constructor bodies and the synchronous part of a
 * factory.
 *
 * @throws {InjectionContextError} When called outside of an injection context
 * @throws {ProviderNotFoundError} When the token is not visible to the requester and `optional` is not set
 * @throws {CircularInjectionError} When the token is already being created in this resolution
 * @throws {AsyncProviderInjectionError} When the token has an async factory and is not created yet
 */
export function inject<T>(token: ProviderToken<T>): T;
export function inject<T>(
	token: ProviderToken<T>,
	options: { optional: true },
): T | undefined;
export function inject<T>(
	token: ProviderToken<T>,
	options: InjectOptions,
): T | undefined;
export function inject<T>(
	token: ProviderToken<T>,
	options: InjectOptions = {},
): T | undefined {
	if (!current) {
		throw new InjectionContextError(token);
	}
	return current.inject(token, options) as T | undefined;
}
