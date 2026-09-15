import { BootstrapError } from "../errors";
import {
	type BootstrapOptions,
	type HashUtilInterface,
	type InjectionToken,
	type LazyModule,
	type NexusApplicationInterface,
	NodeTypeEnum,
	type ScannerPluginInterface,
	Scope,
	type Type,
	type UnloadResult,
} from "../interfaces";
import { HashUtil } from "../utils/hash-utils";
import { createInternalModule, LazyModuleLoader } from "./lazy-module-loader";
import { ModuleRef } from "./module-ref";
import { Container } from "./modules/container";

/**
 * NexusApplication is the main application class that provides a high-level
 * API for creating and managing IoC containers.
 *
 * This class wraps the Container and provides additional features:
 * - Automatic singleton initialization
 * - Scanner plugin support for custom metadata processing
 * - Parent-child container hierarchies
 * - Lazy/eager container modes
 *
 * @example
 * ```typescript
 * const app = NexusApplication.create(AppModule);
 * await app.bootstrap();
 * const service = await app.get(MyService);
 * ```
 */
export class NexusApplication implements NexusApplicationInterface {
	private hashUtil: HashUtilInterface = new HashUtil();
	private isAsyncContainer = false;
	private readonly container = new Container(this.hashUtil);
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private _parentContainer: NexusApplicationInterface | null = null;
	private readonly lazyModuleLoader = new LazyModuleLoader((lazyModule) =>
		this.load(lazyModule),
	);

	/**
	 * Creates a new NexusApplication instance.
	 *
	 * @param rootModule - The root module of the application
	 * @param options - Optional configuration
	 * @param options.hashFn - Custom hash function for module identification
	 */
	private constructor(
		private readonly rootModule: Type,
		options?: { hashFn: new () => HashUtilInterface },
	) {
		if (options?.hashFn && typeof options?.hashFn === "function") {
			this.hashUtil = new options.hashFn();
		}
	}

	/**
	 * Creates a new NexusApplication instance.
	 *
	 * This is the main entry point for creating an application.
	 *
	 * @param rootModule - The root module of the application
	 * @param options - Optional configuration
	 * @param options.hashFn - Custom hash function for module identification
	 * @returns A new NexusApplication instance
	 *
	 * @example
	 * ```typescript
	 * const app = NexusApplication.create(AppModule);
	 * await app.bootstrap();
	 * ```
	 */
	static create(
		rootModule: Type,
		options?: { hashFn: new () => HashUtilInterface },
	) {
		return new NexusApplication(rootModule, options);
	}

	/**
	 * Bootstraps the application by initializing the container and all providers.
	 *
	 * This method:
	 * 1. Runs the container with the root module
	 * 2. Executes all registered scanner plugins
	 * 3. Pre-instantiates all singleton providers (unless async mode is enabled)
	 *
	 * @returns A promise that resolves to this instance for method chaining
	 * @throws {Error} If there are circular dependencies or missing providers
	 *
	 * @example
	 * ```typescript
	 * const app = NexusApplication.create(AppModule);
	 * await app.bootstrap();
	 * // Application is now ready to use
	 * ```
	 */
	public async bootstrap(options?: BootstrapOptions): Promise<this> {
		await this.container.run(this.rootModule, [
			createInternalModule(this.lazyModuleLoader),
		]);

		for (const scannerPlugin of this.scannerPlugins) {
			await scannerPlugin.scan(this.container.graph);
		}

		if (this.container.errors.length > 0 && options?.throwOnError !== false) {
			throw new BootstrapError(this.container.errors);
		}

		await this.warmUpSingletons(this.container.graph.nodes.keys());

		return this;
	}

	/**
	 * Pre-instantiates the singleton providers named by `tokens`, unless the
	 * application is running in lazy mode.
	 */
	private async warmUpSingletons(tokens: Iterable<InjectionToken>) {
		if (this.isAsyncContainer) {
			return;
		}
		for (const token of tokens) {
			const node = this.container.graph.getNode(token);
			if (
				node &&
				node.type === NodeTypeEnum.PROVIDER &&
				node.scope === Scope.Singleton
			) {
				await this.container.get(token);
			}
		}
	}

	/**
	 * Closes the application and cleans up resources.
	 *
	 * @returns A promise that resolves when the application is closed
	 *
	 * @example
	 * ```typescript
	 * const app = await NexusApplication.create(AppModule).bootstrap();
	 * await app.close();
	 * ```
	 */
	public async close(): Promise<void> {
		await this.container.close();
	}

