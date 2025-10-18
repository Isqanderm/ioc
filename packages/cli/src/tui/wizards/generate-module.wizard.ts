import * as fs from "node:fs";
import * as path from "node:path";
import * as clack from "@clack/prompts";
import pc from "picocolors";
import type { GenerateAction } from "../../actions/generate.action";
import { ModuleTemplate } from "../../templates/module.template";
import { ServiceTemplate } from "../../templates/service.template";
import { ServiceSpecTemplate } from "../../templates/service-spec.template";
import { CodePreview, type PreviewFile } from "../components/code-preview";
import { capitalize, prettifyCode } from "../utils/formatters";
import { ProjectScanner, type ServiceInfo } from "../utils/project-scanner";
import { validateComponentName, validatePath } from "../utils/validators";

/**
 * Wizard for generating a new module
 */
export class GenerateModuleWizard {
	private scanner: ProjectScanner;

	constructor(readonly _generateAction: GenerateAction) {
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

			// Step 3: Create service for module (optional)
			const createService = await this.promptCreateService();
			if (createService === null) {
				clack.cancel("Module generation cancelled");
				return;
			}

			let serviceName: string | null = null;
			let generateServiceTests = false;

			if (createService) {
				// Step 3a: Get service name
				serviceName = await this.promptServiceName(moduleName);
				if (!serviceName) {
					clack.cancel("Module generation cancelled");
					return;
				}

				// Step 3b: Service test generation
				const serviceTestsResult = await this.promptServiceTestGeneration();
				if (serviceTestsResult === null) {
					clack.cancel("Module generation cancelled");
					return;
				}
				generateServiceTests = serviceTestsResult;
			}

			// Step 4: Import existing providers (optional)
			const providers = await this.promptProviders();
			if (providers === null) {
				clack.cancel("Module generation cancelled");
				return;
			}

			// Step 5: Module test generation
			const generateTests = await this.promptTestGeneration();
			if (generateTests === null) {
				clack.cancel("Module generation cancelled");
				return;
			}

			// Step 6: Preview files
			const files = this.generatePreviewFiles(
				moduleName,
				outputPath,
				serviceName,
				generateServiceTests,
				providers,
				generateTests,
			);

			// Show summary
			const summary: Record<string, string | boolean> = {
				module: `${moduleName}Module`,
				path: outputPath,
			};

			if (serviceName) {
				summary.service = `${serviceName}Service`;
				summary["service tests"] = generateServiceTests;
			}

			if (generateTests) {
				summary["module tests"] = true;
			}

			CodePreview.showSummary(summary);

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

			// Step 7: Confirm generation
			const confirmed = await CodePreview.confirm();
			if (!confirmed) {
				clack.cancel("Module generation cancelled");
				return;
			}

			// Step 8: Generate files
			await this.generateFiles(
				moduleName,
				outputPath,
				serviceName,
				generateServiceTests,
				providers,
				generateTests,
			);

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
	 * Prompt for test generation
	 */
	private async promptTestGeneration(): Promise<boolean | null> {
		const generateTests = await clack.confirm({
			message: "Generate test file for module?",
			initialValue: true,
		});

		if (clack.isCancel(generateTests)) {
			return null;
		}

		return generateTests;
	}

	/**
	 * Prompt for creating a service for the module
	 */
	private async promptCreateService(): Promise<boolean | null> {
		const createService = await clack.confirm({
			message: "Would you like to create a service for this module?",
			initialValue: true,
		});

		if (clack.isCancel(createService)) {
			return null;
		}

		return createService;
	}

	/**
	 * Prompt for service name
	 */
	private async promptServiceName(defaultName: string): Promise<string | null> {
		const name = await clack.text({
			message: "Service name:",
			placeholder: defaultName,
			defaultValue: defaultName,
			validate: validateComponentName,
		});

		if (clack.isCancel(name)) {
			return null;
		}

		return capitalize(name as string);
	}

	/**
	 * Prompt for service test generation
	 */
	private async promptServiceTestGeneration(): Promise<boolean | null> {
		const generateTests = await clack.confirm({
			message: "Generate test file for the service?",
			initialValue: true,
		});

		if (clack.isCancel(generateTests)) {
			return null;
		}

		return generateTests;
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
		serviceName: string | null,
		generateServiceTests: boolean,
		providers: ServiceInfo[],
		generateTests: boolean,
	): PreviewFile[] {
		const files: PreviewFile[] = [];

		// Service file (if requested)
		if (serviceName) {
			const serviceTemplate = new ServiceTemplate({ name: serviceName });
			const serviceContent = serviceTemplate.generate();

			files.push({
				path: path.join(outputPath, `${serviceName.toLowerCase()}.service.ts`),
				content: serviceContent,
			});

			// Service test file (if requested)
			if (generateServiceTests) {
				const serviceSpecTemplate = new ServiceSpecTemplate({
					name: serviceName,
				});
				const testContent = serviceSpecTemplate.generate();

				files.push({
					path: path.join(
						outputPath,
						`${serviceName.toLowerCase()}.service.spec.ts`,
					),
					content: testContent,
				});
			}
		}

		// Module file
		const moduleTemplate = new ModuleTemplate({ name: moduleName });

		// Add service to providers if created
		if (serviceName) {
			moduleTemplate.addProvider([`${serviceName}Service`]);
		}

		// Add existing providers to the module
		if (providers.length > 0) {
			moduleTemplate.addProvider(providers.map((p) => p.className));
		}

		// Generate imports for service and providers
		const imports: string[] = [];

		if (serviceName) {
			imports.push(
				`import { ${serviceName}Service } from './${serviceName.toLowerCase()}.service';`,
			);
		}

		providers.forEach((p) => {
			const relativePath = this.getRelativeImportPath(outputPath, p.filePath);
			imports.push(`import { ${p.className} } from '${relativePath}';`);
		});

		const moduleContent = `import { NsModule } from '@nexus-ioc/core';
${imports.length > 0 ? `${imports.join("\n")}\n` : ""}
${moduleTemplate.generate()}`;

		files.push({
			path: path.join(outputPath, `${moduleName.toLowerCase()}.module.ts`),
			content: moduleContent,
		});

		// Test file (if requested)
		if (generateTests) {
			const moduleNameLC = moduleName.toLowerCase();
			const moduleClassName = `${moduleName}Module`;
			const testContent = `import { Test } from "@nexus-ioc/testing";
import { ${moduleClassName} } from "./${moduleNameLC}.module";

describe('${moduleClassName}', () => {
  it('should compile the module', async () => {
    const moduleRef = await Test.createModule({
      imports: [${moduleClassName}]
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});`;

			files.push({
				path: path.join(outputPath, `${moduleNameLC}.module.spec.ts`),
				content: testContent,
			});
		}

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
		serviceName: string | null,
		generateServiceTests: boolean,
		providers: ServiceInfo[],
		generateTests: boolean,
	): Promise<void> {
		const s = clack.spinner();
		s.start("Generating files...");

		try {
			// Ensure output directory exists
			const resolvedPath = this.scanner.resolvePath(outputPath);
			if (!fs.existsSync(resolvedPath)) {
				fs.mkdirSync(resolvedPath, { recursive: true });
			}

			// Generate service files if requested
			if (serviceName) {
				const serviceTemplate = new ServiceTemplate({ name: serviceName });
				const serviceContent = serviceTemplate.generate();
				const serviceFilePath = path.join(
					resolvedPath,
					`${serviceName.toLowerCase()}.service.ts`,
				);

				fs.writeFileSync(
					serviceFilePath,
					await prettifyCode(serviceContent, serviceFilePath),
					"utf-8",
				);

				// Generate service test file if requested
				if (generateServiceTests) {
					const serviceSpecTemplate = new ServiceSpecTemplate({
						name: serviceName,
					});
					const testContent = serviceSpecTemplate.generate();
					const testFilePath = path.join(
						resolvedPath,
						`${serviceName.toLowerCase()}.service.spec.ts`,
					);

					fs.writeFileSync(
						testFilePath,
						await prettifyCode(testContent, testFilePath),
						"utf-8",
					);
				}
			}

			// Generate module file with service and providers
			const moduleTemplate = new ModuleTemplate({ name: moduleName });

			// Add service to providers if created
			if (serviceName) {
				moduleTemplate.addProvider([`${serviceName}Service`]);
			}

			// Add existing providers to the module
			if (providers.length > 0) {
				moduleTemplate.addProvider(providers.map((p) => p.className));
			}

			// Generate imports for service and providers
			const imports: string[] = [];

			if (serviceName) {
				imports.push(
					`import { ${serviceName}Service } from './${serviceName.toLowerCase()}.service';`,
				);
			}

			providers.forEach((p) => {
				const relativePath = this.getRelativeImportPath(outputPath, p.filePath);
				imports.push(`import { ${p.className} } from '${relativePath}';`);
			});

			const moduleContent = `import { NsModule } from '@nexus-ioc/core';
${imports.length > 0 ? `${imports.join("\n")}\n` : ""}
${moduleTemplate.generate()}`;

			const moduleFilePath = path.join(
				resolvedPath,
				`${moduleName.toLowerCase()}.module.ts`,
			);

			fs.writeFileSync(
				moduleFilePath,
				await prettifyCode(moduleContent, moduleFilePath),
				"utf-8",
			);

			// Generate module test file if requested
			if (generateTests) {
				const moduleNameLC = moduleName.toLowerCase();
				const moduleClassName = `${moduleName}Module`;
				const testContent = `import { Test } from "@nexus-ioc/testing";
import { ${moduleClassName} } from "./${moduleNameLC}.module";

describe('${moduleClassName}', () => {
  it('should compile the module', async () => {
    const moduleRef = await Test.createModule({
      imports: [${moduleClassName}]
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});`;

				const testFilePath = path.join(
					resolvedPath,
					`${moduleNameLC}.module.spec.ts`,
				);

				fs.writeFileSync(
					testFilePath,
					await prettifyCode(testContent, testFilePath),
					"utf-8",
				);
			}

			s.stop(pc.green("✓ Files generated successfully"));
		} catch (error) {
			s.stop(pc.red(`✗ Generation failed: ${error}`));
			throw error;
		}
	}
}
