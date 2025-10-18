import * as fs from "node:fs";
import * as path from "node:path";
import type { GraphAnalyzerConfig } from "./config-schema";
import { validateConfig } from "./config-schema";

/**
 * Configuration file names to search for (in order of priority)
 */
const CONFIG_FILE_NAMES = [
	".graph-analyzer.json",
	"graph-analyzer.config.json",
	"graph-analyzer.config.js",
];

/**
 * Loads configuration from a file
 * @param configPath - Path to configuration file
 * @returns Parsed configuration object
 * @throws Error if file cannot be read or parsed
 */
export function loadConfigFile(
	configPath: string,
): Partial<GraphAnalyzerConfig> {
	if (!fs.existsSync(configPath)) {
		throw new Error(`Configuration file not found: ${configPath}`);
	}

	const ext = path.extname(configPath);

	try {
		if (ext === ".json") {
			return loadJsonConfig(configPath);
		}
		if (ext === ".js") {
			return loadJsConfig(configPath);
		}
		throw new Error(
			`Unsupported configuration file format: ${ext}. Use .json or .js`,
		);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to load configuration: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Loads JSON configuration file
 */
function loadJsonConfig(configPath: string): Partial<GraphAnalyzerConfig> {
	const content = fs.readFileSync(configPath, "utf8");
	const config = JSON.parse(content);

	const errors = validateConfig(config);
	if (errors.length > 0) {
		throw new Error(
			`Invalid configuration:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
		);
	}

	return config;
}

/**
 * Loads JavaScript configuration file
 */
function loadJsConfig(configPath: string): Partial<GraphAnalyzerConfig> {
	// Clear require cache to allow reloading
	delete require.cache[path.resolve(configPath)];

	// biome-ignore lint/security/noGlobalEval: Configuration files need to be evaluated
	const config = require(path.resolve(configPath));

	// Handle both module.exports and default export
	const actualConfig = config.default || config;

	const errors = validateConfig(actualConfig);
	if (errors.length > 0) {
		throw new Error(
			`Invalid configuration:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
		);
	}

	return actualConfig;
}

/**
 * Searches for a configuration file in the current directory and parent directories
 * @param startDir - Directory to start searching from
 * @returns Path to configuration file or null if not found
 */
export function findConfigFile(
	startDir: string = process.cwd(),
): string | null {
	let currentDir = path.resolve(startDir);

	while (true) {
		// Check each config file name in order
		for (const fileName of CONFIG_FILE_NAMES) {
			const configPath = path.join(currentDir, fileName);
			if (fs.existsSync(configPath)) {
				return configPath;
			}
		}

		// Move to parent directory
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			// Reached root directory
			break;
		}
		currentDir = parentDir;
	}

	return null;
}

/**
 * Loads configuration from file or returns empty config if not found
 * @param configPath - Optional explicit path to config file
 * @param searchDir - Directory to start searching for config file
 * @returns Configuration object
 */
export function loadConfig(
	configPath?: string,
	searchDir?: string,
): Partial<GraphAnalyzerConfig> {
	// If explicit path provided, use it
	if (configPath) {
		return loadConfigFile(configPath);
	}

	// Otherwise search for config file
	const foundPath = findConfigFile(searchDir);
	if (foundPath) {
		return loadConfigFile(foundPath);
	}

	// No config file found, return empty config
	return {};
}

/**
 * Generates a default configuration file
 * @param outputPath - Path where to write the config file
 * @param format - Format of the config file (json or js)
 */
export function generateConfigFile(
	outputPath: string,
	format: "json" | "js" = "json",
): void {
	const dir = path.dirname(outputPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	if (format === "json") {
		const config = {
			$schema:
				"Configuration for @nexus-ioc/graph-analyzer - see https://github.com/Isqanderm/ioc/tree/main/packages/graph-analyzer",
			entryFile: "src/main.ts",
			tsConfig: "./tsconfig.json",
			output: "./graph",
			format: "both",
			ideProtocol: "vscode",
			darkTheme: false,
			verbose: false,
			quiet: false,
		};

		fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), "utf8");
	} else {
		const jsContent = `/**
 * Configuration for @nexus-ioc/graph-analyzer
 * @see https://github.com/Isqanderm/ioc/tree/main/packages/graph-analyzer
 */
module.exports = {
  /**
   * Path to the entry point file
   * @type {string}
   */
  entryFile: 'src/main.ts',

  /**
   * Path to tsconfig.json
   * @type {string}
   */
  tsConfig: './tsconfig.json',

  /**
   * Output file path (extension will be added based on format)
   * @type {string}
   */
  output: './graph',

  /**
   * Output format: 'json', 'png', 'html', or 'both'
   * @type {'json' | 'png' | 'html' | 'both'}
   * @default 'both'
   */
  format: 'both',

  /**
   * IDE protocol for clickable links in HTML output
   * @type {'vscode' | 'webstorm' | 'idea'}
   * @default 'vscode'
   */
  ideProtocol: 'vscode',

  /**
   * Use dark theme for HTML output
   * @type {boolean}
   * @default false
   */
  darkTheme: false,

  /**
   * Show detailed progress information
   * @type {boolean}
   * @default false
   */
  verbose: false,

  /**
   * Suppress all output except errors
   * @type {boolean}
   * @default false
   */
  quiet: false,
};
`;

		fs.writeFileSync(outputPath, jsContent, "utf8");
	}
}
