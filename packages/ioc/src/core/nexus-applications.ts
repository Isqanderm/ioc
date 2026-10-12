import {
	BootstrapError,
	ContainerClosedError,
	ProviderNotFoundError,
} from "../errors";
import {
	type BootstrapOptions,
	type GetOptions,
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
 * const service = app.get(MyService);
 * ```
 */
export class NexusApplication implements NexusApplicationInterface {
	private hashUtil: HashUtilInterface = new HashUtil();
	private isAsyncContainer = false;
	private readonly container = new Container(this.hashUtil);
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private _parentContainer: NexusApplicationInterface | null = null;
	private closePromise: Promise<void> | null = null;
	private readonly pendingLoads = new Set<Promise<unknown>>();
	private readonly lazyModuleLoader = new LazyModuleLoader(
		(lazyModule) => this.load(lazyModule),
		(ref) => this.unload(ref),
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
				await this.container.resolve(token);
			}
		}
	}

	/**
	 * Closes the application and cleans up resources.
	 *
	 * - The closed flag is set synchronously: from this call on, `get`,
	 *   `resolve` and `load` throw `ContainerClosedError`.
	 * - Waits for in-flight lazy loads, then runs on the compile queue so it
	 *   never interleaves with `load`/`unload`.
	 * - Calls every `onModuleDestroy` in reverse creation order, even if some
	 *   throw; failures are collected into a single `AggregateError`.
	 * - Idempotent: later calls return the same promise.
	 * - Detaches the parent. Child applications are NOT closed; services that
	 *   subscribed to parent services must unsubscribe in `onModuleDestroy`.
	 *
	 * @returns A promise that resolves when the application is closed
	 * @throws {AggregateError} If one or more `onModuleDestroy` hooks failed
	 *
	 * @example
	 * ```typescript
	 * const app = await NexusApplication.create(AppModule).bootstrap();
	 * await app.close();
	 * ```
	 */
	public close(): Promise<void> {
		if (!this.closePromise) {
			this.closePromise = this.drainAndClose().finally(() => {
				this._parentContainer = null;
			});
		}
		return this.closePromise;
	}

	/**
	 * Waits for in-flight `load()` calls (including their singleton warm-up)
	 * so nothing is instantiated after the destroy pass, then closes.
	 */
	private async drainAndClose(): Promise<void> {
		await Promise.allSettled([...this.pendingLoads]);
		await this.container.close();
	}

	/** True once `close()` has been called (the app may still be closing). */
	public get isClosed(): boolean {
		return this.closePromise !== null;
	}

	private assertOpen(): void {
		if (this.closePromise) {
			throw new ContainerClosedError();
		}
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
	 * Synchronously returns an already-created singleton provider.
	 *
	 * If the token is not a provider of this application, the parent
	 * application (if set) is asked. A token found locally is always answered
	 * locally, never by the parent.
	 *
	 * @template T - The type of the provider
	 * @param token - The injection token (class, string, or symbol)
	 * @param options - `optional: true` returns undefined instead of throwing when no provider exists
	 * @throws {ProviderNotFoundError} If no provider has this token (unless optional)
	 * @throws {ProviderScopeError} If the provider is Transient or Scoped; use resolve()
	 * @throws {ProviderNotInstantiatedError} If the singleton is not created yet (lazy mode); use resolve()
	 *
	 * @example
	 * ```typescript
	 * const app = await NexusApplication.create(AppModule).bootstrap();
	 * const userService = app.get(UserService);
	 * const config = app.get('CONFIG', { optional: true });
	 * ```
	 */
	public get<T>(token: InjectionToken): T;
	public get<T>(token: InjectionToken, options: GetOptions): T | undefined;
	public get<T>(
		token: InjectionToken,
		options: GetOptions = {},
	): T | undefined {
		this.assertOpen();
		if (this.container.hasProvider(token)) {
			return this.container.get<T>(token);
		}
		if (this._parentContainer) {
			return this._parentContainer.get<T>(token, options);
		}
		if (options.optional) {
			return undefined;
		}
		throw new ProviderNotFoundError(token);
	}

	/**
	 * Resolves a provider asynchronously, creating it according to its scope
	 * (Transient and Scoped providers are created per call). Falls back to the
	 * parent application when the token is not a provider of this one.
	 *
	 * @param token - The injection token (class, string, or symbol)
	 * @param options - `optional: true` returns undefined instead of rejecting when no provider exists
	 * @throws {ProviderNotFoundError} If no provider has this token (unless optional)
	 *
	 * @example
	 * ```typescript
	 * const handler = await app.resolve(RequestHandler);
	 * ```
	 */
	public resolve<T>(token: InjectionToken): Promise<T>;
	public resolve<T>(
		token: InjectionToken,
		options: GetOptions,
	): Promise<T | undefined>;
	public async resolve<T>(
		token: InjectionToken,
		options: GetOptions = {},
	): Promise<T | undefined> {
		this.assertOpen();
		if (this.container.hasProvider(token)) {
			return this.container.resolve<T>(token);
		}
		if (this._parentContainer) {
			return this._parentContainer.resolve<T>(token, options);
		}
		if (options.optional) {
			return undefined;
		}
		throw new ProviderNotFoundError(token);
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
		this.assertOpen();
		const loading = this.loadAndWarmUp(lazyModule);
		this.pendingLoads.add(loading);
		try {
			return await loading;
		} finally {
			this.pendingLoads.delete(loading);
		}
	}

	private async loadAndWarmUp(lazyModule: LazyModule): Promise<ModuleRef> {
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
	 * bootstrap. They will be created lazily on first access via resolve();
	 * get() throws ProviderNotInstantiatedError until then.
	 *
	 * @deprecated Use lazy modules (lazy()/load()) instead; in this mode get() throws ProviderNotInstantiatedError until resolve() is called.
	 *
	 * @returns This instance for method chaining
	 *
	 * @example
	 * ```typescript
	 * const app = NexusApplication.create(AppModule)
	 *   .lazy();
	 * await app.bootstrap(); // Singletons are NOT created yet
	 * const service = await app.resolve(MyService); // Created on first access
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
