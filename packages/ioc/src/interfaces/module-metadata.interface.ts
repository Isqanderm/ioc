import type { DynamicModule } from "./dynamic-module.interface";
import type { InjectionToken } from "./injection-token.interface";
import type { Module, Provider } from "./module-types.interface";

export interface ModuleMetadata {
	imports?: (Module | DynamicModule)[];
	exports?: InjectionToken[];
	providers?: Provider[];
}
