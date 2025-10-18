/**
 * @packageDocumentation
 * Nexus IoC Graph Analyzer - Static analysis tool for dependency injection graphs
 *
 * This package provides tools to analyze and visualize Nexus IoC dependency injection graphs
 * without executing code. It uses TypeScript's AST to extract metadata about modules, providers,
 * and their dependencies.
 *
 * @example
 * ```typescript
 * import { GraphAnalyzer, ParseEntryFile, ParseTsConfig } from 'graph-analyzer';
 *
 * // Parse entry file
 * const tsConfig = new ParseTsConfig(configContent, basePath);
 * const entryFile = new ParseEntryFile(sourceFile, 'src/main.ts', tsConfig);
 * entryFile.parse();
 *
 * // Build graph and analyze
 * const graph = new Map();
 * graph.set('entry', entryFile);
 *
 * const analyzer = new GraphAnalyzer(graph, 'src/main.ts', {
 *   outputFormat: 'json'
 * });
 *
 * const output = analyzer.parse();
 * ```
 */

// Main exports for programmatic use
export { GraphAnalyzer } from "./visualize/graph-analyzer";
export type { GraphAnalyzerOptions } from "./visualize/graph-analyzer";
export { JsonFormatter } from "./visualize/json-formatter";
export { GraphGenerator } from "./visualize/generator";
export { HtmlGenerator } from "./visualize/html-generator";
export type { HtmlGeneratorOptions } from "./visualize/html-generator";

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

