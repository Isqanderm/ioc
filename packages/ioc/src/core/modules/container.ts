import "reflect-metadata";
import { ContainerNotCompiledError } from "@nexus-ioc/shared";
import {
	ContainerClosedError,
	LazyModuleGraphError,
	LazyModuleLoadError,
	ProviderNotFoundError,
	ProviderNotInstantiatedError,
	ProviderScopeError,
} from "../../errors";
import type {
	ContainerInterface,
	DynamicModule,
	GraphSegment,
	HashUtilInterface,
	InjectionToken,
	LazyModule,
	ModuleContainerInterface,
	ModuleGraphInterface,
	Type,
	UnloadResult,
} from "../../interfaces";
import { MODULE_WATERMARK, NodeTypeEnum, Scope } from "../../interfaces";
import { isDynamicModule } from "../../utils/helpers";
import { ModuleGraph } from "../graph/module-graph";
import { Resolver } from "../resolver/resolver";
import { ModulesContainer } from "./modules-container";

/**
 * Container is the core IoC (Inversion of Control) container that manages
 * modules, providers, and dependency injection.
 *
 * The Container is responsible for:
 * - Registering and managing modules
 * - Building the dependency graph
 * - Resolving dependencies and creating instances
 * - Managing the lifecycle of providers
 *
 * @example
 * ```typescript
 * const container = new Container(hashUtils);
 * await container.run(AppModule);
 * const service = container.get(MyService);
 * ```
 */
export class Container implements ContainerInterface {
	private readonly modulesContainer = new ModulesContainer(
		this.hashUtils,
		this,
	);

	private _graph: ModuleGraphInterface | null = null;
	private moduleGraphResolver: Resolver | null = null;
	private closed = false;
	private readonly segments = new Map<symbol, Promise<GraphSegment>>();
	/**
	 * Root module token of every currently loaded segment, by ref id. Used
	 * to compute `protectedRoots` for `unload`; set once a segment's
	 * compile succeeds, cleared once it is unloaded.
	 */
	private readonly loadedSegments = new Map<symbol, string>();
	/**
	 * Tail of the segment compilation chain. Loader functions run in parallel,
	 * but the graph mutation that follows each of them runs one at a time.
	 */
	private compileQueue: Promise<unknown> = Promise.resolve();

	/**
	 * Creates a new Container instance.
	 *
	 * @param hashUtils - Utility for generating unique hashes for modules
	 */
	constructor(private readonly hashUtils: HashUtilInterface) {}

	/**
	 * Adds a module to the container.
	 *
	 * This method registers a module and all its providers, imports, and exports
	 * in the container. The module can be either a static module class or a
	 * dynamic module with runtime configuration.
	 *
	 * @param module - The module to add (static or dynamic)
	 * @returns A promise that resolves to the module container
	 *
	 * @example
	 * ```typescript
	 * await container.addModule(AppModule);
	 * await container.addModule(DatabaseModule.forRoot({ host: 'localhost' }));
	 * ```
	 */
	public async addModule(
		module: Type | DynamicModule,
	): Promise<ModuleContainerInterface> {
		return await this.modulesContainer.addModule(module);
	}

	/**
	 * Replaces an existing module with a new module.
	 *
	 * This is useful for hot module replacement or testing scenarios where
	 * you need to swap out a module implementation.
	 *
	 * @param moduleToReplace - The module to be replaced
	 * @param newModule - The new module to use instead
	 * @returns A promise that resolves to the new module container
	 *
	 * @example
	 * ```typescript
	 * await container.replaceModule(OldDatabaseModule, NewDatabaseModule);
	 * ```
	 */
	public async replaceModule(
		moduleToReplace: Type,
		newModule: Type,
	): Promise<ModuleContainerInterface> {
		return await this.modulesContainer.replaceModule(
			moduleToReplace,
			newModule,
		);
	}

