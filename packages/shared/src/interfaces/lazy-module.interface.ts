import type { DynamicModule } from "./dynamic-module.interface";
import type { Module } from "./module-types.interface";

/**
 * A lazily loaded module import. Created with `lazy()` from `@nexus-ioc/core`.
 * The module class is not imported until `NexusApplication.load(ref)` runs.
 */
export interface LazyModule<T extends Module = Module> {
	/** Unique identity of this lazy boundary; used as the graph node key. */
	readonly id: symbol;
	/** Human-readable name for diagnostics and chunk naming. */
	readonly name: string;
	/** Runs the dynamic import and returns the module class or a DynamicModule. */
	readonly load: () => Promise<T | DynamicModule>;
}
