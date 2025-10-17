import type { DynamicModule } from "../dynamic-module.interface";
import type { Module } from "../module-types.interface";
import type { ContainerBaseInterface } from "./container.interface";
import type { ModuleContainerInterface } from "./module-container.interface";

export interface ModuleContainerFactoryInterface {
	create(
		module: Module | DynamicModule,
		container: ContainerBaseInterface,
	): Promise<ModuleContainerInterface>;
}
