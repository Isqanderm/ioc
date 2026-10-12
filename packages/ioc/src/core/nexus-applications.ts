import { ContainerNotCompiledError } from "@nexus-ioc/shared";
import {
	BootstrapError,
	ChildModuleNotDeclaredError,
	ContainerClosedError,
	LazyModuleLoadError,
	ProviderNotFoundError,
} from "../errors";
import {
	type BootstrapOptions,
	type CreateChildOptions,
	type DynamicModule,
	type GetOptions,
	type HashUtilInterface,
	type LazyModule,
	MODULE_WATERMARK,
	type ModuleContainerInterface,
	type NexusApplicationInterface,
	type ParentLink,
	type ProviderToken,
	type ScannerPluginInterface,
	type Type,
	type UnloadResult,
} from "../interfaces";
import { HashUtil } from "../utils/hash-utils";
import { getModuleLabel, isDynamicModule } from "../utils/helpers";
import { isLazyModule } from "../utils/lazy-module";
import { withExtraProviders } from "./child-module";
import { createInternalModule, LazyModuleLoader } from "./lazy-module-loader";
import { ModuleRef } from "./module-ref";
import { Container } from "./modules/container";

/** How a child application is attached to its parent. */
interface ChildWiring {
	link: ParentLink;
	onClosed: () => void;
	declaredIn: string;
}

function flattenErrors(error: unknown): unknown[] {
	return error instanceof AggregateError ? [...error.errors] : [error];
}

/** Closes `apps` one at a time, in order; returns their flattened errors. */
async function closeAll(apps: NexusApplication[]): Promise<unknown[]> {
	const errors: unknown[] = [];
	for (const app of apps) {
		try {
			await app.close();
		} catch (error) {
			errors.push(...flattenErrors(error));
		}
	}
	return errors;
}

