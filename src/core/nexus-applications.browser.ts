import type {
	InjectionToken,
	Module,
	NexusApplicationInterface,
	ScannerPluginInterface,
} from "../interfaces";
import { HashUtilBrowser } from "../utils/hash-utils.browser";
import { Container } from "./modules/container";

export class NexusApplicationsBrowser implements NexusApplicationInterface {
	private readonly hashUtil = new HashUtilBrowser();
	private readonly container = new Container(this.hashUtil);
	private readonly scannerPlugins: ScannerPluginInterface[] = [];

	private constructor(private readonly rootModule: Module) {}

	static create(rootModule: Module) {
		return new NexusApplicationsBrowser(rootModule);
	}

	async bootstrap(): Promise<this> {
		await this.container.run(this.rootModule);

		for (const scannerPlugin of this.scannerPlugins) {
			await scannerPlugin.scan(this.container.graph);
		}

		return this;
	}

	addScannerPlugin(scanner: ScannerPluginInterface): this {
		this.scannerPlugins.push(scanner);
		return this;
	}

	get<T>(token: InjectionToken) {
		return this.container.get<T>(token);
	}
}
