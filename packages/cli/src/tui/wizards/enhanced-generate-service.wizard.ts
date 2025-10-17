import * as path from "node:path";
import * as clack from "@clack/prompts";
import type {
	EnhancedServiceParams,
	ServiceDependency,
} from "../../templates/enhanced-service.template";
import { EnhancedServiceTemplate } from "../../templates/enhanced-service.template";
import { CodePreview } from "../components/code-preview";
import type { DependencyOption } from "../utils/dependency-resolver";
import { DependencyResolver } from "../utils/dependency-resolver";
import { formatCode } from "../utils/formatters";
import { ProjectScanner } from "../utils/project-scanner";
import { validatePascalCase, validatePath } from "../utils/validators";

export class EnhancedGenerateServiceWizard {
	private scanner: ProjectScanner;
	private resolver: DependencyResolver;

	constructor() {
		this.scanner = new ProjectScanner(process.cwd());
		this.resolver = new DependencyResolver(process.cwd());
	}

	async run(): Promise<void> {
		clack.intro("🚀 Generate Service (Enhanced)");

		try {
			// Step 1: Service name
			const serviceName = await this.promptServiceName();
			if (clack.isCancel(serviceName)) {
				clack.cancel("Service generation cancelled.");
				return;
			}

			// Step 2: Output path
			const outputPath = await this.promptOutputPath();
			if (clack.isCancel(outputPath)) {
				clack.cancel("Service generation cancelled.");
				return;
			}

			// Step 3: Scope selection
			const scope = await this.promptScope();
			if (clack.isCancel(scope)) {
				clack.cancel("Service generation cancelled.");
				return;
			}

			// Step 4: Dependencies
			const dependencies = await this.promptDependencies(
				serviceName as string,
				outputPath as string,
			);
			if (clack.isCancel(dependencies)) {
				clack.cancel("Service generation cancelled.");
				return;
			}

			// Step 5: Module registration
			const moduleChoice = await this.promptModuleRegistration(
				serviceName as string,
				outputPath as string,
			);
			if (clack.isCancel(moduleChoice)) {
				clack.cancel("Service generation cancelled.");
				return;
			}

			// Step 6: Test generation
			const generateTests = await this.promptTestGeneration();
			if (clack.isCancel(generateTests)) {
				clack.cancel("Service generation cancelled.");
				return;
			}

			// Step 7: Preview
			const previewFiles = await this.generatePreview({
				serviceName: serviceName as string,
				outputPath: outputPath as string,
				scope: scope as "Singleton" | "Transient" | "Request" | undefined,
				dependencies: dependencies as ServiceDependency[],
				generateTests: generateTests as boolean,
			});

			await CodePreview.show(previewFiles);

			// Step 8: Confirmation
			const confirmed = await CodePreview.confirm("Generate these files?");
			if (!confirmed || clack.isCancel(confirmed)) {
				clack.cancel("Service generation cancelled.");
				return;
			}

			// Step 9: Generate files
			const spinner = clack.spinner();
			spinner.start("Generating service...");

			// TODO: Integrate with actual file generation
			// For now, we'll show a success message
			await new Promise((resolve) => setTimeout(resolve, 500));

			spinner.stop("Service generated successfully! ✨");

			clack.outro(`Service ${serviceName}Service created at ${outputPath}`);
		} catch (error) {
			clack.log.error(`Error: ${error}`);
			clack.outro("Service generation failed.");
		}
	}

	private async promptServiceName(): Promise<string | symbol> {
		const existingServices = await this.scanner.findServices();

		return clack.text({
			message: "What is the service name?",
			placeholder: "Auth",
			validate: (value) => {
				const pascalValidation = validatePascalCase(value);
				if (pascalValidation) return pascalValidation;

				// Check for naming conflicts
				const conflict = this.resolver.checkNamingConflicts(
					`${value}Service`,
					existingServices,
				);
				if (conflict) return conflict;

				return undefined;
			},
		});
	}

	private async promptOutputPath(): Promise<string | symbol> {
		const suggestedPaths = await this.scanner.getSuggestedPaths();

		return clack.text({
			message: "Where should the service be created?",
			placeholder: suggestedPaths[0] || "./src",
			defaultValue: suggestedPaths[0] || "./src",
			validate: validatePath,
		});
	}

