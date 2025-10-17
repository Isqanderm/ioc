import { highlight } from "cli-highlight";
import pc from "picocolors";
import prettier from "prettier";

/**
 * Formatting utilities for TUI display
 */

/**
 * Formats TypeScript code with syntax highlighting for terminal display
 * NOTE: This adds ANSI color codes and should ONLY be used for display purposes,
 * NOT for writing to files!
 */
export function formatCode(code: string, language = "typescript"): string {
	try {
		return highlight(code, { language, ignoreIllegals: true });
	} catch (_error) {
		// Fallback to plain text if highlighting fails
		return code;
	}
}

/**
 * Formats TypeScript code using Prettier for file writing
 * This should be used when writing code to files, NOT for terminal display
 */
export async function prettifyCode(
	code: string,
	filepath: string,
): Promise<string> {
	try {
		return await prettier.format(code, {
			filepath,
			parser: "typescript",
		});
	} catch (_error) {
		// Fallback to original code if formatting fails
		return code;
	}
}

/**
 * Formats a file path for display
 */
export function formatFilePath(path: string): string {
	return pc.cyan(path);
}

/**
 * Formats a success message
 */
export function formatSuccess(message: string): string {
	return pc.green(`✓ ${message}`);
}

/**
 * Formats an error message
 */
export function formatError(message: string): string {
	return pc.red(`✗ ${message}`);
}

/**
 * Formats a warning message
 */
export function formatWarning(message: string): string {
	return pc.yellow(`⚠ ${message}`);
}

/**
 * Formats an info message
 */
export function formatInfo(message: string): string {
	return pc.blue(`ℹ ${message}`);
}

/**
 * Formats a file icon based on extension
 */
export function getFileIcon(filename: string): string {
	// Check more specific extensions first
	if (filename.endsWith(".spec.ts")) return "🧪";
	if (filename.endsWith(".module.ts")) return "📦";
	if (filename.endsWith(".service.ts")) return "⚙️";
	if (filename.endsWith(".ts")) return "📘";
	if (filename.endsWith(".json")) return "📄";
	return "📄";
}

/**
 * Formats a list of files for preview
 */
export function formatFileList(files: string[]): string {
	return files
		.map((file) => `  ${getFileIcon(file)} ${formatFilePath(file)}`)
		.join("\n");
}

/**
 * Capitalizes the first letter of a string
 */
export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a string to PascalCase
 */
export function toPascalCase(str: string): string {
	return str
		.split(/[-_\s]+/)
		.map((word) => capitalize(word))
		.join("");
}

/**
 * Converts a string to kebab-case
 */
export function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}
