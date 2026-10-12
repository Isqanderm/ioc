import type { LazyModule } from "@nexus-ioc/shared";
import type { DynamicModule } from "./dynamic-module.interface";
import type { ProviderToken } from "./injection-token.interface";
import type { Provider } from "./module-types.interface";
import type { Type } from "./type.interface";

export type { LazyModule } from "@nexus-ioc/shared";

export interface ModuleMetadata {
	imports?: (Type | DynamicModule | LazyModule)[];
	exports?: (ProviderToken | Type)[];
	providers?: Provider[];
	/**
	 * Modules that are not part of this graph but may later be instantiated as
	 * child containers. Static declaration only; never compiled into the parent.
	 */
	children?: (Type | LazyModule)[];
}
