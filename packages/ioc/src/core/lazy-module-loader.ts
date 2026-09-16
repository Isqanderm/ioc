import "reflect-metadata";
import { Global } from "../decorators/global";
import { Module } from "../decorators/module";
import type { DynamicModule, LazyModule, UnloadResult } from "../interfaces";
import type { ModuleRef } from "./module-ref";

/**
 * Built-in provider that lets any service load a lazy module on demand.
 * Registered automatically by `NexusApplication`; inject it with
 * `@Inject(LazyModuleLoader)`.
 */
export class LazyModuleLoader {
	constructor(
		private readonly loadFn: (lazyModule: LazyModule) => Promise<ModuleRef>,
		private readonly unloadFn: (ref: ModuleRef) => Promise<UnloadResult>,
	) {}

	public load(lazyModule: LazyModule): Promise<ModuleRef> {
		return this.loadFn(lazyModule);
	}

	public unload(ref: ModuleRef): Promise<UnloadResult> {
		return this.unloadFn(ref);
	}
}

@Global()
@Module({})
class NexusInternalModule {}

/** Global module carrying the application's built-in providers. */
export function createInternalModule(loader: LazyModuleLoader): DynamicModule {
	return {
		module: NexusInternalModule,
		providers: [{ provide: LazyModuleLoader, useValue: loader }],
		exports: [LazyModuleLoader],
	};
}
