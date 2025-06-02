import type { InjectionToken } from "./injection-token.interface";
import type { GraphError } from "./modules";
import type { ModulePluginInterface } from "./plugins";

export interface NexusApplicationInterface extends ModulePluginInterface {
	bootstrap(): Promise<this>;
	get<T>(token: InjectionToken): Promise<T | undefined>;
	setParent(parentContainer: NexusApplicationInterface): this;
	async(): this;
	errors: GraphError[];
}
