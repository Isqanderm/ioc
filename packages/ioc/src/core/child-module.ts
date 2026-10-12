import "reflect-metadata";
import {
	type DynamicModule,
	MODULE_METADATA,
	type Provider,
	type Type,
} from "../interfaces";
import { isDynamicModule } from "../utils/helpers";

/**
 * Returns `module` with `providers` appended to its root providers, as a
 * `DynamicModule`. A `Type` keeps its decorator imports and exports. Returns
 * `module` itself when there is nothing to add.
 */
export function withExtraProviders(
	module: Type | DynamicModule,
	providers: Provider[] | undefined,
): Type | DynamicModule {
	if (!providers || providers.length === 0) {
		return module;
	}
	if (isDynamicModule(module)) {
		return {
			...module,
			providers: [...(module.providers ?? []), ...providers],
		};
	}
	return {
		module,
		imports: Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) ?? [],
		providers: [
			...(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module) ?? []),
			...providers,
		],
		exports: Reflect.getMetadata(MODULE_METADATA.EXPORTS, module) ?? [],
	};
}