	/**
	 * Adds one or more scanner plugins to the application.
	 *
	 * Scanner plugins are executed after the dependency graph is built
	 * and can be used to process custom metadata, validate the graph,
	 * or perform other initialization tasks.
	 *
	 * @param scanner - A single scanner plugin or an array of scanner plugins
	 * @returns This instance for method chaining
	 *
	 * @example
	 * ```typescript
	 * const app = NexusApplication.create(AppModule)
	 *   .addScannerPlugin(new CustomScanner())
	 *   .addScannerPlugin([new Scanner1(), new Scanner2()]);
	 * await app.bootstrap();
	 * ```
	 */
	public addScannerPlugin(
		scanner: ScannerPluginInterface | ScannerPluginInterface[],
	): this {
		const plugins = Array.isArray(scanner) ? scanner : [scanner];
		this.scannerPlugins.push(...plugins);
		return this;
	}

	/**
	 * Resolves and returns an instance of a provider by its injection token.
	 *
	 * If the provider is not found in this container, it will attempt to
	 * resolve it from the parent container (if set).
	 *
	 * @template T - The type of the provider to resolve
	 * @param token - The injection token (class, string, or symbol)
	 * @returns A promise that resolves to the provider instance, or undefined if not found
	 *
	 * @example
	 * ```typescript
	 * const app = await NexusApplication.create(AppModule).bootstrap();
	 * const userService = await app.get(UserService);
	 * const config = await app.get('CONFIG');
	 * ```
	 */
	public async get<T>(token: InjectionToken) {
		const dependency = await this.container.get<T>(token);

		// Check for undefined specifically, not falsy values (null, 0, false, etc. are valid)
		if (dependency === undefined) {
			return this._parentContainer?.get<T>(token);
		}

		return dependency;
	}

	/**
	 * Loads a lazy module declared with `lazy()` into this application's
	 * container and returns a handle to it. Repeated calls for the same ref
	 * return the same providers; the loader runs once.
	 *
	 * @throws {LazyModuleLoadError} if the loader fails or returns a non-module
	 * @throws {LazyModuleGraphError} if the module's dependency graph is invalid
	 */
	public async load(lazyModule: LazyModule): Promise<ModuleRef> {
		const segment = await this.container.load(lazyModule);
		await this.warmUpSingletons(segment.providerTokens);
		return new ModuleRef(this.container, segment);
	}

	/**
	 * Unloads a lazy module previously returned by `load()` (directly or via
	 * `LazyModuleLoader`): destroys every singleton and module nothing else
	 * still needs. A no-op if `ref` is already unloaded.
	 */
	public async unload(ref: ModuleRef): Promise<UnloadResult> {
		return ref.unload();
	}

	/**
	 * Gets all errors that occurred during graph compilation.
	 *
	 * @returns An array of graph errors
	 *
	 * @example
	 * ```typescript
	 * const app = await NexusApplication.create(AppModule).bootstrap();
	 * if (app.errors.length > 0) {
	 *   console.error('Application errors:', app.errors);
	 * }
	 * ```
	 */
	public get errors() {
		return this.container.errors;
	}

	/**
	 * Enables lazy mode for the container.
	 *
	 * In lazy mode, singleton providers are NOT pre-instantiated during
	 * bootstrap. They will be created lazily on first access via get().
	 * This can improve startup time for large applications.
	 *
	 * @returns This instance for method chaining
	 *
	 * @example
	 * ```typescript
	 * const app = NexusApplication.create(AppModule)
	 *   .lazy();
	 * await app.bootstrap(); // Singletons are NOT created yet
	 * const service = await app.get(MyService); // Created on first access
	 * ```
	 */
	public lazy(): this {
		this.isAsyncContainer = true;
		return this;
	}

	/**
	 * Sets a parent container for this application.
	 *
	 * When a provider is not found in this container, it will be looked up
	 * in the parent container. This enables hierarchical container structures.
	 *
	 * @param parentContainer - The parent container
	 * @returns This instance for method chaining
	 *
	 * @example
	 * ```typescript
	 * const parentApp = await NexusApplication.create(ParentModule).bootstrap();
	 * const childApp = await NexusApplication.create(ChildModule)
	 *   .setParent(parentApp)
	 *   .bootstrap();
	 * // childApp can access providers from parentApp
	 * ```
	 */
	public setParent(parentContainer: NexusApplicationInterface) {
		this._parentContainer = parentContainer;
		return this;
	}
}
