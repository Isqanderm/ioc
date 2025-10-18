#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import * as cliSpinners from "cli-spinners";
import * as ts from "typescript";
import {
	findConfigFile,
	generateConfigFile,
	loadConfig,
} from "./config/config-loader";
import { DEFAULT_CONFIG, mergeConfigs } from "./config/config-schema";
import { ParseEntryFile } from "./parser/parse-entry-file";
import { ParseNsModule } from "./parser/parse-ns-module";
import { ParseTsConfig } from "./parser/parse-ts-config";
import { ErrorFormatter } from "./utils/error-formatter";
import { Validator } from "./utils/validator";
import { GraphAnalyzer } from "./visualize/graph-analyzer";

interface CliOptions {
	entryFile: string;
	tsConfig?: string;
	output?: string;
	format?: "json" | "png" | "html" | "both";
	help?: boolean;
	version?: boolean;
	ideProtocol?: "vscode" | "webstorm" | "idea";
	darkTheme?: boolean;
	verbose?: boolean;
	quiet?: boolean;
	configFile?: string;
	init?: "json" | "js" | boolean;
	checkCircular?: boolean;
	checkUnused?: boolean;
	checkDepth?: boolean;
	deepModuleThreshold?: number;
	checkScope?: boolean;
}

interface AnalysisStats {
	modulesCount: number;
	providersCount: number;
	dependenciesCount: number;
	outputFiles: string[];
	duration: number;
}

// Read version from package.json
function getVersion(): string {
	try {
		const packageJsonPath = path.join(__dirname, "../package.json");
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
		return packageJson.version || "unknown";
	} catch (_error) {
		return "unknown";
	}
}

const VERSION = getVersion();

// Simple spinner implementation
class Spinner {
	private interval: NodeJS.Timeout | null = null;
	private frameIndex = 0;
	private text = "";
	private readonly frames: string[];

	constructor(text: string) {
		this.text = text;
		this.frames = cliSpinners.dots.frames;
	}

	start(): this {
		process.stdout.write("\x1B[?25l"); // Hide cursor
		this.render();
		this.interval = setInterval(() => {
			this.frameIndex = (this.frameIndex + 1) % this.frames.length;
			this.render();
		}, cliSpinners.dots.interval);
		return this;
	}

	private render(): void {
		const frame = this.frames[this.frameIndex];
		process.stdout.write(`\r${frame} ${this.text}`);
	}

	private clear(): void {
		process.stdout.write(`\r${" ".repeat(this.text.length + 10)}\r`);
	}

	succeed(text?: string): void {
		this.stop();
		this.clear();
		console.log(`✓ ${text || this.text}`);
	}

	fail(text?: string): void {
		this.stop();
		this.clear();
		console.log(`✗ ${text || this.text}`);
	}

	warn(text?: string): void {
		this.stop();
		this.clear();
		console.log(`⚠ ${text || this.text}`);
	}

	stop(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		process.stdout.write("\x1B[?25h"); // Show cursor
	}
}

// Logger utility that respects verbosity settings
class Logger {
	constructor(
		private isVerbose: boolean,
		private isQuiet: boolean,
	) {}

	log(message: string): void {
		if (!this.isQuiet) {
			console.log(message);
		}
	}

	verbose(message: string): void {
		if (this.isVerbose && !this.isQuiet) {
			console.log(message);
		}
	}

	warn(message: string): void {
		if (!this.isQuiet) {
			console.warn(message);
		}
	}

	error(message: string): void {
		console.error(message);
	}

	success(message: string): void {
		if (!this.isQuiet) {
			console.log(`✓ ${message}`);
		}
	}
}

function printHelp() {
	console.log(`
Nexus IoC Graph Analyzer v${VERSION}

Usage: graph-analyzer [options] <entry-file>
       graph-analyzer --init [json|js]

Analyzes Nexus IoC dependency injection graphs and generates visualizations.

Arguments:
  <entry-file>              Path to the entry point file (e.g., src/main.ts)

Options:
  -c, --config <path>       Path to tsconfig.json (default: ./tsconfig.json)
  --config-file <path>      Path to configuration file (.graph-analyzer.json or .js)
  -o, --output <path>       Output file path (default: ./graph.json, ./graph.png, or ./graph.html)
  -f, --format <format>     Output format: json, png, html, or both (default: both)
  --ide <protocol>          IDE protocol for clickable links: vscode, webstorm, idea (default: vscode)
  --dark                    Use dark theme for HTML output
  --check-circular          Detect circular dependencies in modules and providers
  --check-unused            Detect providers that are registered but never injected
  --check-depth             Analyze module hierarchy depth and complexity metrics
  --depth-threshold <n>     Threshold for identifying deep modules (default: 5)
  --check-scope             Analyze provider scopes and detect scope mismatches
  --verbose                 Show detailed progress information
  --quiet                   Suppress all output except errors
  --init [json|js]          Generate a configuration file (default: json)
  -h, --help                Display this help message
  -v, --version             Display version number

Configuration File:
  The tool automatically searches for configuration files in the following order:
    1. .graph-analyzer.json
    2. graph-analyzer.config.json
    3. graph-analyzer.config.js

  CLI arguments override configuration file settings.

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

  # Use custom configuration file
  graph-analyzer --config-file ./my-config.json

  # Initialize configuration file
  graph-analyzer --init json
  graph-analyzer --init js

  # Verbose output for debugging
  graph-analyzer --verbose src/main.ts

  # Quiet mode for CI/CD
  graph-analyzer --quiet src/main.ts
`);
}

