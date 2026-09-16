import type { LazyModule } from "@nexus-ioc/shared";
import type { ModuleRef } from "../core/module-ref";
import type { InjectionToken } from "./injection-token.interface";
import type { GraphError, UnloadResult } from "./modules";
import type { ModulePluginInterface } from "./plugins";

export interface BootstrapOptions {
	throwOnError?: boolean;
}

export interface NexusApplicationInterface extends ModulePluginInterface {
	bootstrap(options?: BootstrapOptions): Promise<this>;
	close(): Promise<void>;
	get<T>(token: InjectionToken): Promise<T | undefined>;
	load(lazyModule: LazyModule): Promise<ModuleRef>;
	unload(ref: ModuleRef): Promise<UnloadResult>;
	setParent(parentContainer: NexusApplicationInterface): this;
	lazy(): this;
	errors: GraphError[];
}
