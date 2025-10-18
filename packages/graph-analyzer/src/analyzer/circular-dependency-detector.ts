import type { Dependency } from "../parser/dependency-extractor";
import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";

/**
 * Represents a circular dependency cycle
 */
export interface CircularDependency {
	/** Type of circular dependency */
	type: "module" | "provider";
	/** Path of nodes forming the cycle (e.g., ["A", "B", "C", "A"]) */
	cycle: string[];
	/** Severity level */
	severity: "error" | "warning";
	/** Human-readable description */
	message: string;
}

/**
 * Result of circular dependency analysis
 */
export interface CircularDependencyAnalysis {
	/** Whether any circular dependencies were found */
	hasCircularDependencies: boolean;
	/** List of all detected circular dependencies */
	circularDependencies: CircularDependency[];
	/** Count of module-level cycles */
	moduleCircularCount: number;
	/** Count of provider-level cycles */
	providerCircularCount: number;
}

/**
 * Detects circular dependencies in module imports and provider dependencies
 *
 * Uses depth-first search (DFS) to detect cycles in the dependency graph.
 * Can detect both module-level circular imports and provider-level circular dependencies.
 *
 * @example
 * ```typescript
 * const detector = new CircularDependencyDetector(modulesGraph);
 * const analysis = detector.analyze();
 *
 * if (analysis.hasCircularDependencies) {
 *   console.error(`Found ${analysis.circularDependencies.length} circular dependencies`);
 *   analysis.circularDependencies.forEach(cycle => {
 *     console.error(`${cycle.type}: ${cycle.cycle.join(' -> ')}`);
 *   });
 * }
 * ```
 */
