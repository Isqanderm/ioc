import type { InjectionToken } from "./injection-token.interface";
import type { Module, Provider } from "./module-types.interface";

export interface DynamicModule {
	global?: true;
	module: Module & {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		forRoot?: (...args: any[]) => DynamicModule;
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		forFeature?: (...args: any[]) => DynamicModule;
	};
	providers?: Provider[];
	exports?: InjectionToken[];
	imports?: (Module | DynamicModule)[];
}
