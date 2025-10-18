import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Information about a discovered service
 */
export interface ServiceInfo {
	name: string;
	className: string;
	filePath: string;
	relativePath: string;
}

/**
 * Information about a discovered module
 */
export interface ModuleInfo {
	name: string;
	className: string;
	filePath: string;
	relativePath: string;
}

/**
 * Utility class for scanning the project structure
 */
export class ProjectScanner {
	constructor(private readonly rootDir: string = process.cwd()) {}

	/**
	 * Find all service files in the project
	 */
	async findServices(): Promise<ServiceInfo[]> {
		const services: ServiceInfo[] = [];
		await this.scanDirectory(this.rootDir, (file) => {
			if (file.endsWith(".service.ts") && !file.endsWith(".spec.ts")) {
				const className = this.extractClassName(file, "Service");
				if (className) {
					services.push({
						name: className.replace(/Service$/, ""),
						className,
						filePath: file,
						relativePath: path.relative(this.rootDir, file),
					});
				}
			}
		});
		return services;
	}

	/**
	 * Find all module files in the project
	 */
	async findModules(): Promise<ModuleInfo[]> {
		const modules: ModuleInfo[] = [];
		await this.scanDirectory(this.rootDir, (file) => {
			if (file.endsWith(".module.ts") && !file.endsWith(".spec.ts")) {
				const className = this.extractClassName(file, "Module");
				if (className) {
					modules.push({
						name: className.replace(/Module$/, ""),
						className,
						filePath: file,
						relativePath: path.relative(this.rootDir, file),
					});
				}
			}
		});
		return modules;
	}

	/**
	 * Check if a module exists at the given path
	 */
	async moduleExists(modulePath: string): Promise<boolean> {
		const fullPath = path.resolve(this.rootDir, modulePath);
		return fs.existsSync(fullPath);
	}

	/**
	 * Get suggested output paths based on project structure
	 */
	async getSuggestedPaths(): Promise<string[]> {
		const suggestions: string[] = ["./src", "./src/services", "./src/modules"];

		// Check which paths actually exist
		const existingPaths = suggestions.filter((p) => {
			const fullPath = path.resolve(this.rootDir, p);
			return fs.existsSync(fullPath);
		});

		// If no standard paths exist, suggest current directory
		if (existingPaths.length === 0) {
			return ["./"];
		}

		return existingPaths;
	}

	/**
	 * Recursively scan directory for files
	 */
	private async scanDirectory(
		dir: string,
		callback: (file: string) => void,
		maxDepth = 10,
		currentDepth = 0,
	): Promise<void> {
		if (currentDepth > maxDepth) return;

		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);

				// Skip node_modules, dist, and hidden directories
				if (
					entry.name === "node_modules" ||
					entry.name === "dist" ||
					entry.name === "coverage" ||
					entry.name.startsWith(".")
				) {
					continue;
				}

				if (entry.isDirectory()) {
					await this.scanDirectory(
						fullPath,
						callback,
						maxDepth,
						currentDepth + 1,
					);
				} else if (entry.isFile()) {
					callback(fullPath);
				}
			}
		} catch (_error) {
			// Silently skip directories we can't read
		}
	}

	/**
	 * Extract class name from file path
	 */
	private extractClassName(filePath: string, suffix: string): string | null {
		const fileName = path.basename(filePath, ".ts");
		const parts = fileName.split(".");

		if (parts.length === 0) return null;

		// Convert kebab-case to PascalCase
		const baseName = parts[0]
			.split("-")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join("");

		return `${baseName}${suffix}`;
	}

	/**
	 * Get the directory of a file path
	 */
	getDirectory(filePath: string): string {
		return path.dirname(path.resolve(this.rootDir, filePath));
	}

	/**
	 * Resolve a path relative to the project root
	 */
	resolvePath(relativePath: string): string {
		return path.resolve(this.rootDir, relativePath);
	}

	/**
	 * Get relative path from root
	 */
	getRelativePath(absolutePath: string): string {
		return path.relative(this.rootDir, absolutePath);
	}
}
