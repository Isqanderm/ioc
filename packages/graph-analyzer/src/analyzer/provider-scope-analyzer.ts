import type {
	GraphProviderNode,
	NexusGraphModel,
} from "../graph/nexus-graph-model";

/**
 * Provider scope types
 */
export type ProviderScope = "Singleton" | "Scoped";

/**
 * Information about a provider's scope
 */
export interface ProviderScopeInfo {
	/** Provider token */
	token: string;
	/** Module that registers this provider */
	module: string;
	/** Provider scope */
	scope: ProviderScope;
	/** Provider type */
	type: "Class" | "UseValue" | "UseFactory" | "UseClass";
	/** Dependencies of this provider */
	dependencies: string[];
}

/**
 * Scope mismatch issue
 */
export interface ScopeMismatch {
	/** Provider with scope issue */
	provider: string;
	/** Provider's scope */
	providerScope: ProviderScope;
	/** Module that registers the provider */
	module: string;
	/** Dependency that causes the mismatch */
	dependency: string;
	/** Dependency's scope */
	dependencyScope: ProviderScope;
	/** Severity of the issue */
	severity: "error" | "warning";
	/** Description of the issue */
	message: string;
	/** Suggestions for fixing the issue */
	suggestions: string[];
}

/**
 * Provider scope analysis results
 */
export interface ProviderScopeAnalysis {
	/** Whether scope analysis was performed */
	hasScopeAnalysis: boolean;
	/** Total number of providers analyzed */
	totalProviders: number;
	/** Number of singleton providers */
	singletonProviders: number;
	/** Number of scoped providers */
	scopedProviders: number;
	/** Scope mismatches detected */
	scopeMismatches: ScopeMismatch[];
	/** All provider scope information */
	providerScopes: ProviderScopeInfo[];
}

/**
 * Analyzes provider scopes and detects scope-related issues
 *
 * This analyzer identifies:
 * - Singleton providers depending on Scoped providers (scope mismatch)
 * - Potential memory leaks from scope misuse
 * - Scope optimization opportunities
 */
export class ProviderScopeAnalyzer {
	constructor(private readonly graphModel: NexusGraphModel) {}

	/**
	 * Analyze provider scopes and detect issues
	 */
	analyze(): ProviderScopeAnalysis {
		// Build provider scope map
		const providerScopes = this.buildProviderScopeMap();

		// Detect scope mismatches
		const scopeMismatches = this.detectScopeMismatches();

		// Calculate statistics
		const singletonCount = providerScopes.filter(
			(p) => p.scope === "Singleton",
		).length;
		const scopedCount = providerScopes.filter(
			(p) => p.scope === "Scoped",
		).length;

		return {
			hasScopeAnalysis: true,
			totalProviders: providerScopes.length,
			singletonProviders: singletonCount,
			scopedProviders: scopedCount,
			scopeMismatches,
			providerScopes,
		};
	}

	/**
	 * Build a map of all providers with their scope information
	 */
	private buildProviderScopeMap(): ProviderScopeInfo[] {
		const providerScopes: ProviderScopeInfo[] = [];

		for (const module of this.graphModel.modules.values()) {
			for (const provider of module.providers) {
				const scope = this.extractProviderScope(provider);
				const dependencies = provider.dependencies
					.filter((dep) => !dep.optional)
					.map((dep) => dep.token);

				providerScopes.push({
					token: provider.token,
					module: module.name,
					scope,
					type: provider.type,
					dependencies,
				});
			}
		}

		return providerScopes;
	}

	/**
	 * Extract scope from provider
	 */
	private extractProviderScope(provider: GraphProviderNode): ProviderScope {
		// Check if scope is explicitly defined (applies to all provider types)
		if (provider.scope) {
			const scopeStr = provider.scope.toLowerCase();
			if (scopeStr.includes("scoped") || scopeStr === "1") {
				return "Scoped";
			}
		}

		// Default to Singleton for all provider types
		return "Singleton";
	}

	/**
	 * Detect scope mismatches in provider dependencies. Walks the graph
	 * model directly (rather than the flattened, display-only
	 * `ProviderScopeInfo[]`) so it can match dependencies by
	 * `GraphProviderNode.id`/`GraphProviderDependency.tokenId` — two
	 * different provider classes named alike must not collapse into one
	 * `scopeMap` entry.
	 */
	private detectScopeMismatches(): ScopeMismatch[] {
		const mismatches: ScopeMismatch[] = [];
		const scopeMap = new Map<
			string,
			{ token: string; module: string; scope: ProviderScope }
		>();

		// Build lookup map, keyed by provider id
		for (const module of this.graphModel.modules.values()) {
			for (const provider of module.providers) {
				scopeMap.set(provider.id, {
					token: provider.token,
					module: module.name,
					scope: this.extractProviderScope(provider),
				});
			}
		}

		// Check each provider's dependencies
		for (const module of this.graphModel.modules.values()) {
			for (const provider of module.providers) {
				const scope = this.extractProviderScope(provider);
				// Only check Singleton providers (they shouldn't depend on Scoped)
				if (scope !== "Singleton") {
					continue;
				}

				for (const dep of provider.dependencies) {
					if (dep.optional || !dep.tokenId) continue;
					const dependency = scopeMap.get(dep.tokenId);

					// If dependency is Scoped, this is a scope mismatch
					if (dependency && dependency.scope === "Scoped") {
						mismatches.push({
							provider: provider.token,
							providerScope: scope,
							module: module.name,
							dependency: dependency.token,
							dependencyScope: dependency.scope,
							severity: "error",
							message: `Singleton provider '${provider.token}' depends on Scoped provider '${dependency.token}'. This can cause memory leaks and unexpected behavior.`,
							suggestions: [
								`Change '${provider.token}' to Scoped scope`,
								`Change '${dependency.token}' to Singleton scope if it doesn't need scoped state`,
								"Use a factory or lazy injection to resolve the dependency per scope",
							],
						});
					}
				}
			}
		}

		return mismatches;
	}
}
