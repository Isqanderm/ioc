import type { DynamicModule } from "../dynamic-module.interface";
import type { InjectionToken } from "../injection-token.interface";
import type { Module } from "../module-types.interface";
import type { GraphPluginInterface } from "../plugins";
import type { ModuleContainerInterface } from "./module-container.interface";
import type { ModuleGraphInterface } from "./module-graph.interface";

export interface ContainerBaseInterface {
	addModule(module: Module | DynamicModule): Promise<ModuleContainerInterface>;
	replaceModule(
		moduleToReplace: Module,
		newModule: Module,
	): Promise<ModuleContainerInterface>;
	getModule(module: Module): Promise<ModuleContainerInterface | undefined>;
	get<T>(token: InjectionToken): Promise<T | undefined>;
	parent(parentContainer: ContainerBaseInterface): this;
}

export interface ContainerInterface extends ContainerBaseInterface {
	run(rootModule: Module, graphPlugins: GraphPluginInterface[]): Promise<void>;
	graph: ModuleGraphInterface;
}
