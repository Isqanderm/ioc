import type { DynamicModule } from "./dynamic-module.interface";
import type { GetOptions } from "./get-options.interface";
import type { GraphError } from "./graph-error.interface";
import type { ProviderToken } from "./injection-token.interface";
import type { LazyModule } from "./lazy-module.interface";
import type { Module, Provider } from "./module-types.interface";

export interface ModuleContainerInterface {
	token: string;
	metatype: Module | DynamicModule;
	imports: Promise<ModuleContainerInterface[]>;
	/** Set once `imports` has resolved at least once. */
	resolvedImports: ModuleContainerInterface[] | undefined;
	/** Lazy imports declared by this module; never registered until loaded. */
	lazyImports: LazyModule[];
	providers: Provider[];
	exports: (ProviderToken | Module)[];
	/**
	 * Synchronously returns an already-created singleton.
	 * Throws `ProviderNotFoundError` for an unknown token unless `optional`.
	 */
	get<T>(token: ProviderToken): T;
	get<T>(token: ProviderToken, options: { optional: true }): T | undefined;
	get<T>(token: ProviderToken, options: { optional?: false }): T;
	get<T>(token: ProviderToken, options: GetOptions): T | undefined;
	/**
	 * Resolves a provider asynchronously, creating it according to its scope.
	 * Rejects with `ProviderNotFoundError` for an unknown token unless `optional`.
	 */
	resolve<T>(token: ProviderToken): Promise<T>;
	resolve<T>(
		token: ProviderToken,
		options: { optional: true },
	): Promise<T | undefined>;
	resolve<T>(token: ProviderToken, options: { optional?: false }): Promise<T>;
	resolve<T>(token: ProviderToken, options: GetOptions): Promise<T | undefined>;
	errors: GraphError[];
}
