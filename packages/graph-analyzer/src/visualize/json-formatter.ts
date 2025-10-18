import { CircularDependencyDetector } from "../analyzer/circular-dependency-detector";
import { ModuleDepthAnalyzer } from "../analyzer/module-depth-analyzer";
import { ProviderScopeAnalyzer } from "../analyzer/provider-scope-analyzer";
import { UnusedProviderDetector } from "../analyzer/unused-provider-detector";
import type {
	GraphMetadata,
	GraphOutput,
	ModuleInfo,
	ProviderInfo,
} from "../interfaces/graph-output.interface";
import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";

/**
 * Formats dependency graphs as structured JSON output
 *
 * Traverses the module graph and extracts all metadata about modules, providers,
 * and dependencies into a structured JSON format suitable for analysis or documentation.
 *
 * @example
 * ```typescript
 * const formatter = new JsonFormatter(modulesGraph, 'src/main.ts');
 * const output = formatter.format();
 *
 * console.log(`Modules: ${output.modules.length}`);
 * console.log(`Providers: ${output.providers.length}`);
 *
 * // Save to file
 * const jsonString = formatter.formatAsString(2);
 * fs.writeFileSync('graph.json', jsonString);
 * ```
 */
export class JsonFormatter {
	/**
	 * Create a new JsonFormatter instance
	 *
	 * @param graph - Map of module names to parsed modules
	 * @param entryPoint - Path to application entry point file
	 * @param checkCircular - Whether to perform circular dependency detection
	 * @param checkUnused - Whether to perform unused provider detection
	 * @param checkDepth - Whether to perform module depth analysis
	 * @param deepModuleThreshold - Threshold for identifying deep modules
	 * @param checkScope - Whether to perform provider scope analysis
	 */
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
		private readonly entryPoint: string,
		private readonly checkCircular = false,
		private readonly checkUnused = false,
		private readonly checkDepth = false,
		private readonly deepModuleThreshold = 5,
		private readonly checkScope = false,
	) {}

	/**
	 * Format the dependency graph as a structured JSON object
	 *
	 * Traverses all modules starting from the entry point and extracts:
	 * - Module information (name, path, imports, exports, providers)
	 * - Provider information (token, type, dependencies, scope)
	 * - Metadata (entry point, root module, statistics)
	 *
	 * @returns GraphOutput object with complete graph information
	 * @throws Error if entry module is empty or invalid
	 *
	 * @example
	 * ```typescript
	 * const output = formatter.format();
	 *
	 * // Access modules
	 * output.modules.forEach(module => {
	 *   console.log(`Module: ${module.name}`);
	 *   console.log(`  Providers: ${module.providers.join(', ')}`);
	 * });
	 *
	 * // Access providers
	 * output.providers.forEach(provider => {
	 *   console.log(`Provider: ${provider.token} (${provider.type})`);
	 *   if (provider.dependencies) {
	 *     console.log(`  Dependencies: ${provider.dependencies.length}`);
	 *   }
	 * });
	 * ```
	 */
	format(): GraphOutput {
		const entryModule = this.graph.get("entry") as ParseEntryFile;

		if (!entryModule || !entryModule.name) {
			throw new Error("Empty entry module");
		}

		const modules: ModuleInfo[] = [];
		const providers: ProviderInfo[] = [];
		const visitedModules = new Set<string>();
		const modulesToVisit = [entryModule.name];

		// Traverse all modules
		while (modulesToVisit.length > 0) {
			const moduleName = modulesToVisit.shift();
			if (!moduleName || visitedModules.has(moduleName)) {
				continue;
			}

			visitedModules.add(moduleName);
			const parseNsModule = this.graph.get(moduleName) as ParseNsModule;

			if (!parseNsModule) {
				continue;
			}

			// Add module info
			modules.push(this.formatModule(parseNsModule, moduleName));

			// Add provider info
			for (const provider of parseNsModule.providers) {
				providers.push(this.formatProvider(provider, moduleName));
			}

			// Queue imported modules
			modulesToVisit.push(...parseNsModule.imports);
		}

		// Create metadata
		const metadata: GraphMetadata = {
			entryPoint: this.entryPoint,
			rootModule: entryModule.name,
			analyzedAt: new Date().toISOString(),
			version: "1.0.0",
			totalModules: modules.length,
			totalProviders: providers.length,
		};

		const output: GraphOutput = {
			modules,
			providers,
			metadata,
		};

		// Add circular dependency analysis if enabled
		if (this.checkCircular) {
			const detector = new CircularDependencyDetector(this.graph);
			const analysis = detector.analyze();

			if (analysis.hasCircularDependencies) {
				if (!output.analysis) {
					output.analysis = {};
				}
				output.analysis.circularDependencies = analysis.circularDependencies;
			}
		}

		// Add unused provider analysis if enabled
		if (this.checkUnused) {
			const detector = new UnusedProviderDetector(this.graph);
			const analysis = detector.analyze();

			if (analysis.hasUnusedProviders) {
				if (!output.analysis) {
					output.analysis = {};
				}
				output.analysis.unusedProviders = analysis.unusedProviders;
			}
		}

		// Add module depth analysis if enabled
		if (this.checkDepth) {
			const analyzer = new ModuleDepthAnalyzer(
				this.graph,
				this.deepModuleThreshold,
			);
			const analysis = analyzer.analyze();

			if (analysis.hasDepthAnalysis) {
				if (!output.analysis) {
					output.analysis = {};
				}
				output.analysis.depthAnalysis = {
					maxDepth: analysis.maxDepth,
					averageDepth: analysis.averageDepth,
					totalModules: analysis.totalModules,
					depthLevels: analysis.depthLevels,
					moduleDetails: analysis.moduleDetails,
					deepModules: analysis.deepModules,
					deepModuleThreshold: analysis.deepModuleThreshold,
				};
			}
		}

		// Add provider scope analysis if enabled
		if (this.checkScope) {
			const analyzer = new ProviderScopeAnalyzer(this.graph);
			const analysis = analyzer.analyze();

			if (analysis.hasScopeAnalysis) {
				if (!output.analysis) {
					output.analysis = {};
				}
				output.analysis.scopeAnalysis = {
					totalProviders: analysis.totalProviders,
					singletonProviders: analysis.singletonProviders,
					requestProviders: analysis.requestProviders,
					scopeMismatches: analysis.scopeMismatches,
					providerScopes: analysis.providerScopes,
				};
			}
		}

		return output;
	}

	/**
	 * Format a module as ModuleInfo
	 */
	private formatModule(
		parseNsModule: ParseNsModule,
		moduleName: string,
	): ModuleInfo {
		return {
			name: moduleName,
			path: parseNsModule.filePath || "",
			imports: parseNsModule.imports,
			exports: parseNsModule.exports,
			providers: parseNsModule.providers
				.map((p) => p.token)
				.filter((token): token is string => token !== null),
			isGlobal: parseNsModule.isGlobal,
		};
	}

	/**
	 * Format a provider as ProviderInfo
	 */
	private formatProvider(
		// biome-ignore lint/suspicious/noExplicitAny: Provider type is complex
		provider: any,
		moduleName: string,
	): ProviderInfo {
		const providerInfo: ProviderInfo = {
			token: provider.token,
			type: provider.type,
			module: moduleName,
			dependencies: provider.dependencies || [],
		};

		// Add scope if present
		if (provider.scope) {
			providerInfo.scope = provider.scope;
		}

		// Add type-specific fields
		if (provider.type === "UseValue" && provider.value !== undefined) {
			providerInfo.value = String(provider.value);
		}

		if (provider.type === "UseFactory" && provider.inject) {
			providerInfo.factory = provider.inject;
		}

		if (provider.type === "UseClass" && provider.inject) {
			providerInfo.useClass = provider.inject;
		}

		return providerInfo;
	}

	/**
	 * Format the dependency graph as a JSON string
	 *
	 * Convenience method that calls format() and stringifies the result.
	 *
	 * @param indent - Number of spaces for JSON indentation (default: 2)
	 * @returns Formatted JSON string
	 *
	 * @example
	 * ```typescript
	 * // Pretty-printed with 2 spaces
	 * const json = formatter.formatAsString();
	 *
	 * // Pretty-printed with 4 spaces
	 * const json = formatter.formatAsString(4);
	 *
	 * // Minified (no indentation)
	 * const json = formatter.formatAsString(0);
	 *
	 * // Save to file
	 * fs.writeFileSync('graph.json', json);
	 * ```
	 */
	formatAsString(indent = 2): string {
		return JSON.stringify(this.format(), null, indent);
	}
}
