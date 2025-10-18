import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";
import type {
	GraphOutput,
	GraphMetadata,
	ModuleInfo,
	ProviderInfo,
} from "../interfaces/graph-output.interface";

/**
 * Formats the dependency graph as JSON
 */
export class JsonFormatter {
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
		private readonly entryPoint: string,
	) {}

	/**
	 * Format the graph as a structured JSON object
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
	 * Format the graph as a JSON string
	 */
	formatAsString(indent = 2): string {
		return JSON.stringify(this.format(), null, indent);
	}
}