/**
 * NexusApplication is the main application class that provides a high-level
 * API for creating and managing IoC containers.
 *
 * This class wraps the Container and provides additional features:
 * - Automatic singleton initialization
 * - Scanner plugin support for custom metadata processing
 * - Child containers for modules declared in `@Module({ children })`
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
	private readonly hashUtil: HashUtilInterface;
	private isAsyncContainer = false;
	/** Built in the constructor, once `hashUtil` honours `options.hashFn`. */
	private readonly container: Container;
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private closePromise: Promise<void> | null = null;
	/** The parent chain; set only for children made by `createChild()`. */
	private readonly link: ParentLink | null;
	/** Removes this child from its parent's `liveChildren` once closed. */
	private readonly onClosed: (() => void) | null;
	/**
	 * Token, in the parent graph, of the module that declares this child in
	 * `@Module({ children })`; the parent closes the child when an unload
	 * destroys that module.
	 */
	private readonly declaredIn: string | null;
	/**
	 * Children created by `createChild()` and not closed yet, in creation
	 * order. The only reference the parent keeps to a child.
	 */
	private readonly liveChildren = new Set<NexusApplication>();
	/**
	 * Lazy child code, per lazy ref id, with the token of the declaring
	 * module; a failed load is not cached, and an unload that destroys the
	 * declaring module drops the entry.
	 */
	private readonly loadedChildren = new Map<
		symbol,
		{ declaredIn: string; module: Promise<Type | DynamicModule> }
	>();
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
		private readonly rootModule: Type | DynamicModule,
		private readonly options?: { hashFn: new () => HashUtilInterface },
		child?: ChildWiring,
	) {
		this.hashUtil =
			typeof options?.hashFn === "function"
				? new options.hashFn()
				: new HashUtil();
		this.container = new Container(this.hashUtil);
		this.link = child?.link ?? null;
		this.onClosed = child?.onClosed ?? null;
		this.declaredIn = child?.declaredIn ?? null;
		this.container.onUnloading((modules) =>
			this.closeChildrenDeclaredIn(modules),
		);
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
	 * Creates a not-yet-bootstrapped child application. Private: the only
	 * public way to get a child is `createChild()`.
	 */
	private static createAsChild(
		root: Type | DynamicModule,
		wiring: ChildWiring,
		options?: { hashFn: new () => HashUtilInterface },
	): NexusApplication {
		return new NexusApplication(root, options, wiring);
	}

	/**
	 * Creates a child application for a module declared in
	 * `@Module({ children })` somewhere in this application's graph. The
	 * child is returned bootstrapped, with its singletons created.
	 *
	 * - `Type` matches a declared class; `DynamicModule` matches by its
	 *   `.module`; a `LazyModule` matches a declared ref by identity, and its
	 *   loader runs once per ref (a failed load is retried next time).
	 * - `options.providers` are appended to the child root module's providers.
	 * - The child's `get()`/`resolve()` look in the child first, then at what
	 *   the declaring module sees in this application, then up this
	 *   application's own parent chain.
	 *
	 * @throws {ContainerNotCompiledError} If this application is not bootstrapped
	 * @throws {ContainerClosedError} If this application is closed or closing
	 * @throws {ChildModuleNotDeclaredError} If no module declares `child`, or
	 *   (`reason: "unloaded"`) the lazy module declaring it was unloaded while
	 *   the child was being created; the child is closed then
	 * @throws {LazyModuleLoadError} If a lazy child's loader fails or returns a non-module
	 *
	 * @example
	 * ```typescript
	 * @Module({ children: [ProfileModule] })
	 * class AppModule {}
	 *
	 * const app = await NexusApplication.create(AppModule).bootstrap();
	 * const profile = await app.createChild(ProfileModule, {
	 *   providers: [{ provide: PROFILE_ID, useValue: "p1" }],
	 * });
	 * ```
	 */
	public async createChild(
		child: Type | DynamicModule | LazyModule,
		options?: CreateChildOptions,
	): Promise<NexusApplication> {
		this.assertUsable();
		const key = isLazyModule(child)
			? child
			: isDynamicModule(child)
				? child.module
				: child;
		const childName = isLazyModule(child) ? child.name : getModuleLabel(child);
		const declaredIn = this.container.graph.findChildDeclaration(key);
		if (!declaredIn) {
			throw new ChildModuleNotDeclaredError(childName);
		}
		// The declaring module may live in a lazy segment that is unloaded
		// (and maybe loaded again, as a new module) while this call awaits.
		const assertStillDeclared = () => {
			if (this.container.graph.findChildDeclaration(key) !== declaredIn) {
				throw new ChildModuleNotDeclaredError(childName, "unloaded");
			}
		};

		let module: Type | DynamicModule;
		if (isLazyModule(child)) {
			try {
				module = await this.loadChildModule(child, declaredIn.token);
			} catch (error) {
				// A parent that started closing reports that, not the load failure.
				this.assertOpen();
				throw error;
			}
			// The parent may have started closing, or the declaring segment
			// unloading, while the code loaded.
			this.assertOpen();
			assertStillDeclared();
		} else {
			module = child;
		}

		const app = NexusApplication.createAsChild(
			withExtraProviders(module, options?.providers),
			{
				link: this.linkFor(declaredIn),
				onClosed: () => this.liveChildren.delete(app),
				declaredIn: declaredIn.token,
			},
			this.options,
		);
		// Registered before bootstrap so a concurrent close() sees it.
		this.liveChildren.add(app);
		// Only this application can close a child still bootstrapping: its
		// close() cascade or an unload of the declaring module. The caller
		// hears about the parent closing first, then about the unload.
		const reportClosedWhileCreating = () => {
			this.assertOpen();
			if (app.isClosed) {
				throw new ChildModuleNotDeclaredError(childName, "unloaded");
			}
			assertStillDeclared();
		};
		try {
			await app.bootstrap();
		} catch (error) {
			const closedByParent = app.isClosed;
			this.liveChildren.delete(app);
			await app.close().catch(() => undefined);
			this.assertOpen();
			if (closedByParent) {
				reportClosedWhileCreating();
			}
			throw error;
		}

		try {
			reportClosedWhileCreating();
		} catch (error) {
			await app.close();
			throw error;
		}
		return app;
	}

	/** Runs a lazy child's loader once per ref; a failure is not cached. */
	private loadChildModule(
		ref: LazyModule,
		declaredIn: string,
	): Promise<Type | DynamicModule> {
		const cached = this.loadedChildren.get(ref.id);
		if (cached) {
			return cached.module;
		}
		const entry = {
			declaredIn,
			module: this.runChildLoader(ref).catch((error) => {
				// Only this load's entry: an unload may have dropped it already.
				if (this.loadedChildren.get(ref.id) === entry) {
					this.loadedChildren.delete(ref.id);
				}
				throw error;
			}),
		};
		this.loadedChildren.set(ref.id, entry);
		return entry.module;
	}

	private async runChildLoader(ref: LazyModule): Promise<Type | DynamicModule> {
		let loaded: Type | DynamicModule;
		try {
			loaded = await ref.load();
		} catch (error) {
			throw new LazyModuleLoadError(
				ref.name,
				error instanceof Error ? error.message : String(error),
			);
		}
		const metatype = loaded && isDynamicModule(loaded) ? loaded.module : loaded;
		if (
			typeof metatype !== "function" ||
			!Reflect.hasMetadata(MODULE_WATERMARK, metatype)
		) {
			throw new LazyModuleLoadError(
				ref.name,
				"loader did not return a class decorated with @Module()",
			);
		}
		return loaded;
	}

	/**
	 * The link a child declared in `declaredIn` uses: what that module sees
	 * in this application, then this application's own parent chain. It
	 * never caches anything. Once this application closes, `canProvide` still
	 * answers from the graph, so `get`/`resolve` of a token the child would
	 * have taken from here throw `ContainerClosedError` (even with
	 * `optional`) instead of quietly reporting it missing.
	 */
	private linkFor(declaredIn: ModuleContainerInterface): ParentLink {
		const graph = () => this.container.graph;
		const seesLocally = (token: ProviderToken) =>
			this.container.hasProvider(token) &&
			graph().isProviderVisible(declaredIn, token);
		return {
			canProvide: (token) =>
				seesLocally(token) || (this.link?.canProvide(token) ?? false),
			get: (token) =>
				seesLocally(token)
					? this.container.get(token)
					: this.requireLink(token).get(token),
			resolve: (token) =>
				seesLocally(token)
					? this.container.resolve(token)
					: this.requireLink(token).resolve(token),
		};
	}

	private requireLink(token: ProviderToken): ParentLink {
		if (!this.link) throw new ProviderNotFoundError(token);
		return this.link;
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
		await this.container.run(
			this.rootModule,
			[createInternalModule(this.lazyModuleLoader)],
			this.link ? { link: this.link } : {},
		);

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
	private async warmUpSingletons(tokens: Iterable<ProviderToken>) {
		if (this.isAsyncContainer) {
			return;
		}
		await this.container.instantiateSingletons(tokens);
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
	 * - A child application removes itself from its parent's live children
	 *   once closed.
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
			// Mark the container closed before draining, so module refs are
			// rejected during the drain window too.
			this.container.markClosed();
			this.closePromise = this.closeChildrenThenSelf().finally(() => {
				this.onClosed?.();
			});
		}
		return this.closePromise;
	}

	/**
	 * Closes the live children (newest first, one at a time), then this
	 * application. Every failure, a child's or its own, ends up in one
	 * `AggregateError`, flattened so a child's `AggregateError` contributes
	 * its errors rather than nesting.
	 */
	private async closeChildrenThenSelf(): Promise<void> {
		const errors = await closeAll([...this.liveChildren].reverse());
		try {
			await this.drainAndClose();
		} catch (error) {
			errors.push(...flattenErrors(error));
		}
		if (errors.length > 0) {
			throw new AggregateError(
				errors,
				"One or more onModuleDestroy hooks failed",
			);
		}
	}

	/**
	 * Waits for in-flight `load()` calls (including their singleton warm-up,
	 * which bypasses the closed guard) so nothing is instantiated after the
	 * destroy pass, then tears the container down.
	 */
	private async drainAndClose(): Promise<void> {
		await Promise.allSettled([...this.pendingLoads]);
		await this.container.close();
	}

	/**
	 * Unload hook (see `Container.onUnloading`): closes the live children
	 * declared by a module the unload destroys, newest first, and forgets
	 * the lazy child code those modules declared.
	 */
	private async closeChildrenDeclaredIn(
		destroyedModules: string[],
	): Promise<{ closed: number; error?: unknown }> {
		const destroyed = new Set(destroyedModules);
		for (const [id, entry] of this.loadedChildren) {
			if (destroyed.has(entry.declaredIn)) {
				this.loadedChildren.delete(id);
			}
		}
		const doomed = [...this.liveChildren]
			.filter((child) => child.declaredIn && destroyed.has(child.declaredIn))
			.reverse();
		// A child someone else is already closing is waited for (it may still
		// use the parent's providers) but neither counted nor re-reported.
		const closingElsewhere = doomed.filter((child) => child.isClosed);
		const started = doomed.filter((child) => !child.isClosed);
		const errors = await closeAll(started);
		await Promise.allSettled(closingElsewhere.map((child) => child.close()));
		return {
			closed: started.length,
			error:
				errors.length > 0
					? new AggregateError(
							errors,
							"One or more child applications failed to close",
						)
					: undefined,
		};
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

	private assertUsable(): void {
		this.assertOpen();
		if (!this.container.isCompiled) {
			throw new ContainerNotCompiledError();
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
	 * If the token is not a provider of this application and this is a child
	 * (see `createChild()`), the parent chain is asked. A token found locally
	 * is always answered locally, never by the parent.
	 *
	 * @template T - The type of the provider
	 * @param token - The provider token: class, InjectionToken, string or symbol
	 * @param options - `optional: true` returns undefined instead of throwing when no provider exists
	 * @throws {ContainerNotCompiledError} If called before bootstrap()
	 * @throws {ProviderNotFoundError} If no provider has this token (unless optional)
	 * @throws {ProviderScopeError} If the provider is Transient; use resolve()
	 * @throws {ProviderNotInstantiatedError} If the singleton is not created yet (lazy mode); use resolve()
	 *
	 * @example
	 * ```typescript
	 * const app = await NexusApplication.create(AppModule).bootstrap();
	 * const userService = app.get(UserService);
	 * const config = app.get('CONFIG', { optional: true });
	 * ```
	 */
	public get<T>(token: ProviderToken<T>): T;
	public get<T>(
		token: ProviderToken<T>,
		options: { optional: true },
	): T | undefined;
	public get<T>(token: ProviderToken<T>, options: { optional?: false }): T;
	public get<T>(token: ProviderToken<T>, options: GetOptions): T | undefined;
	public get<T>(
		token: ProviderToken<T>,
		options: GetOptions = {},
	): T | undefined {
		this.assertUsable();
		if (this.container.hasProvider(token)) {
			return this.container.get<T>(token);
		}
		if (this.link?.canProvide(token)) {
			return this.link.get<T>(token);
		}
		if (options.optional) {
			return undefined;
		}
		throw new ProviderNotFoundError(token);
	}

	/**
	 * Resolves a provider asynchronously, creating it according to its scope
	 * (Transient providers are created per call). A child application falls
	 * back to its parent chain when the token is not a provider of its own.
	 *
	 * @param token - The provider token: class, InjectionToken, string or symbol
	 * @param options - `optional: true` returns undefined instead of rejecting when no provider exists
	 * @throws {ContainerNotCompiledError} If called before bootstrap()
	 * @throws {ProviderNotFoundError} If no provider has this token (unless optional)
	 *
	 * @example
	 * ```typescript
	 * const handler = await app.resolve(RequestHandler);
	 * ```
	 */
	public resolve<T>(token: ProviderToken<T>): Promise<T>;
	public resolve<T>(
		token: ProviderToken<T>,
		options: { optional: true },
	): Promise<T | undefined>;
	public resolve<T>(
		token: ProviderToken<T>,
		options: { optional?: false },
	): Promise<T>;
	public resolve<T>(
		token: ProviderToken<T>,
		options: GetOptions,
	): Promise<T | undefined>;
	public async resolve<T>(
		token: ProviderToken<T>,
		options: GetOptions = {},
	): Promise<T | undefined> {
		this.assertUsable();
		if (this.container.hasProvider(token)) {
			return this.container.resolve<T>(token);
		}
		if (this.link?.canProvide(token)) {
			return this.link.resolve<T>(token);
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
}
