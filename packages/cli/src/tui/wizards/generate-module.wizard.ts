import * as path from "node:path";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import type { GenerateAction } from "../../actions/generate.action";
import type { Input } from "../../commands/command.input";
import { ModuleTemplate } from "../../templates/module.template";
import { CodePreview, type PreviewFile } from "../components/code-preview";
import { capitalize } from "../utils/formatters";
import { ProjectScanner, type ServiceInfo } from "../utils/project-scanner";
import { validateComponentName, validatePath } from "../utils/validators";

/**
 * Wizard for generating a new module
 */
export class GenerateModuleWizard {
	private scanner: ProjectScanner;

	constructor(private readonly generateAction: GenerateAction) {
		this.scanner = new ProjectScanner();
	}

	/**
	 * Run the module generation wizard
	 */
	async run(): Promise<void> {
		clack.intro(pc.bgMagenta(pc.black(" Generate Module ")));

		try {
			// Step 1: Get module name
			const moduleName = await this.promptModuleName();
			if (!moduleName) {
				clack.cancel("Module generation cancelled");
				return;
			}

			// Step 2: Get output path
			const outputPath = await this.promptOutputPath();
			if (!outputPath) {
				clack.cancel("Module generation cancelled");
				return;
			}

			// Step 3: Import existing providers (optional)
			const providers = await this.promptProviders();
			if (providers === null) {
				clack.cancel("Module generation cancelled");
				return;
			}

			// Step 4: Preview files
			const files = this.generatePreviewFiles(
				moduleName,
				outputPath,
				providers,
			);

			CodePreview.showSummary({
				module: `${moduleName}Module`,
				path: outputPath,
			});

			if (providers.length > 0) {
				clack.log.info(
					pc.bold(
						`Providers: ${pc.cyan(providers.map((p) => p.className).join(", "))}`,
					),
				);
				console.log();
			}

			await CodePreview.show(files, {
				title: "Preview of files to be created:",
				maxLines: 25,
			});

			// Step 5: Confirm generation
			const confirmed = await CodePreview.confirm();
			if (!confirmed) {
				clack.cancel("Module generation cancelled");
				return;
			}

			// Step 6: Generate files
			await this.generateFiles(moduleName, outputPath, providers);

			clack.outro(pc.green("✓ Module generated successfully!"));
		} catch (error) {
			clack.log.error(`Error: ${error}`);
			clack.cancel("Module generation failed");
		}
	}

	/**
	 * Prompt for module name
	 */
	private async promptModuleName(): Promise<string | null> {
		const name = await clack.text({
			message: "What is the module name?",
			placeholder: "User",
			validate: validateComponentName,
		});

		if (clack.isCancel(name)) {
			return null;
		}

		return capitalize(name as string);
	}

	/**
	 * Prompt for output path
	 */
	private async promptOutputPath(): Promise<string | null> {
		const suggestions = await this.scanner.getSuggestedPaths();

		const outputPath = await clack.text({
			message: "Where should the module be created?",
			placeholder: suggestions[0] || "./src",
			defaultValue: suggestions[0] || "./src",
			validate: validatePath,
		});

		if (clack.isCancel(outputPath)) {
			return null;
		}

		return outputPath as string;
	}

	/**
	 * Prompt for providers to import
	 */
	private async promptProviders(): Promise<ServiceInfo[] | null> {
		const services = await this.scanner.findServices();

		if (services.length === 0) {
			clack.log.warn("No existing services found in the project");
			return [];
		}

		const importProviders = await clack.confirm({
			message: "Import existing providers?",
			initialValue: false,
		});

		if (clack.isCancel(importProviders)) {
			return null;
		}

		if (!importProviders) {
			return [];
		}

		// Multi-select providers
		const options = services.map((service) => ({
			value: service.className,
			label: service.className,
			hint: service.relativePath,
		}));

		const selected = await clack.multiselect({
			message: "Select providers to import:",
			options,
			required: false,
		});

		if (clack.isCancel(selected)) {
			return null;
		}

		// Map selected class names back to ServiceInfo
		const selectedClassNames = selected as string[];
		return services.filter((s) => selectedClassNames.includes(s.className));
	}

	/**
	 * Generate preview files
	 */
	private generatePreviewFiles(
		moduleName: string,
		outputPath: string,
		providers: ServiceInfo[],
	): PreviewFile[] {
		const files: PreviewFile[] = [];

		// Module file
		const moduleTemplate = new ModuleTemplate({ name: moduleName });

		// Add providers to the module
		if (providers.length > 0) {
			moduleTemplate.addProvider(providers.map((p) => p.className));
		}

		// Generate imports for providers
		const imports = providers
			.map((p) => {
				const relativePath = this.getRelativeImportPath(outputPath, p.filePath);
				return `import { ${p.className} } from '${relativePath}';`;
			})
			.join("\n");

		const moduleContent = `import { NsModule } from '@nexus-ioc/core';
${imports ? `${imports}\n` : ""}
${moduleTemplate.generate()}`;

		files.push({
			path: path.join(outputPath, `${moduleName.toLowerCase()}.module.ts`),
			content: moduleContent,
		});

		return files;
	}

	/**
	 * Get relative import path between two files
	 */
	private getRelativeImportPath(fromDir: string, toFile: string): string {
		const from = this.scanner.resolvePath(fromDir);
		const to = this.scanner.resolvePath(toFile);

		let relativePath = path.relative(from, to);

		// Remove .ts extension
		relativePath = relativePath.replace(/\.ts$/, "");

		// Ensure it starts with ./ or ../
		if (!relativePath.startsWith(".")) {
			relativePath = `./${relativePath}`;
		}

		// Convert Windows paths to Unix-style
		relativePath = relativePath.replace(/\\/g, "/");

		return relativePath;
	}

	/**
	 * Generate the actual files
	 */
	private async generateFiles(
		moduleName: string,
		outputPath: string,
		providers: ServiceInfo[],
	): Promise<void> {
		const s = clack.spinner();
		s.start("Generating module files...");

		try {
			const inputs: Input[] = [
				{ name: "type", value: "module" },
				{ name: "name", value: moduleName.toLowerCase() },
				{ name: "path", value: outputPath },
			];

			const options: Input[] = [
				{ name: "skipImport", value: true },
				{ name: "spec", value: true }, // Modules don't have specs, but keeping for compatibility
			];

			await this.generateAction.handler(inputs, options);

			// If we have providers, we need to update the module file
			if (providers.length > 0) {
				// The GenerateAction will create the basic module
				// We would need to update it with the providers
				// For now, the basic module is created
				clack.log.warn(
					"Note: Providers need to be manually added to the module decorator",
				);
			}

			s.stop(pc.green("✓ Module generated successfully"));
		} catch (error) {
			s.stop(pc.red(`✗ Generation failed: ${error}`));
			throw error;
		}
	}
}
