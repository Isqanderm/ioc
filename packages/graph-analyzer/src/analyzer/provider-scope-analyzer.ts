import type { Dependency } from "../parser/dependency-extractor";
import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";

/**
 * Provider scope types
 */
export type ProviderScope = "Singleton" | "Request";

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
	/** Number of request-scoped providers */
	requestProviders: number;
	/** Scope mismatches detected */
	scopeMismatches: ScopeMismatch[];
	/** All provider scope information */
	providerScopes: ProviderScopeInfo[];
}

/**
 * Analyzes provider scopes and detects scope-related issues
 *
 * This analyzer identifies:
 * - Singleton providers depending on request-scoped providers (scope mismatch)
 * - Potential memory leaks from scope misuse
 * - Scope optimization opportunities
 */
export class ProviderScopeAnalyzer {
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
	) {}

	/**
	 * Analyze provider scopes and detect issues
	 */
	analyze(): ProviderScopeAnalysis {
		// Build provider scope map
		const providerScopes = this.buildProviderScopeMap();

		// Detect scope mismatches
		const scopeMismatches = this.detectScopeMismatches(providerScopes);

		// Calculate statistics
		const singletonCount = providerScopes.filter(
			(p) => p.scope === "Singleton",
		).length;
		const requestCount = providerScopes.filter(
			(p) => p.scope === "Request",
		).length;

		return {
			hasScopeAnalysis: true,
			totalProviders: providerScopes.length,
			singletonProviders: singletonCount,
			requestProviders: requestCount,
			scopeMismatches,
			providerScopes,
		};
	}

	/**
	 * Build a map of all providers with their scope information
	 */
	private buildProviderScopeMap(): ProviderScopeInfo[] {
		const providerScopes: ProviderScopeInfo[] = [];

		for (const [key, value] of this.graph.entries()) {
			if (key === "entry") continue;

			const parseNsModule = value as ParseNsModule;
			if (!parseNsModule.providers) continue;

			for (const provider of parseNsModule.providers) {
				if (!provider.token) continue;

				const scope = this.extractProviderScope(provider);
				const dependencies = this.extractDependencyTokens(provider);

				providerScopes.push({
					token: provider.token,
					module: parseNsModule.name || key,
					scope,
					type: provider.type as
						| "Class"
						| "UseValue"
						| "UseFactory"
						| "UseClass",
					dependencies,
				});
			}
		}

		return providerScopes;
	}

	/**
	 * Extract scope from provider
	 */
	private extractProviderScope(provider: {
		type: string;
		scope?: string | null;
	}): ProviderScope {
		// Check if scope is explicitly defined (applies to all provider types)
		if (provider.scope) {
			const scopeStr = provider.scope.toLowerCase();
			if (scopeStr.includes("request") || scopeStr === "1") {
				return "Request";
			}
		}

		// Default to Singleton for all provider types
		return "Singleton";
	}

	/**
	 * Extract dependency tokens from provider
	 */
	private extractDependencyTokens(provider: {
		dependencies?: Dependency[];
		inject?: string[];
	}): string[] {
		const tokens: string[] = [];

		// Extract from dependencies array (Class and UseClass providers)
		if (provider.dependencies && Array.isArray(provider.dependencies)) {
			for (const dep of provider.dependencies as Dependency[]) {
				if (dep.token && !dep.optional) {
					tokens.push(dep.token);
				}
			}
		}

		// Extract from inject array (UseFactory providers)
		if (provider.inject && Array.isArray(provider.inject)) {
			tokens.push(...provider.inject);
		}

		return tokens;
	}

	/**
	 * Detect scope mismatches in provider dependencies
	 */
	private detectScopeMismatches(
		providerScopes: ProviderScopeInfo[],
	): ScopeMismatch[] {
		const mismatches: ScopeMismatch[] = [];
		const scopeMap = new Map<string, ProviderScopeInfo>();

		// Build lookup map
		for (const provider of providerScopes) {
			scopeMap.set(provider.token, provider);
		}

		// Check each provider's dependencies
		for (const provider of providerScopes) {
			// Only check Singleton providers (they shouldn't depend on Request-scoped)
			if (provider.scope !== "Singleton") {
				continue;
			}

			for (const depToken of provider.dependencies) {
				const dependency = scopeMap.get(depToken);

				// If dependency is Request-scoped, this is a scope mismatch
				if (dependency && dependency.scope === "Request") {
					mismatches.push({
						provider: provider.token,
						providerScope: provider.scope,
						module: provider.module,
						dependency: depToken,
						dependencyScope: dependency.scope,
						severity: "error",
						message: `Singleton provider '${provider.token}' depends on Request-scoped provider '${depToken}'. This can cause memory leaks and unexpected behavior.`,
						suggestions: [
							`Change '${provider.token}' to Request scope`,
							`Change '${depToken}' to Singleton scope if it doesn't need request-specific state`,
							"Use a factory or lazy injection to resolve the dependency per request",
						],
					});
				}
			}
		}

		return mismatches;
	}
}
