// Main exports for programmatic use
export { GraphAnalyzer } from "./visualize/graph-analyzer";
export type { GraphAnalyzerOptions } from "./visualize/graph-analyzer";
export { JsonFormatter } from "./visualize/json-formatter";
export { GraphGenerator } from "./visualize/generator";

// Parser exports
export { ParseEntryFile } from "./parser/parse-entry-file";
export { ParseNsModule } from "./parser/parse-ns-module";
export { ParseTsConfig } from "./parser/parse-ts-config";
export { DependencyExtractor } from "./parser/dependency-extractor";

// Interface exports
export type {
	GraphOutput,
	GraphMetadata,
	ModuleInfo,
	ProviderInfo,
} from "./interfaces/graph-output.interface";
export type { Dependency } from "./parser/dependency-extractor";
export type { ProvidersInterface } from "./interfaces/providers.interface";

