import {
	type DynamicModule,
	type GetOptions,
	type GraphError,
	type LazyModule,
	type ModuleContainerInterface,
	Module as ModuleDecorator,
	type ModuleMetadata,
	ModuleRef,
	ProviderNotFoundError,
	type ProviderToken,
	type ScannerPluginInterface,
	type Type,
	type UnloadResult,
} from "@nexus-ioc/core";
import {
	Container,
	createInternalModule,
	LazyModuleLoader,
} from "@nexus-ioc/core/internal";
import { ContainerNotCompiledError } from "@nexus-ioc/shared";
import type { ModuleTestingContainerInterface } from "../interfaces";
import { HashTestingUtil } from "./hash-testing-util";
import { TestingCreator } from "./testing-creator";

export class Test<T extends ModuleMetadata = ModuleMetadata>
	implements ModuleTestingContainerInterface<T>
{
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private readonly hashTestingUtil = new HashTestingUtil();
	private readonly container = new Container(this.hashTestingUtil);
	private readonly moduleTestingCreator = new TestingCreator<T>();
	private _moduleContainer: ModuleContainerInterface | null = null;
	private _moduleDecorator: <D extends T>(metadata: D) => ClassDecorator =
		ModuleDecorator;
	private _module: Type | null = null;
	private containerCompiled = false;
	private readonly lazyModuleLoader = new LazyModuleLoader(
		(lazyModule) => this.load(lazyModule),
		(ref) => this.unload(ref),
	);

	private constructor(private readonly metatype: T) {}

	public static createModule<M extends ModuleMetadata = ModuleMetadata>(
		metatype: M,
	): Test<M> {
		return new Test<M>(metatype);
	}

	public async addModule(
		metatype: Type | DynamicModule,
	): Promise<ModuleContainerInterface> {
		return this.container.addModule(metatype);
	}

	public async getModule(
		metatype: Type,
	): Promise<ModuleContainerInterface | undefined> {
		return this.container.getModule(metatype);
	}

	public async replaceModule(
		metatypeToReplace: Type,
		newMetatype: Type,
	): Promise<ModuleContainerInterface> {
		return this.container.replaceModule(metatypeToReplace, newMetatype);
	}

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
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}
		if (!this.container.hasProvider(token)) {
			if (options.optional) {
				return undefined;
			}
			throw new ProviderNotFoundError(token);
		}
		return this.container.get<T>(token);
	}

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
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}
		if (!this.container.hasProvider(token)) {
			if (options.optional) {
				return undefined;
			}
			throw new ProviderNotFoundError(token);
		}
		return this.container.resolve<T>(token);
	}

	/**
	 * Loads a lazy module into the testing container, like
	 * `NexusApplication.load()`. Also backs the injectable `LazyModuleLoader`.
	 */
	public async load(lazyModule: LazyModule): Promise<ModuleRef> {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		const segment = await this.container.load(lazyModule);
		await this.container.instantiateSingletons(segment.providerTokens);
		return new ModuleRef(this.container, segment);
	}

	/**
	 * Unloads a lazy module previously loaded through `load()`, like
	 * `NexusApplication.unload()`. Also backs the injectable
	 * `LazyModuleLoader`.
	 */
	public async unload(ref: ModuleRef): Promise<UnloadResult> {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return ref.unload();
	}

	public async compile(): Promise<ModuleContainerInterface> {
		this._module = this.moduleTestingCreator.create(
			this.metatype,
			this._moduleDecorator,
		);
		this._moduleContainer = await this.container.addModule(this._module);

		await this.container.run(this._moduleContainer.metatype as Type, [
			createInternalModule(this.lazyModuleLoader),
		]);

		this.containerCompiled = true;

		for (const scannerPlugin of this.scannerPlugins) {
			await scannerPlugin.scan(this.container.graph);
		}

		await this.container.instantiateSingletons(
			this.container.graph.nodes.keys(),
		);

		return this._moduleContainer;
	}

	public get module() {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this._module;
	}

	public get moduleContainer() {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this._moduleContainer;
	}

	addScannerPlugin(
		scanner: ScannerPluginInterface | ScannerPluginInterface[],
	): this {
		const plugins = Array.isArray(scanner) ? scanner : [scanner];
		this.scannerPlugins.push(...plugins);
		return this;
	}

	public setModuleDecorator(decorator: (metadata: T) => ClassDecorator): this {
		this._moduleDecorator = decorator;
		return this;
	}

	public get errors() {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this._moduleContainer?.errors as GraphError[];
	}
}
