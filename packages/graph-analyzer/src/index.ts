/**
 * @packageDocumentation
 * Nexus IoC Graph Analyzer - Static analysis tool for dependency injection graphs
 *
 * This package statically analyzes Nexus IoC dependency injection graphs
 * without executing code. Graph construction and semantic resolution are
 * delegated to `@nexus-ioc/type-checker`; this package builds a string-keyed
 * `NexusGraphModel` on top of it and runs analyses that don't belong in a
 * generic semantic layer: circular dependency detection (modules and
 * providers), unused-provider detection, module depth/fan-in/fan-out
 * metrics, and provider scope-mismatch detection.
 *
 * @example
 * ```typescript
 * import {
 *   createNexusAnalyzer,
 *   createNexusApplicationAnalyzer,
 *   createNexusProgram,
 *   findApplicationEntryPoint,
 * } from '@nexus-ioc/type-checker';
 * import { buildNexusGraphModel, JsonFormatter } from '@nexus-ioc/graph-analyzer';
 *
 * const program = createNexusProgram(['src/main.ts'], './tsconfig.json');
 * const entryPoint = findApplicationEntryPoint(program, 'src/main.ts')!;
 * const analyzer = createNexusAnalyzer(program);
 * const application = createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
 * const graphModel = buildNexusGraphModel(application);
 *
 * const output = new JsonFormatter(graphModel, 'src/main.ts', true).format();
 * ```
 */

// Analyzers
export {
	type CircularDependency,
	type CircularDependencyAnalysis,
	CircularDependencyDetector,
} from "./analyzer/circular-dependency-detector";
export {
	type DepthLevel,
	type ModuleDepthAnalysis,
	ModuleDepthAnalyzer,
	type ModuleDepthInfo,
} from "./analyzer/module-depth-analyzer";
export {
	type ProviderScope,
	type ProviderScopeAnalysis,
	ProviderScopeAnalyzer,
	type ProviderScopeInfo,
	type ScopeMismatch,
} from "./analyzer/provider-scope-analyzer";
export {
	type UnusedProvider,
	type UnusedProviderAnalysis,
	UnusedProviderDetector,
} from "./analyzer/unused-provider-detector";
// Graph construction (built on top of @nexus-ioc/type-checker)
export { buildNexusGraphModel } from "./graph/build-nexus-graph-model";
export type {
	GraphModuleNode,
	GraphModuleReference,
	GraphProviderDependency,
	GraphProviderNode,
	GraphUndeclaredDependency,
	NexusGraphModel,
} from "./graph/nexus-graph-model";
// Interface exports
export type {
	DependencyInfo,
	GraphAnalysis,
	GraphMetadata,
	GraphOutput,
	ModuleInfo,
	ModuleReferenceInfo,
	ProviderInfo,
} from "./interfaces/graph-output.interface";
// Report output (data only — no rendering; see @nexus-ioc/graph-visualizer for PNG/HTML)
export { JsonFormatter } from "./visualize/json-formatter";
