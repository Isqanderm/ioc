import type { ScannerPluginInterface } from "./scanner-plugin.interface";

export interface ModulePluginInterface {
	addScannerPlugin(
		scanner: ScannerPluginInterface | ScannerPluginInterface[],
	): this;
}
