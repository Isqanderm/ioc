import type {
	InjectionToken,
	Module,
	NexusApplicationInterface,
	ScannerPluginInterface,
} from "../interfaces";
import { HashUtilsServer } from "../utils/hash-utils.server";
import { Container } from "./modules/container";

/**
 * @deprecated
 * It will be removed in version 1.0.0.
 * these classes work the same way. For the new behavior, use @NexusApplications
 */
export class NexusApplicationsServer implements NexusApplicationInterface {
	private readonly hashUtil = new HashUtilsServer();
	private readonly container = new Container(this.hashUtil);
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private _parentContainer: NexusApplicationInterface | null = null;

	private constructor(private readonly rootModule: Module) {}

	static create(rootModule: Module) {
		return new NexusApplicationsServer(rootModule);
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

	async(): this {
		return this;
	}

	public setParent(parentContainer: NexusApplicationInterface) {
		this._parentContainer = parentContainer;
		return this;
	}
}
