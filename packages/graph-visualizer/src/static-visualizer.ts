import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	buildNexusGraphModel,
	type GraphOutput,
	JsonFormatter,
} from "@nexus-ioc/graph-analyzer";
import {
	createNexusAnalyzer,
	createNexusApplicationAnalyzer,
	createNexusProgram,
	findApplicationEntryPoint,
} from "@nexus-ioc/type-checker";
import { DotGraphRenderer, type GraphConfig } from "./dot/dot-graph-renderer";
import { GraphGenerator } from "./dot/graph-generator";
import {
	HtmlGenerator,
	type HtmlGeneratorOptions,
} from "./html/html-generator";

export interface StaticVisualizerOptions {
	/** Path to tsconfig.json. If omitted, the nearest one on disk is used. */
	tsConfigPath?: string;
	/** Highlight circular module/provider dependencies (default: true). */
	checkCircular?: boolean;
	dot?: Partial<GraphConfig>;
	html?: HtmlGeneratorOptions;
}

/**
 * Statically analyzes a Nexus IoC application (entry file + tsconfig, no
 * need to run the app) via `@nexus-ioc/type-checker` and `@nexus-ioc/graph-analyzer`,
 * then renders the result as PNG (Graphviz) or interactive HTML (Cytoscape.js).
 */
export class StaticGraphVisualizer {
	private readonly options: StaticVisualizerOptions;

	constructor(
		private readonly entryFilePath: string,
		options: StaticVisualizerOptions = {},
	) {
		this.options = { checkCircular: true, ...options };
	}

	/** Builds the analyzed `GraphOutput`, without rendering it. */
	toJson(): GraphOutput {
		const program = createNexusProgram(
			[this.entryFilePath],
			this.options.tsConfigPath,
		);
		const entryPoint = findApplicationEntryPoint(program, this.entryFilePath);
		if (!entryPoint) {
			throw new Error(
				`No entry module found in entry file: ${this.entryFilePath}`,
			);
		}

		const analyzer = createNexusAnalyzer(program);
		const application =
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
		const graphModel = buildNexusGraphModel(application);

		return new JsonFormatter(
			graphModel,
			this.entryFilePath,
			this.options.checkCircular ?? true,
		).format();
	}

	renderPng(outputPath: string): void {
		const graphOutput = this.toJson();
		const circularDependencies =
			graphOutput.analysis?.circularDependencies ?? [];
		const dot = new DotGraphRenderer(
			graphOutput,
			this.options.dot,
			circularDependencies,
		).render();

		new GraphGenerator().generate(dot, outputPath);
	}

	renderHtml(outputPath: string): void {
		const graphOutput = this.toJson();
		const html = new HtmlGenerator(graphOutput, this.options.html).generate();

		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, html, "utf-8");
	}
}