	/**
	 * Retrieves a module container by its module class.
	 *
	 * @param module - The module class to look up
	 * @returns A promise that resolves to the module container, or undefined if not found
	 *
	 * @example
	 * ```typescript
	 * const moduleContainer = await container.getModule(DatabaseModule);
	 * ```
	 */
	public async getModule(
		module: Type,
	): Promise<ModuleContainerInterface | undefined> {
		return this.modulesContainer.getModule(module);
	}

	/**
	 * True iff the graph has a provider node for the token.
	 */
	public hasProvider(token: InjectionToken): boolean {
		return this._graph?.getNode(token)?.type === NodeTypeEnum.PROVIDER;
	}

	/**
	 * Synchronously returns an already-created singleton.
	 *
	 * @throws {ProviderNotFoundError} If no provider has this token
	 * @throws {ProviderScopeError} If the provider is Transient or Scoped
	 * @throws {ProviderNotInstantiatedError} If the singleton is not created yet
	 *
	 * @example
	 * ```typescript
	 * await container.run(AppModule);
	 * const userService = container.get(UserService);
	 * ```
	 */
	public get<T>(token: InjectionToken): T {
		this.assertOpen();
		if (!this._graph || !this.moduleGraphResolver) {
			throw new ContainerNotCompiledError();
		}
		const node = this._graph.getNode(token);
		if (!node || node.type !== NodeTypeEnum.PROVIDER) {
			throw new ProviderNotFoundError(token);
		}
		if (node.scope !== Scope.Singleton) {
			throw new ProviderScopeError(token, node.scope);
		}
		const cached = this.moduleGraphResolver.getInstantiated(token);
		if (!cached.found) {
			throw new ProviderNotInstantiatedError(token);
		}
		return cached.instance as T;
	}

	/**
	 * Resolves an instance of a provider, creating it according to its scope.
	 *
	 * @throws {ProviderNotFoundError} If no provider has this token
	 *
	 * @example
	 * ```typescript
	 * const userService = await container.resolve(UserService);
	 * ```
	 */
	public async resolve<T>(token: InjectionToken): Promise<T> {
		this.assertOpen();
		if (!this._graph || !this.moduleGraphResolver) {
			throw new ContainerNotCompiledError();
		}
		if (!this.hasProvider(token)) {
			throw new ProviderNotFoundError(token);
		}
		return (await this.moduleGraphResolver.resolveProvider<T>(token)) as T;
	}

	/**
	 * Pre-instantiates every singleton provider named by `tokens` (other
	 * tokens are skipped). Uses the resolver directly, without the closed
	 * guard, so a load that was already in flight when `close()` started can
	 * still finish its warm-up; those singletons are destroyed by the
	 * teardown that follows.
	 *
	 * @throws {ContainerNotCompiledError} If run() has not been called yet
	 */
	public async instantiateSingletons(
		tokens: Iterable<InjectionToken>,
	): Promise<void> {
		if (!this._graph || !this.moduleGraphResolver) {
			throw new ContainerNotCompiledError();
		}
		for (const token of tokens) {
			const node = this._graph.getNode(token);
			if (
				node &&
				node.type === NodeTypeEnum.PROVIDER &&
				node.scope === Scope.Singleton
			) {
				await this.moduleGraphResolver.resolveProvider(token);
			}
		}
	}

	/**
	 * Initializes and runs the container with the specified root module.
	 *
	 * This method:
	 * 1. Registers the root module and all its dependencies
	 * 2. Builds the dependency graph
	 * 3. Validates the graph for circular dependencies and missing providers
	 * 4. Initializes all providers with lifecycle hooks
	 *
	 * This method must be called before using get() to resolve dependencies.
	 *
	 * @param rootModule - The root module of the application
	 * @param internalModules - Framework-provided global modules compiled before
	 *   the user root, so their exports are visible to every user module
	 * @returns A promise that resolves when initialization is complete
	 * @throws {Error} If there are circular dependencies or missing providers
	 *
	 * @example
	 * ```typescript
	 * const container = new Container(hashUtils);
	 * await container.run(AppModule);
	 * // Now you can use container.get() to resolve dependencies
	 * ```
	 */
	public async run(
		rootModule: Type,
		internalModules: DynamicModule[] = [],
	): Promise<void> {
		const root = await this.modulesContainer.addModule(rootModule);
		const internals = await Promise.all(
			internalModules.map((module) => this.modulesContainer.addModule(module)),
		);

		this._graph = new ModuleGraph(root, internals);

		this.moduleGraphResolver = new Resolver(this._graph);

		await this._graph.compile();
	}

