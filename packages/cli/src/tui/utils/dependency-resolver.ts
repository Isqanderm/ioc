import * as path from "node:path";
import type { ServiceDependency } from "../../templates/enhanced-service.template";
import type { ServiceInfo } from "./project-scanner";

export interface DependencyOption {
	value: string;
	label: string;
	hint?: string;
	service: ServiceInfo;
}

export class DependencyResolver {
	constructor(readonly _baseDir: string) {}

	/**
	 * Convert available services to dependency options for selection
	 */
	public createDependencyOptions(
		services: ServiceInfo[],
		currentServicePath: string,
	): DependencyOption[] {
		return services
			.filter((service) => {
				// Don't include the service we're currently creating
				const currentFileName = path.basename(currentServicePath);
				const serviceFileName = path.basename(service.filePath);
				return serviceFileName !== currentFileName;
			})
			.map((service) => ({
				value: service.className,
				label: `${service.className}`,
				hint: service.relativePath,
				service,
			}));
	}

	/**
	 * Convert selected dependency options to ServiceDependency objects
	 */
	public resolveDependencies(
		selectedOptions: DependencyOption[],
		targetFilePath: string,
	): ServiceDependency[] {
		return selectedOptions.map((option) => {
			const importPath = this.calculateImportPath(
				targetFilePath,
				option.service.filePath,
			);

			return {
				className: option.service.className,
				importPath,
				paramName: this.generateParamName(option.service.className),
			};
		});
	}

	/**
	 * Calculate relative import path between two files
	 */
	private calculateImportPath(fromFile: string, toFile: string): string {
		const fromDir = path.dirname(fromFile);
		let relativePath = path.relative(fromDir, toFile);

		// Remove .ts extension
		relativePath = relativePath.replace(/\.ts$/, "");

		// Ensure it starts with ./ or ../
		if (!relativePath.startsWith(".")) {
			relativePath = `./${relativePath}`;
		}

		// Normalize path separators for imports (always use forward slashes)
		relativePath = relativePath.split(path.sep).join("/");

		return relativePath;
	}

	/**
	 * Generate parameter name from class name
	 * Example: AuthService -> authService, UserRepository -> userRepository
	 */
	private generateParamName(className: string): string {
		// Remove "Service" suffix if present
		let paramName = className.replace(/Service$/, "");

		// Convert to camelCase
		paramName = paramName.charAt(0).toLowerCase() + paramName.slice(1);

		// If it's just "service" after removing suffix, use the full name
		if (paramName === "") {
			paramName = className.charAt(0).toLowerCase() + className.slice(1);
		}

		return paramName;
	}

	/**
	 * Detect potential circular dependencies
	 */
	public detectCircularDependency(
		_serviceName: string,
		dependencies: ServiceDependency[],
		_allServices: ServiceInfo[],
	): string[] {
		const warnings: string[] = [];

		// This is a simplified check - in a real implementation,
		// you'd want to parse the actual service files to check their dependencies
		for (const _dep of dependencies) {
			// Check if the dependency might depend on the current service
			// (This would require parsing the dependency's file, which we'll skip for now)

			// For now, just warn if there are many dependencies
			if (dependencies.length > 5) {
				warnings.push(
					`Service has ${dependencies.length} dependencies. Consider splitting into smaller services.`,
				);
				break;
			}
		}

		return warnings;
	}

	/**
	 * Check for naming conflicts
	 */
	public checkNamingConflicts(
		serviceName: string,
		existingServices: ServiceInfo[],
	): string | null {
		const conflict = existingServices.find(
			(s) => s.className.toLowerCase() === serviceName.toLowerCase(),
		);

		if (conflict) {
			return `A service named "${conflict.className}" already exists at ${conflict.relativePath}`;
		}

		return null;
	}

	/**
	 * Suggest dependencies based on service name
	 * Example: "UserController" might need "UserService"
	 */
	public suggestDependencies(
		serviceName: string,
		availableServices: ServiceInfo[],
	): ServiceInfo[] {
		const suggestions: ServiceInfo[] = [];

		// Extract base name (e.g., "User" from "UserController")
		const baseName = serviceName
			.replace(/Service$/, "")
			.replace(/Controller$/, "")
			.replace(/Repository$/, "");

		// Look for related services
		for (const service of availableServices) {
			const serviceBaseName = service.className
				.replace(/Service$/, "")
				.replace(/Controller$/, "")
				.replace(/Repository$/, "");

			// If base names match, it's a likely dependency
			if (
				serviceBaseName.toLowerCase() === baseName.toLowerCase() &&
				service.className !== serviceName
			) {
				suggestions.push(service);
			}
		}

		return suggestions;
	}
}
