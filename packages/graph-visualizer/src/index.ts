/**
 * @packageDocumentation
 * @nexus-ioc/graph-visualizer - Static rendering (PNG/HTML) of Nexus IoC
 * dependency injection graphs.
 *
 * Builds the graph via `@nexus-ioc/type-checker` and `@nexus-ioc/graph-analyzer`
 * from an entry file + tsconfig — no need to run the application. Renders it
 * as a PNG (Graphviz) or an interactive HTML page (Cytoscape.js).
 *
 * @example
 * ```typescript
 * import { StaticGraphVisualizer } from '@nexus-ioc/graph-visualizer';
 *
 * const visualizer = new StaticGraphVisualizer('src/main.ts', {
 *   tsConfigPath: './tsconfig.json',
 * });
 * visualizer.renderPng('./graph.png');
 * visualizer.renderHtml('./graph.html');
 * ```
 */

export { DotGraphRenderer, type GraphConfig } from "./dot/dot-graph-renderer";
export { GraphGenerator } from "./dot/graph-generator";
export {
	HtmlGenerator,
	type HtmlGeneratorOptions,
} from "./html/html-generator";
export {
	StaticGraphVisualizer,
	type StaticVisualizerOptions,
} from "./static-visualizer";
