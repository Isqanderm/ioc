import type { InjectionToken } from "./injection-token.interface";
import type { Scope } from "./scope.interface";
import type { Type } from "./type.interface";

/**
 * Represents a module class.
 */
export type Module = Type;

/**
 * Represents a provider that can be registered in a module.
 *
 * A provider can be:
 * - A class decorated with @Injectable()
 * - A ClassProvider (provides a different class than the token)
 * - A ValueProvider (provides a static value)
 * - A FactoryProvider (provides a value from a factory function)
 *
 * @template T - The type of value the provider creates
 *
 * @example
 * ```typescript
 * // Class provider (shorthand)
 * @NsModule({
 *   providers: [UserService]
 * })
 *
 * // ClassProvider (explicit)
 * @NsModule({
 *   providers: [
 *     { provide: UserService, useClass: MockUserService }
 *   ]
 * })
 *
 * // ValueProvider
 * @NsModule({
 *   providers: [
 *     { provide: 'CONFIG', useValue: { apiUrl: 'https://api.example.com' } }
 *   ]
 * })
 *
 * // FactoryProvider
 * @NsModule({
 *   providers: [
 *     {
 *       provide: 'DATABASE',
 *       useFactory: (config: Config) => createDatabase(config),
 *       inject: ['CONFIG']
 *     }
 *   ]
 * })
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: provider type interface
export type Provider<T = any> =
	| ClassProvider<T>
	| ValueProvider<T>
	| FactoryProvider<T>
	| Type<T>;

/**
 * Provides a class instance, potentially different from the injection token.
 *
 * Use this when you want to:
 * - Provide a mock or alternative implementation
 * - Use a different class than the token
 * - Override a provider in a specific module
 *
 * @template T - The type of instance to create
 *
 * @example
 * ```typescript
 * @NsModule({
 *   providers: [
 *     // Provide MockUserService when UserService is requested
 *     {
 *       provide: UserService,
 *       useClass: MockUserService,
 *       scope: Scope.Singleton
 *     }
 *   ]
 * })
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: provider interface
export interface ClassProvider<T = any> {
	/** The injection token to register this provider under */
	provide: InjectionToken;
	/** The class to instantiate */
	useClass: Type<T>;
	/** The lifecycle scope (default: Singleton) */
	scope?: Scope;
}

/**
 * Provides a static value.
 *
 * Use this for:
 * - Configuration objects
 * - Constants
 * - Pre-created instances
 * - Primitive values (including null and undefined)
 *
 * Value providers are always singleton scope.
 *
 * @template T - The type of value to provide
 *
 * @example
 * ```typescript
 * @NsModule({
 *   providers: [
 *     { provide: 'API_URL', useValue: 'https://api.example.com' },
 *     { provide: 'MAX_RETRIES', useValue: 3 },
 *     { provide: 'CONFIG', useValue: { debug: true } },
 *     { provide: 'OPTIONAL_VALUE', useValue: null }
 *   ]
 * })
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: provider interface
export interface ValueProvider<T = any> {
	/** The injection token to register this provider under */
	provide: InjectionToken;
	/** The value to provide */
	useValue: T;
}

/**
 * Provides a value created by a factory function.
 *
 * Use this when:
 * - The value requires complex initialization logic
 * - The value depends on other providers
 * - You need to create the value dynamically
 * - You want to return a Promise for async initialization
 *
 * @template T - The type of value the factory creates
 *
 * @example
 * ```typescript
 * @NsModule({
 *   providers: [
 *     {
 *       provide: 'DATABASE',
 *       useFactory: async (config: Config) => {
 *         const db = await createConnection(config.dbUrl);
 *         await db.migrate();
 *         return db;
 *       },
 *       inject: ['CONFIG'],
 *       scope: Scope.Singleton
 *     },
 *     {
 *       provide: 'LOGGER',
 *       useFactory: () => createLogger({ level: 'info' })
 *     }
 *   ]
 * })
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: provider interface
export interface FactoryProvider<T = any> {
	/** The injection token to register this provider under */
	provide: InjectionToken;
	/** The factory function that creates the value */
	// biome-ignore lint/suspicious/noExplicitAny: factory function interface
	useFactory: (...args: any[]) => T | Promise<T>;
	/** Tokens of dependencies to inject into the factory function */
	inject?: InjectionToken[];
	/** The lifecycle scope (default: Singleton) */
	scope?: Scope;
}
