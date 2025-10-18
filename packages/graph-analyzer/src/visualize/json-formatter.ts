import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";
import type {
	GraphOutput,
	GraphMetadata,
	ModuleInfo,
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
	 */
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
		private readonly entryPoint: string,
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

		return {
			modules,
			providers,
			metadata,
		};
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

