import type { DynamicModule } from "../dynamic-module.interface";
import type { Module } from "../module-types.interface";

export interface ModuleTokenFactoryInterface {
	create(metatype: Module | DynamicModule): Promise<string>;
}
