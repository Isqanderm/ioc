import type { ModuleGraphInterface } from "../modules";

export interface ScannerGraphInterface
	extends Omit<
		ModuleGraphInterface,
		"compile" | "compileSegment" | "nodes" | "edges"
	> {}

export interface ScannerPluginInterface {
	scan(graph: ScannerGraphInterface): Promise<void>;
}
