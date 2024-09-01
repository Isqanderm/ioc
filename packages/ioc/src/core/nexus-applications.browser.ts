import type {
	InjectionToken,
	Module,
	NexusApplicationInterface,
	ScannerPluginInterface,
} from "../interfaces";
import type { GraphPluginInterface } from "../interfaces/plugins/graph-plugin.interface";
import { HashUtilBrowser } from "../utils/hash-utils.browser";
import { Container } from "./modules/container";

export class NexusApplicationsBrowser implements NexusApplicationInterface {
	private readonly hashUtil = new HashUtilBrowser();
	private readonly graphPlugins: GraphPluginInterface[] = [];
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private readonly container = new Container(this.hashUtil);

	private constructor(private readonly rootModule: Module) {}

	static create(rootModule: Module) {
		return new NexusApplicationsBrowser(rootModule);
	}

	public async bootstrap(): Promise<this> {
		await this.container.run(this.rootModule, this.graphPlugins);

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

	public addGraphPlugin(
		plugin: GraphPluginInterface | GraphPluginInterface[],
	): this {
		const plugins = Array.isArray(plugin) ? plugin : [plugin];
		this.graphPlugins.push(...plugins);
		return this;
	}

	public get<T>(token: InjectionToken) {
		return this.container.get<T>(token);
	}

	public get errors() {
		return this.container.errors;
	}
}
