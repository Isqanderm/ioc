import {
	type HashUtilInterface,
	type InjectionToken,
	type Module,
	type NexusApplicationInterface,
	NodeTypeEnum,
	type ScannerPluginInterface,
	Scope,
} from "../interfaces";
import { HashUtil } from "../utils/hash-utils";
import { Container } from "./modules/container";

/**
 * NexusApplications is the main application class that provides a high-level
 * API for creating and managing IoC containers.
 *
 * This class wraps the Container and provides additional features:
 * - Automatic singleton initialization
 * - Scanner plugin support for custom metadata processing
 * - Parent-child container hierarchies
 * - Async/sync container modes
 *
 * @example
 * ```typescript
 * const app = NexusApplications.create(AppModule);
 * await app.bootstrap();
 * const service = await app.get(MyService);
 * ```
 */
export class NexusApplications implements NexusApplicationInterface {
	private hashUtil: HashUtilInterface = new HashUtil();
	private isAsyncContainer = false;
	private readonly container = new Container(this.hashUtil);
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private _parentContainer: NexusApplicationInterface | null = null;

	/**
	 * Creates a new NexusApplications instance.
	 *
	 * @param rootModule - The root module of the application
	 * @param options - Optional configuration
	 * @param options.hashFn - Custom hash function for module identification
	 */
	private constructor(
		private readonly rootModule: Module,
		options?: { hashFn: new () => HashUtilInterface },
	) {
		if (options?.hashFn && typeof options?.hashFn === "function") {
			this.hashUtil = new options.hashFn();
		}
	}

	/**
	 * Creates a new NexusApplications instance.
	 *
	 * This is the main entry point for creating an application.
	 *
	 * @param rootModule - The root module of the application
	 * @param options - Optional configuration
	 * @param options.hashFn - Custom hash function for module identification
	 * @returns A new NexusApplications instance
	 *
	 * @example
	 * ```typescript
	 * const app = NexusApplications.create(AppModule);
	 * await app.bootstrap();
	 * ```
	 */
	static create(
		rootModule: Module,
		options?: { hashFn: new () => HashUtilInterface },
	) {
		return new NexusApplications(rootModule, options);
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
	 * const app = NexusApplications.create(AppModule);
	 * await app.bootstrap();
	 * // Application is now ready to use
	 * ```
	 */
	public async bootstrap(): Promise<this> {
		await this.container.run(this.rootModule);

		for (const scannerPlugin of this.scannerPlugins) {
			await scannerPlugin.scan(this.container.graph);
		}

		if (!this.isAsyncContainer) {
			for (const [token, node] of this.container.graph.nodes) {
				if (
					node.type === NodeTypeEnum.PROVIDER &&
					node.scope === Scope.Singleton
				) {
					await this.container.get(token);
				}
			}
		}

		return this;
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
	 * const app = NexusApplications.create(AppModule)
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
	 * const app = await NexusApplications.create(AppModule).bootstrap();
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
	 * Gets all errors that occurred during graph compilation.
	 *
	 * @returns An array of graph errors
	 *
	 * @example
	 * ```typescript
	 * const app = await NexusApplications.create(AppModule).bootstrap();
	 * if (app.errors.length > 0) {
	 *   console.error('Application errors:', app.errors);
	 * }
	 * ```
	 */
	public get errors() {
		return this.container.errors;
	}

	/**
	 * Enables async mode for the container.
	 *
	 * In async mode, singleton providers are NOT pre-instantiated during
	 * bootstrap. They will be created lazily on first access via get().
	 * This can improve startup time for large applications.
	 *
	 * @returns This instance for method chaining
	 *
	 * @example
	 * ```typescript
	 * const app = NexusApplications.create(AppModule)
	 *   .async();
	 * await app.bootstrap(); // Singletons are NOT created yet
	 * const service = await app.get(MyService); // Created on first access
	 * ```
	 */
	public async(): this {
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
	 * const parentApp = await NexusApplications.create(ParentModule).bootstrap();
	 * const childApp = await NexusApplications.create(ChildModule)
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
