import type { ValidationError } from "./validator";

export class ErrorFormatter {
	/**
	 * Format a validation error with clear sections
	 */
	static formatValidationError(error: ValidationError): string {
		const lines: string[] = [];

		// Header
		lines.push("");
		lines.push("=".repeat(50));
		lines.push("❌ Error");
		lines.push("=".repeat(50));
		lines.push("");

		// Error message
		lines.push(error.message);
		lines.push("");

		// Details if available
		if (error.details) {
			lines.push("Details:");
			lines.push(`  ${error.details}`);
			lines.push("");
		}

		// Suggestions
		if (error.suggestions && error.suggestions.length > 0) {
			lines.push("Suggestions:");
			for (const suggestion of error.suggestions) {
				if (suggestion === "") {
					lines.push("");
				} else {
					lines.push(`  • ${suggestion}`);
				}
			}
			lines.push("");
		}

		// Footer
		lines.push("For more help, run: graph-analyzer --help");
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Format a generic error with context-aware suggestions
	 */
	static formatError(error: Error): string {
		const lines: string[] = [];
		const errorMessage = error.message;

		// Header
		lines.push("");
		lines.push("=".repeat(50));
		lines.push("❌ Error");
		lines.push("=".repeat(50));
		lines.push("");

		// Error message
		lines.push(errorMessage);
		lines.push("");

		// Add context-aware suggestions
		const suggestions = ErrorFormatter.getSuggestionsForError(errorMessage);
		if (suggestions.length > 0) {
			lines.push("Suggestions:");
			for (const suggestion of suggestions) {
				if (suggestion === "") {
					lines.push("");
				} else {
					lines.push(`  • ${suggestion}`);
				}
			}
			lines.push("");
		}

		// Footer
		lines.push("For more help, run: graph-analyzer --help");
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Get context-aware suggestions based on error message
	 */
	private static getSuggestionsForError(errorMessage: string): string[] {
		const suggestions: string[] = [];

		// Decorator errors (check before "not found" to avoid false matches)
		if (errorMessage.toLowerCase().includes("decorator")) {
			suggestions.push("Ensure decorators are enabled in tsconfig.json:");
			suggestions.push('  "experimentalDecorators": true');
			suggestions.push('  "emitDecoratorMetadata": true');
		}

		// File not found errors
		else if (
			errorMessage.includes("not found") ||
			errorMessage.includes("ENOENT")
		) {
			suggestions.push("Check if the file path is correct");
			suggestions.push("Make sure you're in the project root directory");
			suggestions.push(
				"Use an absolute path or relative path from current directory",
			);
			suggestions.push(`Current directory: ${process.cwd()}`);
		}

		// No entry module errors
		else if (errorMessage.includes("No entry module")) {
			suggestions.push(
				"Make sure your entry file contains a NexusFactory.create() call",
			);
			suggestions.push(
				"Check that the root module is properly decorated with @NsModule",
			);
			suggestions.push("");
			suggestions.push("Example entry file:");
			suggestions.push("  import { NexusFactory } from '@nexus-ioc/core';");
			suggestions.push("  import { AppModule } from './app.module';");
			suggestions.push("");
			suggestions.push("  const app = NexusFactory.create(AppModule);");
		}

		// Invalid format errors
		else if (errorMessage.includes("Invalid format")) {
			suggestions.push("Use one of: json, png, html, or both");
			suggestions.push("Example: graph-analyzer -f json src/main.ts");
		}

		// Invalid configuration errors
		else if (errorMessage.includes("Invalid configuration")) {
			suggestions.push("Check your configuration file syntax");
			suggestions.push("Ensure all values match the expected types");
			suggestions.push("Run: graph-analyzer --init to generate a valid config");
		}

		// Configuration file errors
		else if (errorMessage.includes("Configuration file")) {
			suggestions.push("Check if the configuration file exists");
			suggestions.push("Verify the file path is correct");
			suggestions.push("Run: graph-analyzer --init to create a new config");
		}

		// TypeScript compilation errors
		else if (
			errorMessage.includes("Cannot read properties") ||
			errorMessage.includes("undefined")
		) {
			suggestions.push("Check your TypeScript configuration (tsconfig.json)");
			suggestions.push("Ensure all required compiler options are set");
			suggestions.push("Verify that your entry file is valid TypeScript");
			suggestions.push("");
			suggestions.push("Try specifying tsconfig.json explicitly:");
			suggestions.push("  graph-analyzer -c ./tsconfig.json src/main.ts");
		}

		// Permission errors
		else if (
			errorMessage.includes("EACCES") ||
			errorMessage.includes("permission")
		) {
			suggestions.push("Check file and directory permissions");
			suggestions.push("Make sure you have read/write access");
			suggestions.push("Try running with appropriate permissions");
		}

		// Module resolution errors
		else if (
			errorMessage.includes("Cannot find module") ||
			errorMessage.includes("Module not found")
		) {
			suggestions.push("Check that all dependencies are installed");
			suggestions.push("Run: npm install or yarn install");
			suggestions.push("Verify import paths in your code");
			suggestions.push("Check your tsconfig.json paths configuration");
		}

		// Generic fallback
		else {
			suggestions.push("Check the error message above for details");
			suggestions.push("Verify your configuration and file paths");
			suggestions.push("Try running with --verbose for more information");
		}

		return suggestions;
	}

	/**
	 * Format a success message
	 */
	static formatSuccess(message: string): string {
		return `✓ ${message}`;
	}

	/**
	 * Format a warning message
	 */
	static formatWarning(message: string): string {
		return `⚠ ${message}`;
	}

	/**
	 * Format an info message
	 */
	static formatInfo(message: string): string {
		return `ℹ ${message}`;
	}
}