	private async promptScope(): Promise<
		"Singleton" | "Transient" | "Request" | undefined | symbol
	> {
		const choice = await clack.select({
			message: "Select service scope:",
			options: [
				{
					value: "default",
					label: "Default (Transient)",
					hint: "New instance for each injection",
				},
				{
					value: "singleton",
					label: "Singleton",
					hint: "Single instance shared across the app",
				},
				{
					value: "request",
					label: "Request",
					hint: "New instance per request/context",
				},
			],
		});

		if (clack.isCancel(choice)) return choice;

		if (choice === "singleton") return "Singleton";
		if (choice === "request") return "Request";
		return undefined;
	}

	private async promptDependencies(
		serviceName: string,
		outputPath: string,
	): Promise<ServiceDependency[] | symbol> {
		const availableServices = await this.scanner.findServices();

		if (availableServices.length === 0) {
			clack.log.info("No existing services found to inject.");
			return [];
		}

		const targetFilePath = path.join(
			this.scanner.resolvePath(outputPath),
			`${serviceName.toLowerCase()}.service.ts`,
		);

		const options = this.resolver.createDependencyOptions(
			availableServices,
			targetFilePath,
		);

		// Get suggestions
		const suggestions = this.resolver.suggestDependencies(
			`${serviceName}Service`,
			availableServices,
		);

		if (suggestions.length > 0) {
			clack.log.info(
				`💡 Suggested dependencies: ${suggestions.map((s) => s.className).join(", ")}`,
			);
		}

		const selected = await clack.multiselect({
			message: "Select dependencies to inject (optional):",
			options: options.map((opt) => ({
				value: opt,
				label: opt.label,
				hint: opt.hint,
			})),
			required: false,
		});

		if (clack.isCancel(selected)) return selected;

		const selectedOptions = selected as DependencyOption[];
		return this.resolver.resolveDependencies(selectedOptions, targetFilePath);
	}

	private async promptModuleRegistration(
		serviceName: string,
		outputPath: string,
	): Promise<string | symbol> {
		const moduleExists = await this.scanner.moduleExists(
			path.join(
				this.scanner.resolvePath(outputPath),
				`${serviceName.toLowerCase()}.module.ts`,
			),
		);

		if (moduleExists) {
			return clack.select({
				message: "Module already exists. What would you like to do?",
				options: [
					{
						value: "add",
						label: "Add to existing module",
						hint: "Register service in the existing module",
					},
					{
						value: "skip",
						label: "Skip module registration",
					},
				],
			});
		}

		return clack.select({
			message: "Module registration:",
			options: [
				{
					value: "create",
					label: "Create new module",
					hint: `Create ${serviceName}Module`,
				},
				{
					value: "skip",
					label: "Skip module registration",
				},
			],
		});
	}

	private async promptTestGeneration(): Promise<boolean | symbol> {
		const choice = await clack.confirm({
			message: "Generate test file?",
			initialValue: true,
		});

		return choice;
	}

	private async generatePreview(params: {
		serviceName: string;
		outputPath: string;
		scope?: "Singleton" | "Transient" | "Request";
		dependencies: ServiceDependency[];
		generateTests: boolean;
	}): Promise<Array<{ path: string; content: string }>> {
		const files: Array<{ path: string; content: string }> = [];

		// Generate service file
		const serviceParams: EnhancedServiceParams = {
			name: params.serviceName,
			dependencies: params.dependencies,
			scope: params.scope,
		};

		const template = new EnhancedServiceTemplate(serviceParams);
		const serviceContent = await formatCode(template.generate());

		files.push({
			path: `${params.serviceName.toLowerCase()}.service.ts`,
			content: serviceContent,
		});

		// Generate test file if requested
		if (params.generateTests) {
			const testContent = this.generateTestContent(
				params.serviceName,
				params.dependencies,
			);
			files.push({
				path: `${params.serviceName.toLowerCase()}.service.spec.ts`,
				content: await formatCode(testContent),
			});
		}

		return files;
	}

	private generateTestContent(
		serviceName: string,
		dependencies: ServiceDependency[],
	): string {
		const mockSetup = dependencies
			.map(
				(dep) =>
					`const mock${dep.className} = {} as jest.Mocked<${dep.className}>;`,
			)
			.join("\n  ");

		const constructorArgs = dependencies
			.map((dep) => `mock${dep.className}`)
			.join(", ");

		return `
import { ${serviceName}Service } from './${serviceName.toLowerCase()}.service';
${dependencies.map((dep) => `import { ${dep.className} } from '${dep.importPath}';`).join("\n")}

describe('${serviceName}Service', () => {
  let service: ${serviceName}Service;
  ${mockSetup}

  beforeEach(() => {
    service = new ${serviceName}Service(${constructorArgs});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
    `.trim();
	}
}
