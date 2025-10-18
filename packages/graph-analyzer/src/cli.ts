#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { GraphAnalyzer } from "./visualize/graph-analyzer";
import { ParseEntryFile } from "./parser/parse-entry-file";
import { ParseNsModule } from "./parser/parse-ns-module";
import { ParseTsConfig } from "./parser/parse-ts-config";

interface CliOptions {
	entryFile: string;
	tsConfig?: string;
	output?: string;
	format?: "json" | "png" | "html" | "both";
	help?: boolean;
	version?: boolean;
	ideProtocol?: "vscode" | "webstorm" | "idea";
	darkTheme?: boolean;
}

const VERSION = "1.0.0";

function printHelp() {
	console.log(`
Nexus IoC Graph Analyzer v${VERSION}

Usage: graph-analyzer [options] <entry-file>

Analyzes Nexus IoC dependency injection graphs and generates visualizations.

Arguments:
  <entry-file>              Path to the entry point file (e.g., src/main.ts)

Options:
  -c, --config <path>       Path to tsconfig.json (default: ./tsconfig.json)
  -o, --output <path>       Output file path (default: ./graph.json, ./graph.png, or ./graph.html)
  -f, --format <format>     Output format: json, png, html, or both (default: both)
  --ide <protocol>          IDE protocol for clickable links: vscode, webstorm, idea (default: vscode)
  --dark                    Use dark theme for HTML output
  -h, --help                Display this help message
  -v, --version             Display version number

Examples:
  # Analyze and generate both JSON and PNG
  graph-analyzer src/main.ts

  # Generate only JSON output
  graph-analyzer -f json -o output.json src/main.ts

  # Generate only PNG visualization
  graph-analyzer -f png -o graph.png src/main.ts

  # Generate interactive HTML visualization
  graph-analyzer -f html -o graph.html src/main.ts

  # Generate HTML with dark theme and WebStorm links
  graph-analyzer -f html --ide webstorm --dark src/main.ts

  # Specify custom tsconfig.json
  graph-analyzer -c ./tsconfig.app.json src/main.ts
`);
}

function printVersion() {
	console.log(`v${VERSION}`);
}

function parseArgs(args: string[]): CliOptions {
	const options: CliOptions = {
		entryFile: "",
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		switch (arg) {
			case "-h":
			case "--help":
				options.help = true;
				break;
			case "-v":
			case "--version":
				options.version = true;
				break;
			case "-c":
			case "--config":
				options.tsConfig = args[++i];
				break;
			case "-o":
			case "--output":
				options.output = args[++i];
				break;
			case "-f":
			case "--format": {
				const format = args[++i];
				if (
					format !== "json" &&
					format !== "png" &&
					format !== "html" &&
					format !== "both"
				) {
					throw new Error(
						`Invalid format: ${format}. Must be json, png, html, or both`,
					);
				}
				options.format = format;
				break;
			}
			case "--ide": {
				const ide = args[++i];
				if (ide !== "vscode" && ide !== "webstorm" && ide !== "idea") {
					throw new Error(
						`Invalid IDE protocol: ${ide}. Must be vscode, webstorm, or idea`,
					);
				}
				options.ideProtocol = ide;
				break;
			}
			case "--dark":
				options.darkTheme = true;
				break;
			default:
				if (!arg.startsWith("-")) {
					options.entryFile = arg;
				} else {
					throw new Error(`Unknown option: ${arg}`);
				}
		}
	}

	return options;
}

async function buildDependencyGraph(
	entryFile: string,
	tsConfig: ParseTsConfig,
	modulesGraph: Map<string, ParseNsModule | ParseEntryFile>,
): Promise<void> {
	const filesToProcess: string[] = [entryFile];
	const processed = new Set<string>();

	while (filesToProcess.length) {
		const currentFile = filesToProcess.pop() as string;
		if (processed.has(currentFile)) {
			continue;
		}

		processed.add(currentFile);

		const content = fs.readFileSync(currentFile, "utf8");
		const sourceFile = ts.createSourceFile(
			currentFile,
			content,
			ts.ScriptTarget.Latest,
			true,
		);

		const nsModuleParser = new ParseNsModule(sourceFile, currentFile, tsConfig);
		nsModuleParser.parse();

		modulesGraph.set(nsModuleParser.name as string, nsModuleParser);
		filesToProcess.push(...nsModuleParser.deps);
	}
}

