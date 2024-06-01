import type { InjectionToken } from "./injection-token.interface";
import type { Module, Provider } from "./module-types.interface";

export interface DynamicModule {
	module: Module;
	providers?: Provider[];
	exports?: InjectionToken[];
	imports?: Module[];
}
