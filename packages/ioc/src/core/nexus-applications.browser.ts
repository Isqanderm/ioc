import { ContainerClosedError, ProviderNotFoundError } from "../errors";
import type {
	GetOptions,
	InjectionToken,
	LazyModule,
	NexusApplicationInterface,
	ScannerPluginInterface,
	Type,
	UnloadResult,
} from "../interfaces";
import { HashUtilBrowser } from "../utils/hash-utils.browser";
import { ModuleRef } from "./module-ref";
import { Container } from "./modules/container";

/**
 * @deprecated
 * It will be removed in version 1.0.0.
 * these classes work the same way. For the new behavior, use @NexusApplication
 */
export class NexusApplicationBrowser implements NexusApplicationInterface {
	private readonly hashUtil = new HashUtilBrowser();
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private readonly container = new Container(this.hashUtil);
	private _parentContainer: NexusApplicationInterface | null = null;
	private closePromise: Promise<void> | null = null;

	private constructor(private readonly rootModule: Type) {}

	static create(rootModule: Type) {
		return new NexusApplicationBrowser(rootModule);
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
			this.closePromise = this.container.close().finally(() => {
				this._parentContainer = null;
			});
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

	public setParent(parentContainer: NexusApplicationInterface) {
		this._parentContainer = parentContainer;
		return this;
	}
}
