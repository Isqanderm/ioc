import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";
import type { GraphOutput } from "../interfaces/graph-output.interface";
import { GraphGenerator } from "./generator";
import { JsonFormatter } from "./json-formatter";

export interface GraphAnalyzerOptions {
	outputFormat?: "json" | "png" | "both";
	outputPath?: string;
	jsonOutputPath?: string;
	pngOutputPath?: string;
}

export class GraphAnalyzer {
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
		private readonly entryPoint: string,
		private readonly options: GraphAnalyzerOptions = {},
	) {}

	/**
	 * Parse and generate output based on options
	 */
	parse(): GraphOutput | void {
		const format = this.options.outputFormat || "both";

		if (format === "json") {
			return this.generateJson();
		}

		if (format === "png") {
			this.generatePng();
			return;
		}

		if (format === "both") {
			const output = this.generateJson();
			this.generatePng();
			return output;
		}
	}

	/**
	 * Generate JSON output
	 */
	generateJson(): GraphOutput {
		const formatter = new JsonFormatter(this.graph, this.entryPoint);
		const output = formatter.format();

		// Write to file if path is specified
		if (this.options.jsonOutputPath || this.options.outputPath) {
			const fs = require("fs");
			const path =
				this.options.jsonOutputPath ||
				this.options.outputPath ||
				"./graph.json";
			fs.writeFileSync(path, JSON.stringify(output, null, 2));
			console.log(`JSON output written to: ${path}`);
		}

		return output;
	}

	/**
	 * Generate PNG visualization
	 */
	generatePng(): void {
		const entryModule = this.graph.get("entry") as ParseEntryFile;

		if (!entryModule || !entryModule.name) {
			throw new Error("Empty entry module");
		}

		// biome-ignore lint/suspicious/noExplicitAny: Legacy format for GraphGenerator
		const json: any = {};
		const modules = [entryModule.name];

		for (const module of modules) {
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

			modules.push(...parseNsModule.imports);
		}

		const pngPath =
			this.options.pngOutputPath || this.options.outputPath || "./graph.png";
		const graphGenerator = new GraphGenerator(json, pngPath);
		graphGenerator.scan();
		console.log(`PNG output written to: ${pngPath}`);
	}
}
