import type {
	GraphProviderNode,
	NexusGraphModel,
} from "../graph/nexus-graph-model";

/**
 * Provider scope types
 */
export type ProviderScope = "Singleton" | "Transient";

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
 * Provider scope analysis results
 */
export interface ProviderScopeAnalysis {
	/** Whether scope analysis was performed */
	hasScopeAnalysis: boolean;
	/** Total number of providers analyzed */
	totalProviders: number;
	/** Number of singleton providers */
	singletonProviders: number;
	/** Number of transient providers */
	transientProviders: number;
	/** All provider scope information */
	providerScopes: ProviderScopeInfo[];
}

/**
 * Reports each provider's scope (Singleton or Transient).
 */
export class ProviderScopeAnalyzer {
	constructor(private readonly graphModel: NexusGraphModel) {}

	/**
	 * Analyze provider scopes and detect issues
	 */
	analyze(): ProviderScopeAnalysis {
		// Build provider scope map
		const providerScopes = this.buildProviderScopeMap();

		// Calculate statistics
		const singletonCount = providerScopes.filter(
			(p) => p.scope === "Singleton",
		).length;
		const transientCount = providerScopes.filter(
			(p) => p.scope === "Transient",
		).length;

		return {
			hasScopeAnalysis: true,
			totalProviders: providerScopes.length,
			singletonProviders: singletonCount,
			transientProviders: transientCount,
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
			if (scopeStr.includes("transient") || scopeStr === "2") {
				return "Transient";
			}
		}

		// Default to Singleton for all provider types
		return "Singleton";
	}
}
