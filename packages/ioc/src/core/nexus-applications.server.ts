import { ContainerNotCompiledError } from "@nexus-ioc/shared";
import { ContainerClosedError, ProviderNotFoundError } from "../errors";
import type {
	CreateChildOptions,
	DynamicModule,
	GetOptions,
	LazyModule,
	NexusApplicationInterface,
	ProviderToken,
	ScannerPluginInterface,
	Type,
	UnloadResult,
} from "../interfaces";
import { HashUtilsServer } from "../utils/hash-utils.server";
import { ModuleRef } from "./module-ref";
import { Container } from "./modules/container";

/**
 * @deprecated
 * It will be removed in version 1.0.0.
 * these classes work the same way. For the new behavior, use @NexusApplication
 */
export class NexusApplicationServer implements NexusApplicationInterface {
	private readonly hashUtil = new HashUtilsServer();
	private readonly container = new Container(this.hashUtil);
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private closePromise: Promise<void> | null = null;

	private constructor(private readonly rootModule: Type) {}

	static create(rootModule: Type) {
		return new NexusApplicationServer(rootModule);
	}

	public async bootstrap(): Promise<this> {
		await this.container.run(this.rootModule);

		for (const scannerPlugin of this.scannerPlugins) {
			await scannerPlugin.scan(this.container.graph);
		}

		return this;
	}

	public addScannerPlugin(
		scanner: ScannerPluginInterface | ScannerPluginInterface[],
	): this {
		const plugins = Array.isArray(scanner) ? scanner : [scanner];
		this.scannerPlugins.push(...plugins);
		return this;
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
		this.assertUsable();
		if (this.container.hasProvider(token)) {
			return this.container.get<T>(token);
		}
		if (options.optional) {
			return undefined;
		}
		throw new ProviderNotFoundError(token);
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
		this.assertUsable();
		if (this.container.hasProvider(token)) {
			return this.container.resolve<T>(token);
		}
		if (options.optional) {
			return undefined;
		}
		throw new ProviderNotFoundError(token);
	}

	public get errors() {
		return this.container.errors;
	}

	public async load(lazyModule: LazyModule): Promise<ModuleRef> {
		this.assertOpen();
		return new ModuleRef(this.container, await this.container.load(lazyModule));
	}

	public async unload(ref: ModuleRef): Promise<UnloadResult> {
		return ref.unload();
	}

	lazy(): this {
		return this;
	}

	public close(): Promise<void> {
		if (!this.closePromise) {
			this.closePromise = this.container.close();
		}
		return this.closePromise;
	}

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

	public async createChild(
		_child: Type | DynamicModule | LazyModule,
		_options?: CreateChildOptions,
	): Promise<NexusApplicationInterface> {
		throw new Error(
			"createChild is not supported by the deprecated NexusApplicationBrowser/Server; use NexusApplication",
		);
	}
}
