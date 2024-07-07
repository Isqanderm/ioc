import type { GraphPluginInterface } from "./graph-plugin.interface";
import type { ScannerPluginInterface } from "./scanner-plugin.interface";

export interface ModulePluginInterface {
	addScannerPlugin(
		scanner: ScannerPluginInterface | ScannerPluginInterface[],
	): this;
	addGraphPlugin(plugin: GraphPluginInterface | GraphPluginInterface[]): this;
}