export class CircularDependencyDetector {
	/**
	 * Create a new CircularDependencyDetector instance
	 *
	 * @param graph - Map of module names to parsed modules
	 */
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
	) {}

	/**
	 * Analyze the dependency graph for circular dependencies
	 *
	 * Performs both module-level and provider-level circular dependency detection.
	 *
	 * @returns CircularDependencyAnalysis with all detected cycles
	 */
	analyze(): CircularDependencyAnalysis {
		const circularDependencies: CircularDependency[] = [];

		// Detect module-level circular imports
		const moduleCycles = this.detectModuleCircularDependencies();
		circularDependencies.push(...moduleCycles);

		// Detect provider-level circular dependencies
		const providerCycles = this.detectProviderCircularDependencies();
		circularDependencies.push(...providerCycles);

		return {
			hasCircularDependencies: circularDependencies.length > 0,
			circularDependencies,
			moduleCircularCount: moduleCycles.length,
			providerCircularCount: providerCycles.length,
		};
	}

	/**
	 * Detect circular dependencies in module imports
	 *
	 * Uses DFS to find cycles in the module import graph.
	 * A cycle exists when a module imports another module that eventually imports back to the original.
	 *
	 * @returns Array of detected module circular dependencies
	 */
	private detectModuleCircularDependencies(): CircularDependency[] {
		const cycles: CircularDependency[] = [];
		const visited = new Set<string>();
		const recursionStack = new Set<string>();
		const path: string[] = [];

		const entryModule = this.graph.get("entry") as ParseEntryFile;
		if (!entryModule || !entryModule.name) {
			return cycles;
		}

		// Start DFS from entry module
		this.dfsModules(entryModule.name, visited, recursionStack, path, cycles);

		return cycles;
	}

	/**
	 * Depth-first search for module circular dependencies
	 */
	private dfsModules(
		moduleName: string,
		visited: Set<string>,
		recursionStack: Set<string>,
		path: string[],
		cycles: CircularDependency[],
	): void {
		// Mark current node as visited and add to recursion stack
		visited.add(moduleName);
		recursionStack.add(moduleName);
		path.push(moduleName);

		const parseNsModule = this.graph.get(moduleName) as ParseNsModule;
		if (!parseNsModule) {
			// Clean up and return
			recursionStack.delete(moduleName);
			path.pop();
			return;
		}

		// Visit all imported modules
		for (const importedModule of parseNsModule.imports) {
			if (!visited.has(importedModule)) {
				// Recursively visit unvisited module
				this.dfsModules(importedModule, visited, recursionStack, path, cycles);
			} else if (recursionStack.has(importedModule)) {
				// Found a cycle - extract the cycle path
				const cycleStartIndex = path.indexOf(importedModule);
				const cyclePath = path.slice(cycleStartIndex);
				cyclePath.push(importedModule); // Complete the cycle

				cycles.push({
					type: "module",
					cycle: cyclePath,
					severity: "error",
					message: `Circular module import detected: ${cyclePath.join(" -> ")}`,
				});
			}
		}

		// Remove from recursion stack and path
		recursionStack.delete(moduleName);
		path.pop();
	}

	/**
	 * Detect circular dependencies in provider dependencies
	 *
	 * Uses DFS to find cycles in the provider dependency graph.
	 * A cycle exists when a provider depends on another provider that eventually depends back on the original.
	 *
	 * @returns Array of detected provider circular dependencies
	 */
	private detectProviderCircularDependencies(): CircularDependency[] {
		const cycles: CircularDependency[] = [];
		const visited = new Set<string>();
		const recursionStack = new Set<string>();
		const path: string[] = [];

		// Build provider dependency map
		const providerDeps = this.buildProviderDependencyMap();

		// Run DFS from each provider
		for (const providerToken of providerDeps.keys()) {
			if (!visited.has(providerToken)) {
				this.dfsProviders(
					providerToken,
					providerDeps,
					visited,
					recursionStack,
					path,
					cycles,
				);
			}
		}

		return cycles;
	}

	/**
	 * Build a map of provider tokens to their dependencies
	 */
	private buildProviderDependencyMap(): Map<string, string[]> {
		const providerDeps = new Map<string, string[]>();

		// Traverse all modules
		for (const [key, value] of this.graph.entries()) {
			if (key === "entry") continue;

			const parseNsModule = value as ParseNsModule;
			if (!parseNsModule.providers) continue;

			// Extract dependencies for each provider
			for (const provider of parseNsModule.providers) {
				if (!provider.token) continue;

				const dependencies: string[] = [];

				if (provider.dependencies && Array.isArray(provider.dependencies)) {
					for (const dep of provider.dependencies as Dependency[]) {
						if (dep.token && !dep.optional) {
							dependencies.push(dep.token);
						}
					}
				}

				providerDeps.set(provider.token, dependencies);
			}
		}

		return providerDeps;
	}

	/**
	 * Depth-first search for provider circular dependencies
	 */
	private dfsProviders(
		providerToken: string,
		providerDeps: Map<string, string[]>,
		visited: Set<string>,
		recursionStack: Set<string>,
		path: string[],
		cycles: CircularDependency[],
	): void {
		// Mark current node as visited and add to recursion stack
		visited.add(providerToken);
		recursionStack.add(providerToken);
		path.push(providerToken);

		const dependencies = providerDeps.get(providerToken) || [];

		// Visit all dependencies
		for (const depToken of dependencies) {
			if (!providerDeps.has(depToken)) {
				// Dependency is not a provider (might be external), skip
				continue;
			}

			if (!visited.has(depToken)) {
				// Recursively visit unvisited dependency
				this.dfsProviders(
					depToken,
					providerDeps,
					visited,
					recursionStack,
					path,
					cycles,
				);
			} else if (recursionStack.has(depToken)) {
				// Found a cycle - extract the cycle path
				const cycleStartIndex = path.indexOf(depToken);
				const cyclePath = path.slice(cycleStartIndex);
				cyclePath.push(depToken); // Complete the cycle

				cycles.push({
					type: "provider",
					cycle: cyclePath,
					severity: "error",
					message: `Circular provider dependency detected: ${cyclePath.join(" -> ")}`,
				});
			}
		}

		// Remove from recursion stack and path
		recursionStack.delete(providerToken);
		path.pop();
	}
}
