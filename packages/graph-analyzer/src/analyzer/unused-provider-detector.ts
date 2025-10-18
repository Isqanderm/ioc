import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";

/**
 * Information about an unused provider
 */
export interface UnusedProvider {
	/** Provider token (identifier) */
	token: string;
	/** Module where the provider is registered */
	module: string;
	/** Type of provider */
	type: "Class" | "UseValue" | "UseFactory" | "UseClass";
	/** Severity level */
	severity: "warning" | "info";
	/** Descriptive message */
	message: string;
	/** Suggestions for resolution */
	suggestions: string[];
}

/**
 * Analysis results for unused providers
 */
export interface UnusedProviderAnalysis {
	/** Whether any unused providers were detected */
	hasUnusedProviders: boolean;
	/** List of unused providers */
	unusedProviders: UnusedProvider[];
	/** Total count of unused providers */
	totalUnused: number;
}

/**
 * Detects providers that are registered but never injected
 *
 * Analyzes the dependency graph to find providers that are:
 * - Registered in a module's providers array
 * - Not injected as dependencies in any other provider
 * - Not exported from the module (unless they're used internally)
 *
 * @example
 * ```typescript
 * const detector = new UnusedProviderDetector(modulesGraph);
 * const analysis = detector.analyze();
 *
 * if (analysis.hasUnusedProviders) {
 *   console.log(`Found ${analysis.totalUnused} unused providers`);
 *   for (const provider of analysis.unusedProviders) {
 *     console.log(`- ${provider.token} in ${provider.module}`);
 *   }
 * }
 * ```
 */
export class UnusedProviderDetector {
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
	) {}

	/**
	 * Analyze the graph for unused providers
	 *
	 * @returns Analysis results containing all unused providers
	 */
	analyze(): UnusedProviderAnalysis {
		const unusedProviders: UnusedProvider[] = [];

		// Build a set of all injected provider tokens
		const injectedTokens = this.buildInjectedTokensSet();

		// Build a set of all exported provider tokens
		const exportedTokens = this.buildExportedTokensSet();

		// Check each module for unused providers
		for (const [moduleName, module] of this.graph) {
			if (moduleName === "entry") continue;

			const nsModule = module as ParseNsModule;
			if (!nsModule.providers || nsModule.providers.length === 0) continue;

			// Check each provider in the module
			for (const provider of nsModule.providers) {
				const token = provider.token;

				// Skip providers with null tokens
				if (!token) continue;

				// Skip if the provider is injected somewhere
				if (injectedTokens.has(token)) continue;

				// Skip if the provider is exported (it may be used externally)
				if (exportedTokens.has(token)) continue;

				// Skip if the module is global (providers may be used across the app)
				if (nsModule.isGlobal) continue;

				// This provider is unused
				const suggestions = this.generateSuggestions(
					token,
					moduleName,
					exportedTokens.has(token),
					nsModule.isGlobal,
				);

				// Normalize provider type to match expected union type
				const providerType = provider.type as
					| "Class"
					| "UseValue"
					| "UseFactory"
					| "UseClass";

				unusedProviders.push({
					token,
					module: moduleName,
					type: providerType,
					severity: "warning",
					message: `Provider '${token}' is registered in '${moduleName}' but never injected`,
					suggestions,
				});
			}
		}

		return {
			hasUnusedProviders: unusedProviders.length > 0,
			unusedProviders,
			totalUnused: unusedProviders.length,
		};
	}

	/**
	 * Build a set of all provider tokens that are injected as dependencies
	 */
	private buildInjectedTokensSet(): Set<string> {
		const injectedTokens = new Set<string>();

		for (const [moduleName, module] of this.graph) {
			if (moduleName === "entry") continue;

			const nsModule = module as ParseNsModule;
			if (!nsModule.providers) continue;

			// Check dependencies of each provider
			for (const provider of nsModule.providers) {
				if (!provider.dependencies) continue;

				for (const dependency of provider.dependencies) {
					// Skip optional dependencies as they may not be required
					if (!dependency.optional) {
						injectedTokens.add(dependency.token);
					}
				}
			}
		}

		return injectedTokens;
	}

	/**
	 * Build a set of all provider tokens that are exported from modules
	 */
	private buildExportedTokensSet(): Set<string> {
		const exportedTokens = new Set<string>();

		for (const [moduleName, module] of this.graph) {
			if (moduleName === "entry") continue;

			const nsModule = module as ParseNsModule;
			if (!nsModule.exports) continue;

			// Add all exported tokens
			for (const exportedToken of nsModule.exports) {
				exportedTokens.add(exportedToken);
			}
		}

		return exportedTokens;
	}

	/**
	 * Generate suggestions for resolving an unused provider
	 */
	private generateSuggestions(
		token: string,
		moduleName: string,
		isExported: boolean,
		isGlobal: boolean,
	): string[] {
		const suggestions: string[] = [];

		if (isExported) {
			suggestions.push(
				`Provider is exported - it may be used outside the analyzed scope`,
			);
			suggestions.push(
				`If not needed externally, remove '${token}' from the exports array`,
			);
		} else if (isGlobal) {
			suggestions.push(
				`Module is global - provider may be used across the application`,
			);
			suggestions.push(
				`Verify if '${token}' is actually needed before removing`,
			);
		} else {
			suggestions.push(
				`Remove '${token}' from the providers array in '${moduleName}'`,
			);
			suggestions.push(
				`Or export it if it's intended to be used by other modules`,
			);
			suggestions.push(
				`Or inject it somewhere if it provides side effects (e.g., initialization)`,
			);
		}

		return suggestions;
	}
}
