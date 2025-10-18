import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";

/**
 * Information about a module's position in the hierarchy
 */
export interface ModuleDepthInfo {
	/** Module name */
	name: string;
	/** Depth level in the import hierarchy (0 = entry module) */
	depth: number;
	/** Number of direct imports */
	directImports: number;
	/** Number of transitive dependencies (all modules this depends on) */
	transitiveDependencies: number;
	/** Number of modules that directly import this module (fan-in) */
	fanIn: number;
	/** Number of modules this module directly imports (fan-out) */
	fanOut: number;
}

/**
 * Depth level information
 */
export interface DepthLevel {
	/** Depth level number */
	level: number;
	/** Modules at this depth level */
	modules: string[];
	/** Number of modules at this level */
	count: number;
}

/**
 * Result of module depth analysis
 */
export interface ModuleDepthAnalysis {
	/** Whether depth analysis was performed */
	hasDepthAnalysis: boolean;
	/** Maximum depth in the module hierarchy */
	maxDepth: number;
	/** Average depth across all modules */
	averageDepth: number;
	/** Total number of modules analyzed */
	totalModules: number;
	/** Modules at each depth level */
	depthLevels: DepthLevel[];
	/** Detailed information for each module */
	moduleDetails: ModuleDepthInfo[];
	/** Modules with excessive depth (potential code smell) */
	deepModules: ModuleDepthInfo[];
	/** Threshold used for identifying deep modules */
	deepModuleThreshold: number;
}

/**
 * Analyzes module hierarchy depth and complexity metrics
 *
 * Calculates various metrics about module organization including:
 * - Depth of module import chains
 * - Module complexity metrics (fan-in, fan-out)
 * - Identification of overly deep hierarchies
 *
 * @example
 * ```typescript
 * const analyzer = new ModuleDepthAnalyzer(modulesGraph);
 * const analysis = analyzer.analyze();
 *
 * console.log(`Max depth: ${analysis.maxDepth}`);
 * console.log(`Average depth: ${analysis.averageDepth.toFixed(2)}`);
 *
 * if (analysis.deepModules.length > 0) {
 *   console.warn(`Found ${analysis.deepModules.length} modules with excessive depth`);
 * }
 * ```
 */
