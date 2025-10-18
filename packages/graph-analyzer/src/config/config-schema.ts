/**
 * Configuration schema for graph-analyzer
 */

export interface GraphAnalyzerConfig {
	/**
	 * Path to the entry point file
	 */
	entryFile?: string;

	/**
	 * Path to tsconfig.json
	 */
	tsConfig?: string;

	/**
	 * Output file path
	 */
	output?: string;

	/**
	 * Output format: json, png, html, or both
	 * @default "both"
	 */
	format?: "json" | "png" | "html" | "both";

	/**
	 * IDE protocol for clickable links in HTML output
	 * @default "vscode"
	 */
	ideProtocol?: "vscode" | "webstorm" | "idea";

	/**
	 * Use dark theme for HTML output
	 * @default false
	 */
	darkTheme?: boolean;

	/**
	 * Show detailed progress information
	 * @default false
	 */
	verbose?: boolean;

	/**
	 * Suppress all output except errors
	 * @default false
	 */
	quiet?: boolean;

	/**
	 * Detect circular dependencies in modules and providers
	 * @default false
	 */
	checkCircular?: boolean;

	/**
	 * Detect providers that are registered but never injected
	 * @default false
	 */
	checkUnused?: boolean;

	/**
	 * Analyze module hierarchy depth and complexity metrics
	 * @default false
	 */
	checkDepth?: boolean;

	/**
	 * Threshold for identifying deep modules
	 * @default 5
	 */
	deepModuleThreshold?: number;

	/**
	 * Analyze provider scopes and detect scope mismatches
	 * @default false
	 */
	checkScope?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<GraphAnalyzerConfig> = {
	format: "both",
	ideProtocol: "vscode",
	darkTheme: false,
	verbose: false,
	quiet: false,
	checkCircular: false,
	checkUnused: false,
	checkDepth: false,
	deepModuleThreshold: 5,
	checkScope: false,
};

/**
 * Validates a configuration object
 * @param config - Configuration to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateConfig(config: unknown): string[] {
	const errors: string[] = [];

	if (typeof config !== "object" || config === null) {
		errors.push("Configuration must be an object");
		return errors;
	}

	const cfg = config as Record<string, unknown>;

	// Validate format
	if (cfg.format !== undefined) {
		const validFormats = ["json", "png", "html", "both"];
		if (!validFormats.includes(cfg.format as string)) {
			errors.push(
				`Invalid format: ${cfg.format}. Must be one of: ${validFormats.join(", ")}`,
			);
		}
	}

	// Validate ideProtocol
	if (cfg.ideProtocol !== undefined) {
		const validProtocols = ["vscode", "webstorm", "idea"];
		if (!validProtocols.includes(cfg.ideProtocol as string)) {
			errors.push(
				`Invalid ideProtocol: ${cfg.ideProtocol}. Must be one of: ${validProtocols.join(", ")}`,
			);
		}
	}

	// Validate boolean fields
	const booleanFields = [
		"darkTheme",
		"verbose",
		"quiet",
		"checkCircular",
		"checkUnused",
		"checkDepth",
		"checkScope",
	];
	for (const field of booleanFields) {
		if (cfg[field] !== undefined && typeof cfg[field] !== "boolean") {
			errors.push(`${field} must be a boolean`);
		}
	}

	// Validate number fields
	if (
		cfg.deepModuleThreshold !== undefined &&
		(typeof cfg.deepModuleThreshold !== "number" || cfg.deepModuleThreshold < 1)
	) {
		errors.push("deepModuleThreshold must be a positive number");
	}

	// Validate string fields
	const stringFields = ["entryFile", "tsConfig", "output"];
	for (const field of stringFields) {
		if (cfg[field] !== undefined && typeof cfg[field] !== "string") {
			errors.push(`${field} must be a string`);
		}
	}

	return errors;
}

/**
 * Merges multiple configuration objects with priority (later configs override earlier ones)
 * @param configs - Configuration objects to merge
 * @returns Merged configuration
 */
export function mergeConfigs(
	...configs: Array<Partial<GraphAnalyzerConfig>>
): Partial<GraphAnalyzerConfig> {
	const merged: Partial<GraphAnalyzerConfig> = {};

	for (const config of configs) {
		for (const key in config) {
			const value = config[key as keyof GraphAnalyzerConfig];
			if (value !== undefined) {
				// biome-ignore lint/suspicious/noExplicitAny: Dynamic config merging
				(merged as any)[key] = value;
			}
		}
	}

	return merged;
}
