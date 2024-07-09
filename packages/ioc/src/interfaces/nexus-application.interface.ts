import type { InjectionToken } from "./injection-token.interface";
import type { ModulePluginInterface } from "./plugins/module-plugin.interface";

export interface NexusApplicationInterface extends ModulePluginInterface {
	bootstrap(): Promise<this>;
	get<T>(token: InjectionToken): Promise<T | undefined>;
}
