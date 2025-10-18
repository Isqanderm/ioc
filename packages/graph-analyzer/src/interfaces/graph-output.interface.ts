import type { Dependency } from "../parser/dependency-extractor";

/**
 * Complete dependency graph output format
 */
export interface GraphOutput {
	modules: ModuleInfo[];
	providers: ProviderInfo[];
	metadata: GraphMetadata;
}

/**
 * Metadata about the analysis
 */
export interface GraphMetadata {
	entryPoint: string;
	rootModule: string;
	analyzedAt: string;
	version: string;
	totalModules: number;
	totalProviders: number;
}

/**
 * Module information in the dependency graph
 */
export interface ModuleInfo {
	name: string;
	path: string;
	imports: string[];
	exports: string[];
	providers: string[];
	isGlobal: boolean;
}

/**
 * Provider information in the dependency graph
 */
export interface ProviderInfo {
	token: string;
	type: "Class" | "UseValue" | "UseFactory" | "UseClass";
	module: string;
	scope?: "Singleton" | "Request" | "Transient";
	dependencies: Dependency[];
	value?: string; // For UseValue
	factory?: string; // For UseFactory
	useClass?: string; // For UseClass
}

