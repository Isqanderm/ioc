import type {
	ContainerInterface,
	DynamicModule,
	HashUtilInterface,
	InjectionToken,
	Module,
	ModuleContainerInterface,
	ModuleGraphInterface,
	NexusApplicationInterface,
} from "../../interfaces";
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
 * const service = await container.get(MyService);
 * ```
 */
export class Container implements ContainerInterface {
	private readonly modulesContainer = new ModulesContainer(
		this.hashUtils,
		this,
	);

	private _graph: ModuleGraphInterface | null = null;
	private moduleGraphResolver: Resolver | null = null;

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
		module: Module | DynamicModule,
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
		moduleToReplace: Module,
		newModule: Module,
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
		module: Module,
	): Promise<ModuleContainerInterface | undefined> {
		return this.modulesContainer.getModule(module);
	}

	/**
	 * Resolves and returns an instance of a provider by its injection token.
	 *
	 * This is the main method for retrieving dependencies from the container.
	 * The instance is created according to its scope:
	 * - Singleton: Same instance returned every time
	 * - Request: New instance for each get() call
	 * - Transient: New instance every time, even within the same dependency tree
	 *
	 * @template T - The type of the provider to resolve
	 * @param token - The injection token (class, string, or symbol)
	 * @returns A promise that resolves to the provider instance, or undefined if not found
	 *
	 * @example
	 * ```typescript
	 * const userService = await container.get(UserService);
	 * const config = await container.get('CONFIG');
	 * ```
	 */
	public async get<T>(token: InjectionToken): Promise<T | undefined> {
		return this.moduleGraphResolver?.resolveProvider<T>(token);
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
	public async run(rootModule: Module): Promise<void> {
		const root = await this.modulesContainer.addModule(rootModule);

		this._graph = new ModuleGraph(root);

		this.moduleGraphResolver = new Resolver(this._graph);

		await this._graph.compile();
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
}
