import type { LazyModule } from "@nexus-ioc/shared";
import type { DynamicModule } from "./dynamic-module.interface";
import type { InjectionToken } from "./injection-token.interface";
import type { Provider } from "./module-types.interface";
import type { Type } from "./type.interface";

export type { LazyModule } from "@nexus-ioc/shared";

export interface ModuleMetadata {
	imports?: (Type | DynamicModule | LazyModule)[];
	exports?: (InjectionToken | Type)[];
	providers?: Provider[];
}
