import type { DynamicModule } from "../dynamic-module.interface";
import type { InjectionToken } from "../injection-token.interface";
import type { Module, Provider } from "../module-types.interface";
import type { Type } from "../type.interface";

export interface ModuleContainerHelpersInterface {
	getModuleToken(module: Module | DynamicModule): InjectionToken | undefined;
	getProviderToken(provider: Provider): InjectionToken | undefined;
	createProviderToken(provider: Provider): Promise<InjectionToken>;
	getConstructorDependencies(
		provider: Provider,
	): { index: number; lazy: boolean; param: Type<unknown> }[];
	getPropertiesDependencies(
		provider: Provider,
	): { key: string; lazy: boolean; type: Type<unknown> }[];
}
