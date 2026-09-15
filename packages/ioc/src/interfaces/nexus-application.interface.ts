import type { InjectionToken } from "./injection-token.interface";
import type { GraphError } from "./modules";
import type { ModulePluginInterface } from "./plugins";

export interface BootstrapOptions {
	throwOnError?: boolean;
}

export interface NexusApplicationInterface extends ModulePluginInterface {
	bootstrap(options?: BootstrapOptions): Promise<this>;
	close(): Promise<void>;
	get<T>(token: InjectionToken): Promise<T | undefined>;
	setParent(parentContainer: NexusApplicationInterface): this;
	lazy(): this;
	errors: GraphError[];
}
