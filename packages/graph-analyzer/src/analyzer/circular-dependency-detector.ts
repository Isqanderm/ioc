import type { NexusGraphModel } from "../graph/nexus-graph-model";

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
 * Can detect both module-level circular imports and provider-level circular
 * dependencies — the latter covering both constructor-injected dependencies
 * and `useFactory` `inject` tokens, since `NexusGraphModel` merges both into
 * a single provider dependency list.
 *
 * @example
 * ```typescript
 * const detector = new CircularDependencyDetector(graphModel);
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
	/** `provider.id -> provider.token`, populated by `buildProviderDependencyMap()`. */
	private readonly providerLabels = new Map<string, string>();

	/**
	 * Create a new CircularDependencyDetector instance
	 *
	 * @param graphModel - The application's graph model
	 */
	constructor(private readonly graphModel: NexusGraphModel) {}

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

		const entryModuleId = this.graphModel.entryModuleId;
		if (!entryModuleId) {
			return cycles;
		}

		// Start DFS from entry module
		this.dfsModules(entryModuleId, visited, recursionStack, path, cycles);

		return cycles;
	}

	/**
	 * Depth-first search for module circular dependencies. Traverses by
	 * `GraphModuleNode.id` (collision-free); `cyclePath`/`path` are built
	 * from ids and translated to display names only when a cycle is reported.
	 */
	private dfsModules(
		moduleId: string,
		visited: Set<string>,
		recursionStack: Set<string>,
		path: string[],
		cycles: CircularDependency[],
	): void {
		// Mark current node as visited and add to recursion stack
		visited.add(moduleId);
		recursionStack.add(moduleId);
		path.push(moduleId);

		const module = this.graphModel.modules.get(moduleId);
		if (!module) {
			// Clean up and return
			recursionStack.delete(moduleId);
			path.pop();
			return;
		}

		// Visit all imported modules
		for (const importedModule of module.imports) {
			const importedId = importedModule.id;
			if (!visited.has(importedId)) {
				// Recursively visit unvisited module
				this.dfsModules(importedId, visited, recursionStack, path, cycles);
			} else if (recursionStack.has(importedId)) {
				// Found a cycle - extract the cycle path
				const cycleStartIndex = path.indexOf(importedId);
				const cyclePath = path.slice(cycleStartIndex);
				cyclePath.push(importedId); // Complete the cycle
				const cycleLabels = cyclePath.map((id) => this.moduleLabel(id));

				cycles.push({
					type: "module",
					cycle: cycleLabels,
					severity: "error",
					message: `Circular module import detected: ${cycleLabels.join(" -> ")}`,
				});
			}
		}

		// Remove from recursion stack and path
		recursionStack.delete(moduleId);
		path.pop();
	}

	private moduleLabel(moduleId: string): string {
		return this.graphModel.modules.get(moduleId)?.name ?? moduleId;
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
		for (const providerId of providerDeps.keys()) {
			if (!visited.has(providerId)) {
				this.dfsProviders(
					providerId,
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
	 * Build a map of provider ids to their dependency ids and a map of
	 * provider ids to display tokens, across every module in the graph.
	 * Keyed by `GraphProviderNode.id`/`GraphProviderDependency.tokenId`
	 * (collision-free), not the rendered `token` — two different provider
	 * classes named alike must not collapse into one map entry.
	 */
	private buildProviderDependencyMap(): Map<string, string[]> {
		const providerDeps = new Map<string, string[]>();
		this.providerLabels.clear();

		for (const module of this.graphModel.modules.values()) {
			for (const provider of module.providers) {
				const dependencies = provider.dependencies
					.filter((dependency) => !dependency.optional && dependency.tokenId)
					.map((dependency) => dependency.tokenId as string);

				providerDeps.set(provider.id, dependencies);
				this.providerLabels.set(provider.id, provider.token);
			}
		}

		return providerDeps;
	}

	private providerLabel(providerId: string): string {
		return this.providerLabels.get(providerId) ?? providerId;
	}

	/**
	 * Depth-first search for provider circular dependencies
	 */
	private dfsProviders(
		providerId: string,
		providerDeps: Map<string, string[]>,
		visited: Set<string>,
		recursionStack: Set<string>,
		path: string[],
		cycles: CircularDependency[],
	): void {
		// Mark current node as visited and add to recursion stack
		visited.add(providerId);
		recursionStack.add(providerId);
		path.push(providerId);

		const dependencies = providerDeps.get(providerId) || [];

		// Visit all dependencies
		for (const depId of dependencies) {
			if (!providerDeps.has(depId)) {
				// Dependency is not a provider (might be external), skip
				continue;
			}

			if (!visited.has(depId)) {
				// Recursively visit unvisited dependency
				this.dfsProviders(
					depId,
					providerDeps,
					visited,
					recursionStack,
					path,
					cycles,
				);
			} else if (recursionStack.has(depId)) {
				// Found a cycle - extract the cycle path
				const cycleStartIndex = path.indexOf(depId);
				const cyclePath = path.slice(cycleStartIndex);
				cyclePath.push(depId); // Complete the cycle
				const cycleLabels = cyclePath.map((id) => this.providerLabel(id));

				cycles.push({
					type: "provider",
					cycle: cycleLabels,
					severity: "error",
					message: `Circular provider dependency detected: ${cycleLabels.join(" -> ")}`,
				});
			}
		}

		// Remove from recursion stack and path
		recursionStack.delete(providerId);
		path.pop();
	}
}
