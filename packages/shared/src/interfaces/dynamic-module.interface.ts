import type { ProviderToken } from "./injection-token.interface";
import type { LazyModule } from "./lazy-module.interface";
import type { Module, Provider } from "./module-types.interface";

export interface DynamicModule {
	module: Module & {
		forRoot?: () => DynamicModule;
		forRootAsync?: () => DynamicModule;
		forFeature?: () => DynamicModule;
		forFeatureAsync?: () => DynamicModule;
	};
	providers?: Provider[];
	exports?: ProviderToken[];
	imports?: (Module | DynamicModule | LazyModule)[];
}
