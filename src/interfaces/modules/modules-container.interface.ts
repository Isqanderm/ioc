import type { Module } from "../module-types.interface";
import type { ModuleContainerInterface } from "./module-container.interface";

export interface ModulesContainerInterface {
	addModule(module: Module): Promise<ModuleContainerInterface>;
	replaceModule(
		moduleToReplace: Module,
		newModule: Module,
	): Promise<ModuleContainerInterface>;
	getModule(module: Module): ModuleContainerInterface | undefined;
}
