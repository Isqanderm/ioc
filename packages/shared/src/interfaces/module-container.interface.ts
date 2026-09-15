import type { DynamicModule } from "./dynamic-module.interface";
import type { GraphError } from "./graph-error.interface";
import type { InjectionToken } from "./injection-token.interface";
import type { LazyModule } from "./lazy-module.interface";
import type { Module, Provider } from "./module-types.interface";

export interface ModuleContainerInterface {
	token: string;
	metatype: Module | DynamicModule;
	imports: Promise<ModuleContainerInterface[]>;
	/** Lazy imports declared by this module; never registered until loaded. */
	lazyImports: LazyModule[];
	providers: Provider[];
	exports: (InjectionToken | Module)[];
	get<T>(token: InjectionToken): Promise<T | undefined>;
	errors: GraphError[];
}
