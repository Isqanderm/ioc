import type { DynamicModule } from "../dynamic-module.interface";
import type { Type } from "../type.interface";
import type { ModuleContainerInterface } from "./module-container.interface";

export interface ModulesContainerInterface {
	addModule(module: Type | DynamicModule): Promise<ModuleContainerInterface>;
	replaceModule(
		moduleToReplace: Type,
		newModule: Type,
	): Promise<ModuleContainerInterface>;
	getModule(module: Type): ModuleContainerInterface | undefined;
}
