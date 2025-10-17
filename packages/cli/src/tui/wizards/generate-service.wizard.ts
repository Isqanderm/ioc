import * as path from "node:path";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import type { GenerateAction } from "../../actions/generate.action";
import type { Input } from "../../commands/command.input";
import { ServiceTemplate } from "../../templates/service.template";
import { ServiceSpecTemplate } from "../../templates/service-spec.template";
import { CodePreview, type PreviewFile } from "../components/code-preview";
import { capitalize } from "../utils/formatters";
import { ProjectScanner } from "../utils/project-scanner";
import { validateComponentName, validatePath } from "../utils/validators";

/**
 * Wizard for generating a new service
 */
export class GenerateServiceWizard {
	private scanner: ProjectScanner;

	constructor(private readonly generateAction: GenerateAction) {
		this.scanner = new ProjectScanner();
	}

	/**
	 * Run the service generation wizard
	 */
	async run(): Promise<void> {
		clack.intro(pc.bgBlue(pc.black(" Generate Service ")));

		try {
			// Step 1: Get service name
			const serviceName = await this.promptServiceName();
			if (!serviceName) {
				clack.cancel("Service generation cancelled");
				return;
			}

			// Step 2: Get output path
			const outputPath = await this.promptOutputPath();
			if (!outputPath) {
				clack.cancel("Service generation cancelled");
				return;
			}

			// Step 3: Get scope (future enhancement - for now skip)
			// const scope = await this.promptScope();

			// Step 4: Get dependencies (future enhancement - for now skip)
			// const dependencies = await this.promptDependencies();

			// Step 5: Module registration
			const moduleChoice = await this.promptModuleRegistration(
				serviceName,
				outputPath,
			);
			if (moduleChoice === null) {
				clack.cancel("Service generation cancelled");
				return;
			}

			// Step 6: Test generation
			const generateTests = await this.promptTestGeneration();
			if (generateTests === null) {
				clack.cancel("Service generation cancelled");
				return;
			}

			// Step 7: Preview files
			const files = this.generatePreviewFiles(
				serviceName,
				outputPath,
				generateTests,
			);

			CodePreview.showSummary({
				service: `${serviceName}Service`,
				module: moduleChoice.createNew
					? `${serviceName}Module`
					: moduleChoice.existing,
				tests: generateTests,
				path: outputPath,
			});

			await CodePreview.show(files, {
				title: "Preview of files to be created:",
				maxLines: 20,
			});

			// Step 8: Confirm generation
			const confirmed = await CodePreview.confirm();
			if (!confirmed) {
				clack.cancel("Service generation cancelled");
				return;
			}

			// Step 9: Generate files
			await this.generateFiles(
				serviceName,
				outputPath,
				moduleChoice,
				generateTests,
			);

			clack.outro(pc.green("✓ Service generated successfully!"));
		} catch (error) {
			clack.log.error(`Error: ${error}`);
			clack.cancel("Service generation failed");
		}
	}

	/**
	 * Prompt for service name
	 */
	private async promptServiceName(): Promise<string | null> {
		const name = await clack.text({
			message: "What is the service name?",
			placeholder: "Auth",
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
			message: "Where should the service be created?",
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
	 * Prompt for module registration
	 */
	private async promptModuleRegistration(
		serviceName: string,
		outputPath: string,
	): Promise<{ createNew: boolean; existing?: string } | null> {
		const modules = await this.scanner.findModules();
		const moduleFileName = `${serviceName.toLowerCase()}.module.ts`;
		const moduleExists = await this.scanner.moduleExists(
			path.join(outputPath, moduleFileName),
		);

		if (moduleExists) {
			// Module already exists, use it
			return { createNew: false, existing: `${serviceName}Module` };
		}

		const options: Array<{ value: string; label: string; hint?: string }> = [
			{
				value: "create-new",
				label: `Create new ${serviceName}Module`,
				hint: "Recommended",
			},
		];

		if (modules.length > 0) {
			options.push({
				value: "skip",
				label: "Skip module registration",
				hint: "Register manually later",
			});

			// Add existing modules as options
			for (const module of modules.slice(0, 5)) {
				// Limit to 5 modules
				options.push({
					value: module.className,
					label: `Use existing ${module.className}`,
					hint: module.relativePath,
				});
			}
		} else {
			options.push({
				value: "skip",
				label: "Skip module registration",
			});
		}

		const choice = await clack.select({
			message: "Which module should register this service?",
			options,
		});

		if (clack.isCancel(choice)) {
			return null;
		}

		if (choice === "create-new") {
			return { createNew: true };
		}

		if (choice === "skip") {
			return { createNew: false };
		}

		return { createNew: false, existing: choice as string };
	}

	/**
	 * Prompt for test generation
	 */
	private async promptTestGeneration(): Promise<boolean | null> {
		const generateTests = await clack.confirm({
			message: "Generate test file?",
			initialValue: true,
		});

		if (clack.isCancel(generateTests)) {
			return null;
		}

		return generateTests;
	}

	/**
	 * Generate preview files
	 */
	private generatePreviewFiles(
		serviceName: string,
		outputPath: string,
		generateTests: boolean,
	): PreviewFile[] {
		const files: PreviewFile[] = [];
		const _className = `${serviceName}Service`;

		// Service file
		const serviceTemplate = new ServiceTemplate({ name: serviceName });
		const serviceContent = serviceTemplate.generate();
		files.push({
			path: path.join(outputPath, `${serviceName.toLowerCase()}.service.ts`),
			content: serviceContent,
		});

		// Test file
		if (generateTests) {
			const testTemplate = new ServiceSpecTemplate({ name: serviceName });
			const testContent = testTemplate.generate();
			files.push({
				path: path.join(
					outputPath,
					`${serviceName.toLowerCase()}.service.spec.ts`,
				),
				content: testContent,
			});
		}

		return files;
	}

	/**
	 * Generate the actual files
	 */
	private async generateFiles(
		serviceName: string,
		outputPath: string,
		moduleChoice: { createNew: boolean; existing?: string },
		generateTests: boolean,
	): Promise<void> {
		const s = clack.spinner();
		s.start("Generating service files...");

		try {
			const inputs: Input[] = [
				{ name: "type", value: "service" },
				{ name: "name", value: serviceName.toLowerCase() },
				{ name: "path", value: outputPath },
			];

			const options: Input[] = [
				{ name: "skipImport", value: !moduleChoice.createNew },
				{ name: "spec", value: generateTests },
			];

			await this.generateAction.handler(inputs, options);

			s.stop(pc.green("✓ Files generated successfully"));
		} catch (error) {
			s.stop(pc.red(`✗ Generation failed: ${error}`));
			throw error;
		}
	}
}