function printVersion() {
	console.log(`v${VERSION}`);
}

function parseArgs(args: string[]): Partial<CliOptions> {
	const options: Partial<CliOptions> = {};

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
			case "--config-file":
				options.configFile = args[++i];
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
			case "--verbose":
				options.verbose = true;
				break;
			case "--quiet":
				options.quiet = true;
				break;
			case "--check-circular":
				options.checkCircular = true;
				break;
			case "--check-unused":
				options.checkUnused = true;
				break;
			case "--check-depth":
				options.checkDepth = true;
				break;
			case "--depth-threshold": {
				const threshold = Number.parseInt(args[++i], 10);
				if (Number.isNaN(threshold) || threshold < 1) {
					console.error("Invalid depth threshold. Must be a positive integer.");
					process.exit(1);
				}
				options.deepModuleThreshold = threshold;
				break;
			}
			case "--check-scope":
				options.checkScope = true;
				break;
			case "--init": {
				const nextArg = args[i + 1];
				if (nextArg === "json" || nextArg === "js") {
					options.init = nextArg;
					i++;
				} else {
					options.init = "json"; // default to json
				}
				break;
			}
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
	const startTime = Date.now();
	const logger = new Logger(options.verbose || false, options.quiet || false);
	const stats: AnalysisStats = {
		modulesCount: 0,
		providersCount: 0,
		dependenciesCount: 0,
		outputFiles: [],
		duration: 0,
	};

	// Validate entry file
	if (!options.entryFile) {
		throw new Error("Entry file is required");
	}

	// Run pre-flight validation checks
	const validationError = Validator.runPreflightChecks({
		entryFile: options.entryFile,
		tsConfig: options.tsConfig,
		output: options.output,
		format: options.format,
	});

	if (validationError) {
		console.error(ErrorFormatter.formatValidationError(validationError));
		process.exit(1);
	}

	const entryPath = path.resolve(options.entryFile);

	// Find tsconfig.json
	let spinner = options.quiet
		? null
		: new Spinner("Finding TypeScript configuration...").start();
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
			if (spinner) {
				spinner.warn(
					"tsconfig.json not found. Using default TypeScript configuration.",
				);
			} else {
				logger.warn(
					"Warning: tsconfig.json not found. Using default TypeScript configuration.",
				);
			}
			tsConfigPath = "";
			spinner = null;
		}
	}

	if (spinner) {
		spinner.succeed("Configuration loaded");
	}

	logger.log(`\nAnalyzing: ${entryPath}`);
	if (tsConfigPath) {
		logger.verbose(`Using tsconfig: ${tsConfigPath}`);
	}

	// Parse entry file
	spinner = options.quiet ? null : new Spinner("Parsing entry file...").start();
	logger.verbose(`Reading: ${entryPath}`);

	const entryContent = fs.readFileSync(entryPath, "utf8");
	const entrySourceFile = ts.createSourceFile(
		entryPath,
		entryContent,
		ts.ScriptTarget.Latest,
		true,
	);

	const basePath = tsConfigPath ? path.dirname(tsConfigPath) : process.cwd();
	const configContent = tsConfigPath
		? fs.readFileSync(tsConfigPath, "utf8")
		: "{}";
	const parseTsConfig = new ParseTsConfig(configContent, basePath);

	const parseEntryFile = new ParseEntryFile(
		entrySourceFile,
		entryPath,
		parseTsConfig,
	);
	parseEntryFile.parse();

	if (!parseEntryFile.name) {
		if (spinner) spinner.fail("No entry module found");
		throw new Error("No entry module found in entry file");
	}

	if (spinner) {
		spinner.succeed(`Entry file parsed (root module: ${parseEntryFile.name})`);
	}
	logger.verbose(`Root module: ${parseEntryFile.name}`);

	// Build dependency graph
	spinner = options.quiet
		? null
		: new Spinner("Building module graph...").start();
	const modulesGraph = new Map<string, ParseNsModule | ParseEntryFile>();
	modulesGraph.set("entry", parseEntryFile);

	await buildDependencyGraph(
		parseEntryFile.imports[0],
		parseTsConfig,
		modulesGraph,
	);

	stats.modulesCount = modulesGraph.size - 1; // Exclude 'entry'
	if (spinner) {
		spinner.succeed(`Module graph built (${stats.modulesCount} modules)`);
	}
	logger.verbose(`Found ${stats.modulesCount} modules`);

	// Count providers and dependencies
	spinner = options.quiet
		? null
		: new Spinner("Analyzing dependencies...").start();
	for (const [key, module] of modulesGraph) {
		if (key === "entry") continue;
		const nsModule = module as ParseNsModule;
		stats.providersCount += nsModule.providers?.length || 0;

		// Count dependencies
		for (const provider of nsModule.providers || []) {
			stats.dependenciesCount += provider.dependencies?.length || 0;
		}
	}

	if (spinner) {
		spinner.succeed(
			`Dependencies analyzed (${stats.providersCount} providers, ${stats.dependenciesCount} dependencies)`,
		);
	}
	logger.verbose(`Providers: ${stats.providersCount}`);
	logger.verbose(`Dependencies: ${stats.dependenciesCount}`);

	// Determine output format and paths
	const format = options.format || "both";
	const outputPath = options.output;

	// biome-ignore lint/suspicious/noExplicitAny: GraphAnalyzerOptions type is complex
	const analyzerOptions: any = {
		outputFormat: format,
		checkCircular: options.checkCircular || false,
		checkUnused: options.checkUnused || false,
		checkDepth: options.checkDepth || false,
		deepModuleThreshold: options.deepModuleThreshold || 5,
		checkScope: options.checkScope || false,
	};

	if (format === "json") {
		analyzerOptions.jsonOutputPath = outputPath || "./graph.json";
		stats.outputFiles.push(analyzerOptions.jsonOutputPath);
	} else if (format === "png") {
		analyzerOptions.pngOutputPath = outputPath || "./graph.png";
		stats.outputFiles.push(analyzerOptions.pngOutputPath);
	} else if (format === "html") {
		analyzerOptions.htmlOutputPath = outputPath || "./graph.html";
		stats.outputFiles.push(analyzerOptions.htmlOutputPath);
		analyzerOptions.htmlOptions = {
			ideProtocol: options.ideProtocol || "vscode",
			darkTheme: options.darkTheme || false,
			title: "Dependency Graph",
		};
	} else {
		// both
		analyzerOptions.jsonOutputPath = "./graph.json";
		analyzerOptions.pngOutputPath = "./graph.png";
		stats.outputFiles.push("./graph.json", "./graph.png");
	}

	// Generate output
	spinner = options.quiet ? null : new Spinner("Generating output...").start();
	const analyzer = new GraphAnalyzer(modulesGraph, entryPath, analyzerOptions);
	analyzer.parse();

	if (spinner) {
		spinner.succeed("Output generated");
	}

	// Calculate duration
	stats.duration = Date.now() - startTime;

	// Display summary
	if (!options.quiet) {
		console.log(`\n${"=".repeat(50)}`);
		console.log("✓ Analysis Complete!");
		console.log("=".repeat(50));
		console.log(`\nStatistics:`);
		console.log(`  Modules:      ${stats.modulesCount}`);
		console.log(`  Providers:    ${stats.providersCount}`);
		console.log(`  Dependencies: ${stats.dependenciesCount}`);
		console.log(`  Duration:     ${(stats.duration / 1000).toFixed(2)}s`);
		console.log(`\nOutput Files:`);
		for (const file of stats.outputFiles) {
			const size = fs.existsSync(file)
				? `(${(fs.statSync(file).size / 1024).toFixed(1)} KB)`
				: "";
			console.log(`  ✓ ${file} ${size}`);
		}
		console.log("");
	}
}

