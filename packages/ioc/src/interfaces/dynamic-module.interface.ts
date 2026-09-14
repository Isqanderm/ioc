import type { InjectionToken } from "./injection-token.interface";
import type { Provider } from "./module-types.interface";
import type { Type } from "./type.interface";

export interface DynamicModule {
	module: Type & {
		forRoot?: () => DynamicModule;
		forRootAsync?: () => DynamicModule;
		forFeature?: () => DynamicModule;
		forFeatureAsync?: () => DynamicModule;
	};
	providers?: Provider[];
	exports?: InjectionToken[];
	imports?: (Type | DynamicModule)[];
}