async function analyzeGraph(options: CliOptions): Promise<void> {
	// Validate entry file
	if (!options.entryFile) {
		throw new Error("Entry file is required");
	}

	const entryPath = path.resolve(options.entryFile);
	if (!fs.existsSync(entryPath)) {
		throw new Error(`Entry file not found: ${entryPath}`);
	}

	// Find tsconfig.json
	let tsConfigPath = options.tsConfig
		? path.resolve(options.tsConfig)
		: path.resolve("./tsconfig.json");

	if (!fs.existsSync(tsConfigPath)) {
		// Try to find tsconfig.json in parent directories
		let currentDir = path.dirname(entryPath);
		let found = false;

		while (currentDir !== path.dirname(currentDir)) {
			const candidatePath = path.join(currentDir, "tsconfig.json");
			if (fs.existsSync(candidatePath)) {
				tsConfigPath = candidatePath;
				found = true;
				break;
			}
			currentDir = path.dirname(currentDir);
		}

		if (!found) {
			console.warn(
				"Warning: tsconfig.json not found. Using default TypeScript configuration.",
			);
			tsConfigPath = "";
		}
	}

	console.log(`Analyzing: ${entryPath}`);
	if (tsConfigPath) {
		console.log(`Using tsconfig: ${tsConfigPath}`);
	}

	// Parse entry file
	const entryContent = fs.readFileSync(entryPath, "utf8");
	const entrySourceFile = ts.createSourceFile(
		entryPath,
		entryContent,
		ts.ScriptTarget.Latest,
		true,
	);

	const basePath = tsConfigPath ? path.dirname(tsConfigPath) : process.cwd();
	const configContent = tsConfigPath ? fs.readFileSync(tsConfigPath, "utf8") : "{}";
	const parseTsConfig = new ParseTsConfig(configContent, basePath);

	const parseEntryFile = new ParseEntryFile(
		entrySourceFile,
		entryPath,
		parseTsConfig,
	);
	parseEntryFile.parse();

	if (!parseEntryFile.name) {
		throw new Error("No entry module found in entry file");
	}

	// Build dependency graph
	const modulesGraph = new Map<string, ParseNsModule | ParseEntryFile>();
	modulesGraph.set("entry", parseEntryFile);

	await buildDependencyGraph(
		parseEntryFile.imports[0],
		parseTsConfig,
		modulesGraph,
	);

	// Determine output format and paths
	const format = options.format || "both";
	const outputPath = options.output;

	const analyzerOptions: any = {
		outputFormat: format,
	};

	if (format === "json") {
		analyzerOptions.jsonOutputPath = outputPath || "./graph.json";
	} else if (format === "png") {
		analyzerOptions.pngOutputPath = outputPath || "./graph.png";
	} else if (format === "html") {
		analyzerOptions.htmlOutputPath = outputPath || "./graph.html";
		analyzerOptions.htmlOptions = {
			ideProtocol: options.ideProtocol || "vscode",
			darkTheme: options.darkTheme || false,
			title: "Dependency Graph",
		};
	} else {
		// both
		analyzerOptions.jsonOutputPath = "./graph.json";
		analyzerOptions.pngOutputPath = "./graph.png";
	}

	// Analyze and generate output
	const analyzer = new GraphAnalyzer(modulesGraph, entryPath, analyzerOptions);
	analyzer.parse();

	console.log("\nAnalysis complete!");
}

// Main CLI entry point
async function main() {
	try {
		const args = process.argv.slice(2);

		if (args.length === 0) {
			printHelp();
			process.exit(0);
		}

		const options = parseArgs(args);

		if (options.help) {
			printHelp();
			process.exit(0);
		}

		if (options.version) {
			printVersion();
			process.exit(0);
		}

		await analyzeGraph(options);
	} catch (error) {
		console.error("\nError:", (error as Error).message);
		console.error("\nRun 'graph-analyzer --help' for usage information.");
		process.exit(1);
	}
}

main();

