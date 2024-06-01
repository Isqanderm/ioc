import type { InjectionToken } from "../injection-token.interface";
import type { Module } from "../module-types.interface";
import type { ModuleContainerInterface } from "./module-container.interface";
import type { ModuleGraphInterface } from "./module-graph.interface";

export interface ContainerBaseInterface {
	addModule(module: Module): Promise<ModuleContainerInterface>;
	replaceModule(
		moduleToReplace: Module,
		newModule: Module,
	): Promise<ModuleContainerInterface | null>;
	getModule(module: Module): Promise<ModuleContainerInterface | undefined>;
	get<T>(token: InjectionToken): Promise<T | undefined>;
}

export interface ContainerInterface extends ContainerBaseInterface {
	run(rootModule: Module): Promise<void>;
	graph: ModuleGraphInterface;
}
