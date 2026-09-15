import type { DynamicModule, LazyModule, Type } from "../interfaces";

export interface LazyModuleOptions {
	/** Name used in diagnostics and, by the Vite plugin, for chunk naming. */
	name?: string;
}

/**
 * Declares a lazily loaded module import.
 *
 * @example
 * ```typescript
 * export const FeatureLazy = lazy(() =>
 *   import("./feature/feature.module").then((m) => m.FeatureModule),
 * );
 *
 * @Module({ imports: [CoreModule, FeatureLazy] })
 * class AppModule {}
 * ```
 */
export function lazy<T extends Type = Type>(
	loader: () => Promise<T | DynamicModule>,
	options: LazyModuleOptions = {},
): LazyModule<T> {
	const name = options.name ?? "LazyModule";
	return Object.freeze({
		id: Symbol(name),
		name,
		load: loader,
	});
}

export function isLazyModule(value: unknown): value is LazyModule {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as LazyModule).id === "symbol" &&
		typeof (value as LazyModule).load === "function" &&
		typeof (value as LazyModule).name === "string"
	);
}
