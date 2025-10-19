import type * as ts from "typescript/lib/tsserverlibrary";
import type { InjectParameterDeclaration } from "../parsers/inject.parser";

/**
 * Represents a circular dependency cycle
 */
export interface CircularDependency {
	/** Type of circular dependency */
	type: "provider";
	/** Path of class names forming the cycle (e.g., ["ServiceA", "ServiceB", "ServiceA"]) */
	cycle: string[];
	/** Severity level */
	severity: "error";
	/** Human-readable description */
	message: string;
	/** The class declaration where the cycle was detected */
	classDeclaration: ts.ClassDeclaration;
	/** The parameter/property that creates the circular dependency */
	circularParam: InjectParameterDeclaration;
}

/**
 * Result of circular dependency analysis
 */
export interface CircularDependencyAnalysis {
	/** Whether any circular dependencies were found */
	hasCircularDependencies: boolean;
	/** List of all detected circular dependencies */
	circularDependencies: CircularDependency[];
}

/**
 * Detects circular dependencies in provider dependencies
 *
 * Uses depth-first search (DFS) to detect cycles in the dependency graph.
 * Detects provider-level circular dependencies where ServiceA depends on ServiceB
 * which depends back on ServiceA (directly or indirectly).
 *
 * @example
 * ```typescript
 * const detector = new CircularDependencyDetectorHelper();
 * const analysis = detector.detectCircularDependencies(injectableClasses, paramsMap);
 *
 * if (analysis.hasCircularDependencies) {
 *   console.error(`Found ${analysis.circularDependencies.length} circular dependencies`);
 *   analysis.circularDependencies.forEach(cycle => {
 *     console.error(`${cycle.cycle.join(' -> ')}`);
 *   });
 * }
 * ```
 */
export class CircularDependencyDetectorHelper {
	/**
	 * Detect circular dependencies in injectable classes
	 *
	 * @param injectableClasses - Array of injectable class declarations
	 * @param paramsMap - Map of class names to their inject parameters
	 * @returns CircularDependencyAnalysis with all detected cycles
	 */
	public detectCircularDependencies(
		injectableClasses: ts.ClassDeclaration[],
		paramsMap: Map<string, InjectParameterDeclaration[]>,
	): CircularDependencyAnalysis {
		const circularDependencies: CircularDependency[] = [];
		const visited = new Set<string>();
		const recursionStack = new Set<string>();
		const path: string[] = [];

		// Build provider dependency map
		const providerDeps = this.buildProviderDependencyMap(paramsMap);

		// Run DFS from each injectable class
		for (const injectableClass of injectableClasses) {
			const className = injectableClass.name?.text;
			if (!className) continue;

			if (!visited.has(className)) {
				this.dfsProviders(
					className,
					providerDeps,
					paramsMap,
					visited,
					recursionStack,
					path,
					circularDependencies,
				);
			}
		}

		return {
			hasCircularDependencies: circularDependencies.length > 0,
			circularDependencies,
		};
	}

	/**
	 * Build a map of provider class names to their dependency class names
	 */
	private buildProviderDependencyMap(
		paramsMap: Map<string, InjectParameterDeclaration[]>,
	): Map<string, string[]> {
		const providerDeps = new Map<string, string[]>();

		for (const [className, params] of paramsMap.entries()) {
			const dependencies: string[] = [];

			for (const param of params) {
				// Only track class dependencies (not string tokens)
				// and non-optional dependencies
				if (ts.isIdentifier(param.name) && !param.isOptional) {
					const depName = param.name.text;
					dependencies.push(depName);
				}
			}

			providerDeps.set(className, dependencies);
		}

		return providerDeps;
	}

	/**
	 * Depth-first search for provider circular dependencies
	 */
	private dfsProviders(
		className: string,
		providerDeps: Map<string, string[]>,
		paramsMap: Map<string, InjectParameterDeclaration[]>,
		visited: Set<string>,
		recursionStack: Set<string>,
		path: string[],
		cycles: CircularDependency[],
	): void {
		// Mark current node as visited and add to recursion stack
		visited.add(className);
		recursionStack.add(className);
		path.push(className);

		const dependencies = providerDeps.get(className) || [];

		// Visit all dependencies
		for (const depClassName of dependencies) {
			if (!providerDeps.has(depClassName)) {
				// Dependency is not a provider (might be external or string token), skip
				continue;
			}

			if (!visited.has(depClassName)) {
				// Recursively visit unvisited dependency
				this.dfsProviders(
					depClassName,
					providerDeps,
					paramsMap,
					visited,
					recursionStack,
					path,
					cycles,
				);
			} else if (recursionStack.has(depClassName)) {
				// Found a cycle - extract the cycle path
				const cycleStartIndex = path.indexOf(depClassName);
				const cyclePath = path.slice(cycleStartIndex);
				cyclePath.push(depClassName); // Complete the cycle

				// Find the parameter that creates the circular dependency
				const params = paramsMap.get(className) || [];
				const circularParam = params.find(
					(p) => ts.isIdentifier(p.name) && p.name.text === depClassName,
				);

				if (circularParam) {
					// Find the class declaration for the current class
					const classDeclaration = this.findClassDeclaration(
						className,
						paramsMap,
					);

					if (classDeclaration) {
						cycles.push({
							type: "provider",
							cycle: cyclePath,
							severity: "error",
							message: `Circular dependency detected: ${cyclePath.join(" -> ")}`,
							classDeclaration,
							circularParam,
						});
					}
				}
			}
		}

		// Remove from recursion stack and path
		recursionStack.delete(className);
		path.pop();
	}

	/**
	 * Find the class declaration for a given class name
	 */
	private findClassDeclaration(
		className: string,
		paramsMap: Map<string, InjectParameterDeclaration[]>,
	): ts.ClassDeclaration | undefined {
		const params = paramsMap.get(className);
		if (!params || params.length === 0) {
			return undefined;
		}

		// Get the class declaration from the first parameter's declaration
		const firstParam = params[0];
		let node: ts.Node = firstParam.declaration;

		// Traverse up the AST to find the class declaration
		while (node && !ts.isClassDeclaration(node)) {
			node = node.parent;
		}

		return ts.isClassDeclaration(node) ? node : undefined;
	}
}

