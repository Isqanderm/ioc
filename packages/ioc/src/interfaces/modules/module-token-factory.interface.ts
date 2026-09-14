import type { DynamicModule } from "../dynamic-module.interface";
import type { Type } from "../type.interface";

export interface ModuleTokenFactoryInterface {
	create(metatype: Type | DynamicModule): Promise<string>;
}
