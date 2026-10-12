import type { GetOptions, LazyModule } from "@nexus-ioc/shared";
import type { ModuleRef } from "../core/module-ref";
import type { ProviderToken } from "./injection-token.interface";
import type { GraphError, UnloadResult } from "./modules";
import type { ModulePluginInterface } from "./plugins";

export interface BootstrapOptions {
	throwOnError?: boolean;
}

export type { GetOptions } from "@nexus-ioc/shared";

export interface NexusApplicationInterface extends ModulePluginInterface {
	bootstrap(options?: BootstrapOptions): Promise<this>;
	close(): Promise<void>;
	get<T>(token: ProviderToken<T>): T;
	get<T>(token: ProviderToken<T>, options: { optional: true }): T | undefined;
	get<T>(token: ProviderToken<T>, options: { optional?: false }): T;
	get<T>(token: ProviderToken<T>, options: GetOptions): T | undefined;
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
	setParent(parentContainer: NexusApplicationInterface): this;
	lazy(): this;
	errors: GraphError[];
}
