import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface ValidationError {
	type: string;
	message: string;
	suggestions: string[];
	details?: string;
}

export class Validator {
	/**
	 * Validate that a file exists
	 */
	static validateFileExists(filePath: string): ValidationError | null {
		const absolutePath = path.resolve(filePath);

		if (!fs.existsSync(absolutePath)) {
			return {
				type: "FILE_NOT_FOUND",
				message: `File not found: ${absolutePath}`,
				suggestions: [
					"Check if the file path is correct",
					"Make sure you're in the project root directory",
					"Use an absolute path or relative path from current directory",
					`Current directory: ${process.cwd()}`,
				],
				details: `Looking for: ${absolutePath}`,
			};
		}

		return null;
	}

	/**
	 * Validate that a file has a valid TypeScript extension
	 */
	static validateTypeScriptFile(filePath: string): ValidationError | null {
		const ext = path.extname(filePath).toLowerCase();
		const validExtensions = [".ts", ".tsx"];

		if (!validExtensions.includes(ext)) {
			return {
				type: "INVALID_FILE_EXTENSION",
				message: `Invalid file extension: ${ext}`,
				suggestions: [
					"Entry file must be a TypeScript file (.ts or .tsx)",
					`Provided file: ${filePath}`,
					"Example: graph-analyzer src/main.ts",
				],
			};
		}

		return null;
	}

	/**
	 * Validate that a file is readable
	 */
	static validateFileReadable(filePath: string): ValidationError | null {
		const absolutePath = path.resolve(filePath);

		try {
			fs.accessSync(absolutePath, fs.constants.R_OK);
			return null;
		} catch (error) {
			return {
				type: "FILE_NOT_READABLE",
				message: `Cannot read file: ${absolutePath}`,
				suggestions: [
					"Check file permissions",
					"Make sure you have read access to the file",
					"Try running with appropriate permissions",
				],
				details: (error as Error).message,
			};
		}
	}

	/**
	 * Validate that tsconfig.json exists if specified
	 */
	static validateTsConfig(
		tsConfigPath: string | undefined,
	): ValidationError | null {
		if (!tsConfigPath) {
			return null; // Optional, so no error if not provided
		}

		const absolutePath = path.resolve(tsConfigPath);

		if (!fs.existsSync(absolutePath)) {
			return {
				type: "TSCONFIG_NOT_FOUND",
				message: `TypeScript configuration file not found: ${absolutePath}`,
				suggestions: [
					"Check if tsconfig.json exists in your project",
					"Verify the path to tsconfig.json is correct",
					"Create a tsconfig.json file if it doesn't exist",
					"Omit the -c flag to auto-detect tsconfig.json",
				],
				details: `Looking for: ${absolutePath}`,
			};
		}

		// Validate it's a valid JSON file
		try {
			const content = fs.readFileSync(absolutePath, "utf8");
			JSON.parse(content);
			return null;
		} catch (error) {
			return {
				type: "INVALID_TSCONFIG",
				message: `Invalid TypeScript configuration file: ${absolutePath}`,
				suggestions: [
					"Check that tsconfig.json is valid JSON",
					"Fix any syntax errors in the file",
					"Validate your tsconfig.json using a JSON validator",
				],
				details: (error as Error).message,
			};
		}
	}

	/**
	 * Check if Graphviz is installed (required for PNG generation)
	 */
	static validateGraphvizInstalled(
		format: string | undefined,
	): ValidationError | null {
		// Only check if PNG output is requested
		if (format !== "png" && format !== "both" && format !== undefined) {
			return null;
		}

		try {
			const result = spawnSync("dot", ["-V"], {
				stdio: "pipe",
				encoding: "utf8",
			});

			// Graphviz returns version info on stderr
			if (result.error || (!result.stdout && !result.stderr)) {
				return {
					type: "GRAPHVIZ_NOT_FOUND",
					message: "Graphviz is not installed or not in PATH",
					suggestions: [
						"Install Graphviz to generate PNG visualizations",
						"",
						"Installation instructions:",
						"  • macOS: brew install graphviz",
						"  • Ubuntu/Debian: sudo apt-get install graphviz",
						"  • Windows: choco install graphviz",
						"  • Or download from: https://graphviz.org/download/",
						"",
						"Alternatively, use JSON or HTML format instead:",
						"  graph-analyzer -f json src/main.ts",
						"  graph-analyzer -f html src/main.ts",
					],
				};
			}

			return null;
		} catch (_error) {
			return {
				type: "GRAPHVIZ_NOT_FOUND",
				message: "Graphviz is not installed or not in PATH",
				suggestions: [
					"Install Graphviz to generate PNG visualizations",
					"",
					"Installation instructions:",
					"  • macOS: brew install graphviz",
					"  • Ubuntu/Debian: sudo apt-get install graphviz",
					"  • Windows: choco install graphviz",
					"  • Or download from: https://graphviz.org/download/",
					"",
					"Alternatively, use JSON or HTML format instead:",
					"  graph-analyzer -f json src/main.ts",
					"  graph-analyzer -f html src/main.ts",
				],
			};
		}
	}

	/**
	 * Validate entry file comprehensively
	 */
	static validateEntryFile(filePath: string): ValidationError | null {
		// Check if file exists
		const existsError = Validator.validateFileExists(filePath);
		if (existsError) return existsError;

		// Check if it's a TypeScript file
		const tsError = Validator.validateTypeScriptFile(filePath);
		if (tsError) return tsError;

		// Check if file is readable
		const readableError = Validator.validateFileReadable(filePath);
		if (readableError) return readableError;

		return null;
	}

	/**
	 * Validate output directory is writable
	 */
	static validateOutputDirectory(outputPath: string): ValidationError | null {
		const dir = path.dirname(path.resolve(outputPath));

		// Check if directory exists
		if (!fs.existsSync(dir)) {
			try {
				fs.mkdirSync(dir, { recursive: true });
				return null;
			} catch (error) {
				return {
					type: "OUTPUT_DIR_NOT_WRITABLE",
					message: `Cannot create output directory: ${dir}`,
					suggestions: [
						"Check that you have write permissions",
						"Verify the parent directory exists",
						"Try using a different output path",
					],
					details: (error as Error).message,
				};
			}
		}

		// Check if directory is writable
		try {
			fs.accessSync(dir, fs.constants.W_OK);
			return null;
		} catch (error) {
			return {
				type: "OUTPUT_DIR_NOT_WRITABLE",
				message: `Output directory is not writable: ${dir}`,
				suggestions: [
					"Check directory permissions",
					"Make sure you have write access to the directory",
					"Try running with appropriate permissions",
					"Use a different output directory",
				],
				details: (error as Error).message,
			};
		}
	}

	/**
	 * Run all pre-flight validations
	 */
	static runPreflightChecks(options: {
		entryFile: string;
		tsConfig?: string;
		output?: string;
		format?: string;
	}): ValidationError | null {
		// Validate entry file
		const entryError = Validator.validateEntryFile(options.entryFile);
		if (entryError) return entryError;

		// Validate tsconfig if provided
		const tsConfigError = Validator.validateTsConfig(options.tsConfig);
		if (tsConfigError) return tsConfigError;

		// Validate Graphviz for PNG generation
		const graphvizError = Validator.validateGraphvizInstalled(options.format);
		if (graphvizError) return graphvizError;

		// Validate output directory if provided
		if (options.output) {
			const outputError = Validator.validateOutputDirectory(options.output);
			if (outputError) return outputError;
		}

		return null;
	}
}
