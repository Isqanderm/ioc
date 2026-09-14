import { CircularDependencyDetector } from "../analyzer/circular-dependency-detector";
import { ModuleDepthAnalyzer } from "../analyzer/module-depth-analyzer";
import { ProviderScopeAnalyzer } from "../analyzer/provider-scope-analyzer";
import { UnusedProviderDetector } from "../analyzer/unused-provider-detector";
import type {
	GraphModuleNode,
	GraphModuleReference,
	GraphProviderNode,
	NexusGraphModel,
} from "../graph/nexus-graph-model";
import type {
	GraphMetadata,
	GraphOutput,
	ModuleInfo,
	ModuleReferenceInfo,
	ProviderInfo,
} from "../interfaces/graph-output.interface";

/**
 * Formats dependency graphs as structured JSON output
 *
 * Traverses the module graph and extracts all metadata about modules, providers,
 * and dependencies into a structured JSON format suitable for analysis or documentation.
 *
 * @example
 * ```typescript
 * const formatter = new JsonFormatter(graphModel, 'src/main.ts');
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
	 * @param graphModel - The application's graph model
	 * @param entryPoint - Path to application entry point file
	 * @param checkCircular - Whether to perform circular dependency detection
	 * @param checkUnused - Whether to perform unused provider detection
	 * @param checkDepth - Whether to perform module depth analysis
	 * @param deepModuleThreshold - Threshold for identifying deep modules
	 * @param checkScope - Whether to perform provider scope analysis
	 */
	constructor(
		private readonly graphModel: NexusGraphModel,
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
		const entryModule = this.graphModel.modules.get(
			this.graphModel.entryModuleId,
		);

		if (!entryModule) {
			throw new Error("Empty entry module");
		}

		const modules: ModuleInfo[] = [];
		const providers: ProviderInfo[] = [];
		const visitedModules = new Set<string>();
		const modulesToVisit = [entryModule.id];

		// Traverse all modules
		while (modulesToVisit.length > 0) {
			const moduleId = modulesToVisit.shift();
			if (!moduleId || visitedModules.has(moduleId)) {
				continue;
			}

			visitedModules.add(moduleId);
			const module = this.graphModel.modules.get(moduleId);

			if (!module) {
				continue;
			}

			// Add module info
			modules.push(this.formatModule(module));

			// Add provider info
			for (const provider of module.providers) {
				providers.push(this.formatProvider(provider, module));
			}

			// Queue imported modules
			modulesToVisit.push(...module.imports.map((entry) => entry.id));
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
			const detector = new CircularDependencyDetector(this.graphModel);
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
			const detector = new UnusedProviderDetector(this.graphModel);
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
				this.graphModel,
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
			const analyzer = new ProviderScopeAnalyzer(this.graphModel);
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
	private formatModule(module: GraphModuleNode): ModuleInfo {
		return {
			name: module.name,
			path: module.path,
			imports: module.imports.map(toModuleReferenceInfo),
			exports: module.exports.map(toModuleReferenceInfo),
			providers: module.providers.map((provider) => provider.token),
			isGlobal: module.isGlobal,
		};
	}

	/**
	 * Format a provider as ProviderInfo
	 */
	private formatProvider(
		provider: GraphProviderNode,
		module: GraphModuleNode,
	): ProviderInfo {
		const providerInfo: ProviderInfo = {
			token: provider.token,
			type: provider.type,
			module: { name: module.name, path: module.path },
			dependencies: provider.dependencies.map(({ token, optional }) => ({
				token,
				optional,
			})),
		};

		if (provider.scope) {
			providerInfo.scope = provider.scope as
				| "Singleton"
				| "Request"
				| "Transient";
		}

		if (provider.type === "UseClass" && provider.useClass) {
			providerInfo.useClass = provider.useClass;
		}

		if (provider.undeclaredDependencies.length > 0) {
			providerInfo.undeclaredDependencies = provider.undeclaredDependencies;
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

function toModuleReferenceInfo(
	entry: GraphModuleReference,
): ModuleReferenceInfo {
	return { name: entry.name, path: entry.path };
}
