import type { DynamicModule } from "../dynamic-module.interface";
import type { Type } from "../type.interface";
import type { ContainerBaseInterface } from "./container.interface";
import type { ModuleContainerInterface } from "./module-container.interface";

export interface ModuleContainerFactoryInterface {
	create(
		module: Type | DynamicModule,
		container: ContainerBaseInterface,
	): Promise<ModuleContainerInterface>;
}
