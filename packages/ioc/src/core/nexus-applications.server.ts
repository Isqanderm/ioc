import { ProviderNotFoundError } from "../errors";
import type {
	GetOptions,
	InjectionToken,
	LazyModule,
	NexusApplicationInterface,
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
	private _parentContainer: NexusApplicationInterface | null = null;

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

	public get<T>(token: InjectionToken): T;
	public get<T>(token: InjectionToken, options: GetOptions): T | undefined;
	public get<T>(
		token: InjectionToken,
		options: GetOptions = {},
	): T | undefined {
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
		return new ModuleRef(this.container, await this.container.load(lazyModule));
	}

	public async unload(ref: ModuleRef): Promise<UnloadResult> {
		return ref.unload();
	}

	lazy(): this {
		return this;
	}

	public async close(): Promise<void> {
		await this.container.close();
	}

	public setParent(parentContainer: NexusApplicationInterface) {
		this._parentContainer = parentContainer;
		return this;
	}
}
