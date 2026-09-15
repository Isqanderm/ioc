import type { DynamicModule } from "./dynamic-module.interface";
import type { InjectionToken } from "./injection-token.interface";
import type { Provider } from "./module-types.interface";
import type { Type } from "./type.interface";

export interface ModuleMetadata {
	imports?: (Type | DynamicModule)[];
	exports?: (InjectionToken | Type)[];
	providers?: Provider[];
}
