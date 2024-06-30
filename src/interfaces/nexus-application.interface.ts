import type { InjectionToken } from "./injection-token.interface";
import type { ScannerPluginInterface } from "./plugins";

export interface NexusApplicationInterface {
	bootstrap(): Promise<this>;
	addScannerPlugin(scanner: ScannerPluginInterface): this;
	get<T>(token: InjectionToken): Promise<T | undefined>;
}