export class ModuleDepthAnalyzer {
	/**
	 * Create a new ModuleDepthAnalyzer instance
	 *
	 * @param graph - Map of module names to parsed modules
	 * @param deepModuleThreshold - Custom threshold for deep modules (optional)
	 */
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
		private readonly deepModuleThreshold: number = 5,
	) {}

	/**
	 * Analyze the module hierarchy depth and complexity
	 *
	 * @returns ModuleDepthAnalysis with all calculated metrics
	 */
	analyze(): ModuleDepthAnalysis {
		const modules = this.getModules();

		if (modules.length === 0) {
			return this.createEmptyAnalysis();
		}

		// Calculate depth for each module
		const moduleDepths = this.calculateModuleDepths();

		// Calculate complexity metrics
		const moduleDetails = this.calculateComplexityMetrics(moduleDepths);

		// Group modules by depth level
		const depthLevels = this.groupByDepthLevel(moduleDetails);

		// Calculate statistics
		const maxDepth = Math.max(...moduleDetails.map((m) => m.depth));
		const averageDepth =
			moduleDetails.reduce((sum, m) => sum + m.depth, 0) / moduleDetails.length;

		// Identify deep modules
		const deepModules = moduleDetails.filter(
			(m) => m.depth >= this.deepModuleThreshold,
		);

		return {
			hasDepthAnalysis: true,
			maxDepth,
			averageDepth,
			totalModules: moduleDetails.length,
			depthLevels,
			moduleDetails,
			deepModules,
			deepModuleThreshold: this.deepModuleThreshold,
		};
	}

	/**
	 * Get all modules from the graph (excluding entry file)
	 */
	private getModules(): ParseNsModule[] {
		const modules: ParseNsModule[] = [];

		for (const [key, value] of this.graph.entries()) {
			if (key !== "entry" && "imports" in value) {
				modules.push(value as ParseNsModule);
			}
		}

		return modules;
	}

	/**
	 * Calculate depth for each module using BFS from entry point
	 */
	private calculateModuleDepths(): Map<string, number> {
		const depths = new Map<string, number>();
		const entry = this.graph.get("entry") as ParseEntryFile | undefined;

		if (!entry || !entry.name) {
			return depths;
		}

		// Start BFS from entry module
		const queue: Array<{ name: string; depth: number }> = [
			{ name: entry.name, depth: 0 },
		];
		const visited = new Set<string>();

		while (queue.length > 0) {
			const current = queue.shift()!;

			if (visited.has(current.name)) {
				continue;
			}

			visited.add(current.name);
			depths.set(current.name, current.depth);

			// Get module from graph
			const module = this.graph.get(current.name) as ParseNsModule | undefined;
			if (!module || !("imports" in module)) {
				continue;
			}

			// Add all imports to queue with incremented depth
			for (const importName of module.imports) {
				if (!visited.has(importName)) {
					queue.push({ name: importName, depth: current.depth + 1 });
				}
			}
		}

		return depths;
	}

	/**
	 * Calculate complexity metrics for each module
	 */
	private calculateComplexityMetrics(
		moduleDepths: Map<string, number>,
	): ModuleDepthInfo[] {
		const moduleDetails: ModuleDepthInfo[] = [];
		const fanInMap = this.calculateFanIn();

		for (const [moduleName, depth] of moduleDepths.entries()) {
			const module = this.graph.get(moduleName) as ParseNsModule | undefined;
			if (!module || !("imports" in module)) {
				continue;
			}

			const directImports = module.imports.length;
			const transitiveDependencies =
				this.calculateTransitiveDependencies(moduleName);
			const fanIn = fanInMap.get(moduleName) || 0;
			const fanOut = directImports;

			moduleDetails.push({
				name: moduleName,
				depth,
				directImports,
				transitiveDependencies,
				fanIn,
				fanOut,
			});
		}

		return moduleDetails;
	}

	/**
	 * Calculate fan-in for all modules (how many modules depend on each module)
	 */
	private calculateFanIn(): Map<string, number> {
		const fanInMap = new Map<string, number>();

		for (const [key, value] of this.graph.entries()) {
			if (key === "entry" || !("imports" in value)) {
				continue;
			}

			const module = value as ParseNsModule;
			for (const importName of module.imports) {
				fanInMap.set(importName, (fanInMap.get(importName) || 0) + 1);
			}
		}

		return fanInMap;
	}

	/**
	 * Calculate transitive dependencies for a module (all modules it depends on)
	 */
	private calculateTransitiveDependencies(moduleName: string): number {
		const visited = new Set<string>();
		const queue = [moduleName];

		while (queue.length > 0) {
			const current = queue.shift()!;

			if (visited.has(current)) {
				continue;
			}

			visited.add(current);

			const module = this.graph.get(current) as ParseNsModule | undefined;
			if (!module || !("imports" in module)) {
				continue;
			}

			for (const importName of module.imports) {
				if (!visited.has(importName)) {
					queue.push(importName);
				}
			}
		}

		// Subtract 1 to exclude the module itself
		return visited.size - 1;
	}

	/**
	 * Group modules by depth level
	 */
	private groupByDepthLevel(moduleDetails: ModuleDepthInfo[]): DepthLevel[] {
		const levelMap = new Map<number, string[]>();

		for (const module of moduleDetails) {
			const modules = levelMap.get(module.depth) || [];
			modules.push(module.name);
			levelMap.set(module.depth, modules);
		}

		const depthLevels: DepthLevel[] = [];
		for (const [level, modules] of levelMap.entries()) {
			depthLevels.push({
				level,
				modules,
				count: modules.length,
			});
		}

		// Sort by level
		depthLevels.sort((a, b) => a.level - b.level);

		return depthLevels;
	}

	/**
	 * Create an empty analysis result
	 */
	private createEmptyAnalysis(): ModuleDepthAnalysis {
		return {
			hasDepthAnalysis: false,
			maxDepth: 0,
			averageDepth: 0,
			totalModules: 0,
			depthLevels: [],
			moduleDetails: [],
			deepModules: [],
			deepModuleThreshold: this.deepModuleThreshold,
		};
	}
}