// Main CLI entry point
async function main() {
	try {
		const args = process.argv.slice(2);

		// Parse args first to check for special commands
		const options = parseArgs(args);

		if (options.help) {
			printHelp();
			process.exit(0);
		}

		if (options.version) {
			printVersion();
			process.exit(0);
		}

		// Handle --init command
		if (options.init) {
			const format = options.init === true ? "json" : options.init;
			const fileName =
				format === "json" ? ".graph-analyzer.json" : "graph-analyzer.config.js";
			const outputPath = path.resolve(fileName);

			if (fs.existsSync(outputPath)) {
				console.error(`\n❌ Configuration file already exists: ${fileName}`);
				console.error(
					"\nTo overwrite, delete the existing file first or use a different name.\n",
				);
				process.exit(1);
			}

			generateConfigFile(outputPath, format);
			console.log(`\n✓ Configuration file created: ${fileName}`);
			console.log("\nYou can now customize the configuration and run:");
			console.log(`  graph-analyzer\n`);
			process.exit(0);
		}

		// Load configuration file
		let fileConfig = {};
		let configPath: string | null = null;
		try {
			fileConfig = loadConfig(options.configFile);
			configPath = options.configFile || findConfigFile();
			if (configPath && !options.quiet) {
				console.log(`Using configuration from: ${configPath}`);
			}
		} catch (error) {
			if (options.configFile) {
				// If user explicitly specified a config file, throw error
				throw error;
			}
			// Otherwise, silently ignore (no config file found)
		}

		// Merge configurations: defaults < file config < CLI options
		const mergedOptions = mergeConfigs(DEFAULT_CONFIG, fileConfig, options);

		// If no entry file provided and no config file, show help
		if (!mergedOptions.entryFile && args.length === 0) {
			printHelp();
			process.exit(0);
		}

		await analyzeGraph(mergedOptions as CliOptions);
	} catch (error) {
		// Use the error formatter for consistent error messages
		console.error(ErrorFormatter.formatError(error as Error));
		process.exit(1);
	}
}

main();
