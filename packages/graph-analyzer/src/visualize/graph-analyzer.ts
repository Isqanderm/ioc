import type { GraphOutput } from "../interfaces/graph-output.interface";
import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";
import { GraphGenerator } from "./generator";
import { HtmlGenerator, type HtmlGeneratorOptions } from "./html-generator";
import { JsonFormatter } from "./json-formatter";

/**
 * Options for configuring GraphAnalyzer output
 */
export interface GraphAnalyzerOptions {
	/** Output format: 'json', 'png', 'html', or 'both' (default: 'both') */
	outputFormat?: "json" | "png" | "html" | "both";
	/** Output file path (used when format is not 'both') */
	outputPath?: string;
	/** JSON output file path (default: './graph.json') */
	jsonOutputPath?: string;
	/** PNG output file path (default: './graph.png') */
	pngOutputPath?: string;
	/** HTML output file path (default: './graph.html') */
	htmlOutputPath?: string;
	/** HTML generator options */
	htmlOptions?: HtmlGeneratorOptions;
	/** Enable circular dependency detection (default: false) */
	checkCircular?: boolean;
	/** Enable unused provider detection (default: false) */
	checkUnused?: boolean;
	/** Enable module depth analysis (default: false) */
	checkDepth?: boolean;
	/** Threshold for identifying deep modules (default: 5) */
	deepModuleThreshold?: number;
	/** Enable provider scope analysis (default: false) */
	checkScope?: boolean;
}

/**
 * Main analyzer class for dependency injection graphs
 *
 * Analyzes Nexus IoC dependency graphs and generates JSON and/or PNG outputs.
 *
 * @example
 * ```typescript
 * const analyzer = new GraphAnalyzer(modulesGraph, 'src/main.ts', {
 *   outputFormat: 'json',
 *   jsonOutputPath: './output/graph.json'
 * });
 *
 * const output = analyzer.parse();
 * console.log(`Found ${output.metadata.totalProviders} providers`);
 * ```
 */
export class GraphAnalyzer {
	/**
	 * Create a new GraphAnalyzer instance
	 *
	 * @param graph - Map of module names to parsed modules
	 * @param entryPoint - Path to application entry point file
	 * @param options - Configuration options for output generation
	 */
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
		private readonly entryPoint: string,
		private readonly options: GraphAnalyzerOptions = {},
	) {}

	/**
	 * Parse the dependency graph and generate output based on configured format
	 *
	 * @returns GraphOutput object if format is 'json', 'html', or 'both', void if format is 'png'
	 *
	 * @example
	 * ```typescript
	 * // Generate JSON only
	 * const output = analyzer.parse();
	 *
	 * // Generate PNG only
	 * analyzer.parse(); // Returns void
	 *
	 * // Generate HTML only
	 * analyzer.parse(); // Returns void
	 *
	 * // Generate both JSON and PNG
	 * const output = analyzer.parse(); // Returns GraphOutput and creates PNG
	 * ```
	 */
	parse(): GraphOutput | undefined {
		const format = this.options.outputFormat || "both";

		if (format === "json") {
			return this.generateJson();
		}

		if (format === "png") {
			this.generatePng();
			return;
		}

		if (format === "html") {
			this.generateHtml();
			return;
		}

		if (format === "both") {
			const output = this.generateJson();
			this.generatePng();
			return output;
		}
	}

	/**
	 * Generate JSON output of the dependency graph
	 *
	 * Creates a structured JSON representation of all modules, providers, and dependencies.
	 * Optionally writes the output to a file if jsonOutputPath or outputPath is configured.
	 *
	 * @returns GraphOutput object containing modules, providers, and metadata
	 *
	 * @example
	 * ```typescript
	 * const output = analyzer.generateJson();
	 * console.log(`Total modules: ${output.metadata.totalModules}`);
	 * console.log(`Total providers: ${output.metadata.totalProviders}`);
	 * ```
	 */
	generateJson(): GraphOutput {
		const formatter = new JsonFormatter(
			this.graph,
			this.entryPoint,
			this.options.checkCircular || false,
			this.options.checkUnused || false,
			this.options.checkDepth || false,
			this.options.deepModuleThreshold || 5,
			this.options.checkScope || false,
		);
		const output = formatter.format();

		// Write to file if path is specified
		if (this.options.jsonOutputPath || this.options.outputPath) {
			const fs = require("node:fs");
			const pathModule = require("node:path");
			const path =
				this.options.jsonOutputPath ||
				this.options.outputPath ||
				"./graph.json";

			// Ensure directory exists
			const dir = pathModule.dirname(path);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			fs.writeFileSync(path, JSON.stringify(output, null, 2));
			console.log(`JSON output written to: ${path}`);
		}

		return output;
	}

	/**
	 * Generate PNG visualization of the dependency graph using Graphviz
	 *
	 * Creates a visual graph representation showing modules as nodes and dependencies as edges.
	 * Requires Graphviz to be installed on the system.
	 *
	 * @throws Error if Graphviz is not installed or graph generation fails
	 *
	 * @example
	 * ```typescript
	 * analyzer.generatePng();
	 * // Creates graph.png in the configured output path
	 * ```
	 */
	generatePng(): void {
		const entryModule = this.graph.get("entry") as ParseEntryFile;

		if (!entryModule || !entryModule.name) {
			throw new Error("Empty entry module");
		}

		// biome-ignore lint/suspicious/noExplicitAny: Legacy format for GraphGenerator
		const json: any = {};
		const modules = [entryModule.name];
		const visited = new Set<string>(); // Track visited modules to prevent infinite loops

		for (const module of modules) {
			// Skip if already visited to prevent circular dependency infinite loops
			if (visited.has(module)) {
				continue;
			}
			visited.add(module);

			const parseNsModule = this.graph.get(module) as ParseNsModule;

			if (!parseNsModule) {
				continue;
			}

			json[module] = {
				name: module,
				imports: parseNsModule.imports,
				exports: parseNsModule.exports,
				isGlobal: parseNsModule.isGlobal,
				providers: parseNsModule.providers.map((provider) => ({
					token: provider.token,
					value: provider.value,
					inject: provider.inject,
					scope: provider.scope,
					type: provider.type,
					dependencies: provider.dependencies,
				})),
				dependencies: parseNsModule.deps,
			};

			// Only add imports that haven't been visited yet
			for (const imp of parseNsModule.imports) {
				if (!visited.has(imp)) {
					modules.push(imp);
				}
			}
		}

		const pngPath =
			this.options.pngOutputPath || this.options.outputPath || "./graph.png";
		const graphGenerator = new GraphGenerator(json, pngPath);
		graphGenerator.scan();
		console.log(`PNG output written to: ${pngPath}`);
	}

	/**
	 * Generate interactive HTML visualization of the dependency graph
	 *
	 * Creates an interactive HTML page with a graph visualization using Cytoscape.js.
	 * The HTML includes zoom/pan controls, node details, search functionality, and
	 * clickable file paths that open in your IDE.
	 *
	 * @example
	 * ```typescript
	 * analyzer.generateHtml();
	 * // Creates graph.html in the configured output path
	 * ```
	 */
	generateHtml(): void {
		const htmlPath =
			this.options.htmlOutputPath || this.options.outputPath || "./graph.html";

		const htmlGenerator = new HtmlGenerator(
			this.graph,
			this.entryPoint,
			this.options.htmlOptions || {},
		);

		const html = htmlGenerator.generate();

		const fs = require("node:fs");
		const path = require("node:path");

		// Ensure directory exists
		const dir = path.dirname(htmlPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(htmlPath, html);
		console.log(`HTML output written to: ${htmlPath}`);
	}
}
