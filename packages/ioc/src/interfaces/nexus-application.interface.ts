import type { GetOptions, LazyModule } from "@nexus-ioc/shared";
import type { ModuleRef } from "../core/module-ref";
import type { DynamicModule } from "./dynamic-module.interface";
import type { ProviderToken } from "./injection-token.interface";
import type { CreateChildOptions, GraphError, UnloadResult } from "./modules";
import type { ModulePluginInterface } from "./plugins";
import type { Type } from "./type.interface";

export interface BootstrapOptions {
	throwOnError?: boolean;
}

export type { GetOptions } from "@nexus-ioc/shared";

export interface NexusApplicationInterface extends ModulePluginInterface {
	bootstrap(options?: BootstrapOptions): Promise<this>;
	close(): Promise<void>;
	/**
	 * Returns an already created singleton. `T` is inferred from class and
	 * `InjectionToken<T>` tokens; string and symbol tokens give `unknown`
	 * unless `<T>` is passed or the expected type supplies it.
	 *
	 * @param token - The provider token: class, InjectionToken, string or symbol
	 */
	get<T>(token: ProviderToken<T>): T;
	get<T>(token: ProviderToken<T>, options: { optional: true }): T | undefined;
	get<T>(token: ProviderToken<T>, options: { optional?: false }): T;
	get<T>(token: ProviderToken<T>, options: GetOptions): T | undefined;
	/**
	 * Resolves a provider, creating it on demand (Transient, lazy
	 * mode). `T` is inferred from the token as for `get()`.
	 *
	 * @param token - The provider token: class, InjectionToken, string or symbol
	 */
	resolve<T>(token: ProviderToken<T>): Promise<T>;
	resolve<T>(
		token: ProviderToken<T>,
		options: { optional: true },
	): Promise<T | undefined>;
	resolve<T>(
		token: ProviderToken<T>,
		options: { optional?: false },
	): Promise<T>;
	resolve<T>(
		token: ProviderToken<T>,
		options: GetOptions,
	): Promise<T | undefined>;
	load(lazyModule: LazyModule): Promise<ModuleRef>;
	unload(ref: ModuleRef): Promise<UnloadResult>;
	/**
	 * Creates a bootstrapped child application for a module declared in
	 * `@Module({ children })` of this application's graph.
	 */
	createChild(
		child: Type | DynamicModule | LazyModule,
		options?: CreateChildOptions,
	): Promise<NexusApplicationInterface>;
	lazy(): this;
	errors: GraphError[];
}
