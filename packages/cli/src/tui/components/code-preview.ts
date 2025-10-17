import * as clack from "@clack/prompts";
import pc from "picocolors";
import { formatCode, formatFilePath, getFileIcon } from "../utils/formatters";

/**
 * File to be previewed
 */
export interface PreviewFile {
	path: string;
	content: string;
}

/**
 * Options for code preview
 */
export interface CodePreviewOptions {
	title?: string;
	maxLines?: number;
	showLineNumbers?: boolean;
}

/**
 * Component for displaying code previews
 */
export class CodePreview {
	/**
	 * Display a preview of files to be generated
	 */
	static async show(
		files: PreviewFile[],
		options: CodePreviewOptions = {},
	): Promise<void> {
		const { title = "Preview of files to be created:", maxLines = 30 } =
			options;

		clack.log.info(pc.bold(title));
		console.log(); // Empty line for spacing

		for (const file of files) {
			CodePreview.displayFile(file, maxLines);
		}
	}

	/**
	 * Display a single file preview
	 */
	private static displayFile(file: PreviewFile, maxLines: number): void {
		const icon = getFileIcon(file.path);
		const formattedPath = formatFilePath(file.path);

		console.log(`${icon} ${formattedPath}`);
		console.log(pc.gray("─".repeat(60)));

		const lines = file.content.split("\n");
		const displayLines = lines.slice(0, maxLines);
		const truncated = lines.length > maxLines;

		// Format and display code
		const code = displayLines.join("\n");
		const highlighted = formatCode(code);
		console.log(highlighted);

		if (truncated) {
			console.log(pc.gray(`... (${lines.length - maxLines} more lines)`));
		}

		console.log(pc.gray("─".repeat(60)));
		console.log(); // Empty line for spacing
	}

	/**
	 * Show a compact file list without content
	 */
	static showFileList(files: PreviewFile[]): void {
		clack.log.info(pc.bold("Files to be created:"));
		console.log();

		for (const file of files) {
			const icon = getFileIcon(file.path);
			const formattedPath = formatFilePath(file.path);
			console.log(`  ${icon} ${formattedPath}`);
		}

		console.log();
	}

	/**
	 * Ask for confirmation before proceeding
	 */
	static async confirm(
		message = "Proceed with file generation?",
	): Promise<boolean> {
		const confirmed = await clack.confirm({
			message,
			initialValue: true,
		});

		if (clack.isCancel(confirmed)) {
			return false;
		}

		return confirmed;
	}

	/**
	 * Display a summary of what will be created
	 */
	static showSummary(summary: {
		service?: string;
		module?: string;
		tests?: boolean;
		path?: string;
	}): void {
		clack.log.info(pc.bold("Summary:"));
		console.log();

		if (summary.service) {
			console.log(`  ${pc.cyan("Service:")} ${summary.service}`);
		}

		if (summary.module) {
			console.log(`  ${pc.cyan("Module:")} ${summary.module}`);
		}

		if (summary.tests !== undefined) {
			console.log(
				`  ${pc.cyan("Tests:")} ${summary.tests ? pc.green("Yes") : pc.gray("No")}`,
			);
		}

		if (summary.path) {
			console.log(`  ${pc.cyan("Path:")} ${summary.path}`);
		}

		console.log();
	}
}
