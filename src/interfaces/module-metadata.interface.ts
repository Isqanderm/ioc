import type { InjectionToken } from "./injection-token.interface";
import type { Module, Provider } from "./module-types.interface";

export interface ModuleMetadata {
	imports?: Module[];
	exports?: InjectionToken[];
	providers?: Provider[];
}
