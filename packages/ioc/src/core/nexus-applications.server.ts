import type {
	InjectionToken,
	NexusApplicationInterface,
	ScannerPluginInterface,
	Type,
} from "../interfaces";
import { HashUtilsServer } from "../utils/hash-utils.server";
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

	public async get<T>(token: InjectionToken) {
		const dependency = await this.container.get<T>(token);

		if (!dependency) {
			return this._parentContainer?.get<T>(token);
		}

		return dependency;
	}

	public get errors() {
		return this.container.errors;
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
