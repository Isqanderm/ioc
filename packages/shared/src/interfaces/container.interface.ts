import type { DynamicModule } from "./dynamic-module.interface";
import type { GraphError } from "./graph-error.interface";
import type { ProviderToken } from "./injection-token.interface";
import type { ModuleContainerInterface } from "./module-container.interface";
import type { ModuleGraphInterface } from "./module-graph.interface";
import type { Module } from "./module-types.interface";

export interface ContainerBaseInterface {
	addModule(module: Module | DynamicModule): Promise<ModuleContainerInterface>;
	replaceModule(
		moduleToReplace: Module,
		newModule: Module,
	): Promise<ModuleContainerInterface>;
	getModule(module: Module): Promise<ModuleContainerInterface | undefined>;
	get<T>(token: ProviderToken): T;
	resolve<T>(token: ProviderToken): Promise<T>;
	hasProvider(token: ProviderToken): boolean;
	errors: GraphError[];
}

export interface ContainerInterface extends ContainerBaseInterface {
	run(rootModule: Module): Promise<void>;
	graph: ModuleGraphInterface;
}