	/**
	 * Loads a lazy module into this container: runs its loader, registers the
	 * module and compiles only the new part of the graph. Idempotent per ref;
	 * concurrent calls share one in-flight load. A failed load is not cached,
	 * so the caller may retry.
	 *
	 * @param lazyModule - The lazy module reference, created via `lazy()`
	 * @returns A promise that resolves to the graph segment added by this load
	 * @throws {ContainerNotCompiledError} If run() has not been called yet
	 * @throws {LazyModuleLoadError} If the loader rejects or does not return a @Module() class
	 * @throws {LazyModuleGraphError} If the loaded module fails to compile
	 */
	public async load(lazyModule: LazyModule): Promise<GraphSegment> {
		this.assertOpen();
		if (!this._graph) {
			throw new ContainerNotCompiledError();
		}

		const inFlight = this.segments.get(lazyModule.id);
		if (inFlight) {
			return inFlight;
		}

		const loading = this.loadSegment(lazyModule).catch((error) => {
			this.segments.delete(lazyModule.id);
			throw error;
		});
		this.segments.set(lazyModule.id, loading);
		return loading;
	}

	/**
	 * Runs `fn` after every previously enqueued task has settled, so segment
	 * registration and compilation never interleave. A rejected task does not
	 * break the chain for the tasks behind it.
	 */
	private enqueueCompile<T>(fn: () => Promise<T>): Promise<T> {
		const run = this.compileQueue.then(fn, fn);
		this.compileQueue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	private async loadSegment(lazyModule: LazyModule): Promise<GraphSegment> {
		let loaded: Type | DynamicModule;
		try {
			loaded = await lazyModule.load();
		} catch (error) {
			throw new LazyModuleLoadError(
				lazyModule.name,
				error instanceof Error ? error.message : String(error),
			);
		}

		const metatype = loaded && isDynamicModule(loaded) ? loaded.module : loaded;
		if (
			typeof metatype !== "function" ||
			!Reflect.hasMetadata(MODULE_WATERMARK, metatype)
		) {
			throw new LazyModuleLoadError(
				lazyModule.name,
				"loader did not return a class decorated with @Module()",
			);
		}

		const segment = await this.enqueueCompile(async () => {
			const moduleContainer = await this.modulesContainer.addModule(loaded);
			const compiled = await this.graph.compileSegment(
				moduleContainer,
				lazyModule,
			);

			if (compiled.errors.length === 0) {
				this.loadedSegments.set(lazyModule.id, compiled.moduleContainer.token);
			}

			return compiled;
		});

		if (segment.errors.length > 0) {
			throw new LazyModuleGraphError(lazyModule.name, segment.errors);
		}

		return segment;
	}

	/**
	 * Unloads a previously loaded lazy segment: destroys every singleton and
	 * module nothing else still needs, and leaves the rest untouched (a
	 * shared module, a `@Global()` module another segment depends on, a
	 * nested lazy module loaded from inside this one). Runs on the same
	 * compile queue as `load`, so it never interleaves with a concurrent
	 * load or unload of a different ref. Waits for an in-flight load of the
	 * same ref to settle first. A ref that was never loaded is a no-op.
	 * Concurrent `unload()` calls for the *same* ref are also safe, but only
	 * because `ModuleGraph.unloadSegment` is idempotent (a second call
	 * against an already-unloaded placeholder is a no-op) — `Container.unload`
	 * itself does not enforce this, so a future change to `unloadSegment`
	 * must preserve that idempotency or this guarantee silently breaks.
	 */
	public async unload(lazyModule: LazyModule): Promise<UnloadResult> {
		this.assertOpen();
		if (!this._graph) {
			throw new ContainerNotCompiledError();
		}

		const inFlight = this.segments.get(lazyModule.id);

		if (!inFlight) {
			return { destroyedModules: [], destroyedProviders: [] };
		}

		await inFlight.catch(() => undefined);

		if (!this.loadedSegments.has(lazyModule.id)) {
			return { destroyedModules: [], destroyedProviders: [] };
		}

		return this.enqueueCompile(async () => {
			const protectedRoots = new Set<string>([
				this.graph.rootToken,
				...this.graph.internalRootTokens,
				...[...this.loadedSegments.entries()]
					.filter(([id]) => id !== lazyModule.id)
					.map(([, token]) => token),
			]);

			const result = this.graph.unloadSegment(lazyModule, protectedRoots);

			await this.moduleGraphResolver?.destroy(result.destroyedProviders);

			for (const moduleToken of result.destroyedModules) {
				this.modulesContainer.removeModule(moduleToken);
			}

			this.segments.delete(lazyModule.id);
			this.loadedSegments.delete(lazyModule.id);

			return result;
		});
	}

	/**
	 * Gets the dependency graph.
	 *
	 * The graph contains all modules, providers, and their dependencies.
	 * It can be used for introspection and debugging.
	 *
	 * @returns The module graph
	 * @throws {Error} If the graph is not initialized (run() not called yet)
	 *
	 * @example
	 * ```typescript
	 * await container.run(AppModule);
	 * const graph = container.graph;
	 * console.log(graph.getAllNodes());
	 * ```
	 */
	public get graph(): ModuleGraphInterface {
		if (!this._graph) {
			throw new Error(
				"Graph is not initialized. Call run() method before accessing the graph.",
			);
		}
		return this._graph;
	}

	/**
	 * Gets all errors that occurred during graph compilation.
	 *
	 * Errors can include:
	 * - Circular dependencies
	 * - Missing providers
	 * - Unreachable dependencies
	 *
	 * @returns An array of graph errors
	 *
	 * @example
	 * ```typescript
	 * await container.run(AppModule);
	 * if (container.errors.length > 0) {
	 *   console.error('Graph errors:', container.errors);
	 * }
	 * ```
	 */
	public get errors() {
		return this.graph.errors;
	}

	/** Whether run() has built the graph, so get()/resolve() can be used. */
	public get isCompiled(): boolean {
		return this._graph !== null && this.moduleGraphResolver !== null;
	}

	/** Whether the container has been closed (or is closing). */
	public get isClosed(): boolean {
		return this.closed;
	}

	private assertOpen(): void {
		if (this.closed) {
			throw new ContainerClosedError();
		}
	}

	/**
	 * Synchronously marks the container closed: every later public
	 * `get`/`resolve`/`load`/`unload` call throws `ContainerClosedError`.
	 * Work already in flight (a load past its guard, its singleton warm-up)
	 * is not interrupted. `close()` calls this too; callers that need the
	 * flag set before they drain their own work call it first.
	 */
	public markClosed(): void {
		this.closed = true;
	}

	/**
	 * Closes the container and cleans up resources: marks it closed, waits
	 * for in-flight segment loads, then destroys every created provider on
	 * the compile queue.
	 *
	 * @returns A promise that resolves when the container is closed
	 */
	public async close(): Promise<void> {
		this.markClosed();
		await Promise.all(
			[...this.segments.values()].map((segment) =>
				segment.catch(() => undefined),
			),
		);
		await this.enqueueCompile(async () => {
			await this.moduleGraphResolver?.close();
		});
	}
}
