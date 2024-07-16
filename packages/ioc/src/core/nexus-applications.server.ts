import type {
	GraphPluginInterface,
	InjectionToken,
	Module,
	NexusApplicationInterface,
	ScannerPluginInterface,
} from "../interfaces";
import { HashUtilsServer } from "../utils/hash-utils.server";
import { Container } from "./modules/container";

export class NexusApplicationsServer implements NexusApplicationInterface {
	private readonly hashUtil = new HashUtilsServer();
	private readonly graphPlugins: GraphPluginInterface[] = [];
	private readonly container = new Container(this.hashUtil);
	private readonly scannerPlugins: ScannerPluginInterface[] = [];

	private constructor(private readonly rootModule: Module) {}

	static create(rootModule: Module) {
		return new NexusApplicationsServer(rootModule);
	}

	async bootstrap(): Promise<this> {
		await this.container.run(this.rootModule, this.graphPlugins);

		for (const scannerPlugin of this.scannerPlugins) {
			await scannerPlugin.scan(this.container.graph);
		}

		return this;
	}

	addScannerPlugin(
		scanner: ScannerPluginInterface | ScannerPluginInterface[],
	): this {
		const plugins = Array.isArray(scanner) ? scanner : [scanner];
		this.scannerPlugins.push(...plugins);
		return this;
	}

	addGraphPlugin(plugin: GraphPluginInterface | GraphPluginInterface[]): this {
		const plugins = Array.isArray(plugin) ? plugin : [plugin];
		this.graphPlugins.push(...plugins);
		return this;
	}

	parent(container: NexusApplicationsServer): this {
		this.container.parent(container.container);
		return this;
	}

	get<T>(token: InjectionToken) {
		return this.container.get<T>(token);
	}
}
