import type { DynamicModule } from "../dynamic-module.interface";
import type { InjectionToken } from "../injection-token.interface";
import type { Module, Provider } from "../module-types.interface";

export interface ModuleContainerInterface {
	token: string;
	metatype: Module | DynamicModule;
	imports: Promise<ModuleContainerInterface[]>;
	providers: Provider[];
	exports: InjectionToken[];
	get<T>(token: InjectionToken): Promise<T | undefined>;
}
