export interface ServiceDependency {
	className: string;
	importPath: string;
	paramName: string;
}

export interface EnhancedServiceParams {
	name: string;
	dependencies?: ServiceDependency[];
	scope?: "Singleton" | "Transient";
}

export class EnhancedServiceTemplate {
	constructor(private readonly params: EnhancedServiceParams) {}

	public generate(): string {
		const { name, dependencies = [], scope } = this.params;

		// Generate imports
		const imports = this.generateImports(dependencies, scope);

		// Generate constructor
		const constructorCode = this.generateConstructor(dependencies);

		// Generate decorator
		const decorator = this.generateDecorator(scope);

		return `
${imports}

${decorator}
export class ${name}Service {${constructorCode}
}
    `.trim();
	}

	private generateImports(
		dependencies: ServiceDependency[],
		scope?: string,
	): string {
		const coreImports = ["Injectable"];

		if (scope === "Singleton") {
			coreImports.push("Scope");
		}

		const lines: string[] = [
			`import { ${coreImports.join(", ")} } from "@nexus-ioc/core";`,
		];

		// Add dependency imports
		for (const dep of dependencies) {
			lines.push(`import { ${dep.className} } from "${dep.importPath}";`);
		}

		return lines.join("\n");
	}

	private generateConstructor(dependencies: ServiceDependency[]): string {
		if (dependencies.length === 0) {
			return "";
		}

		const params = dependencies
			.map((dep) => `private readonly ${dep.paramName}: ${dep.className}`)
			.join(",\n    ");

		return `
  constructor(
    ${params}
  ) {}`;
	}

	private generateDecorator(scope?: string): string {
		if (scope === "Singleton") {
			return "@Injectable({ scope: Scope.SINGLETON })";
		}

		return "@Injectable()";
	}
}
