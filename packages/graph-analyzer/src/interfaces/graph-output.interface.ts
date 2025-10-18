import type { CircularDependency } from "../analyzer/circular-dependency-detector";
import type {
	DepthLevel,
	ModuleDepthInfo,
} from "../analyzer/module-depth-analyzer";
import type {
	ProviderScopeInfo,
	ScopeMismatch,
} from "../analyzer/provider-scope-analyzer";
import type { UnusedProvider } from "../analyzer/unused-provider-detector";
import type { Dependency } from "../parser/dependency-extractor";

/**
 * Complete dependency graph output format
 *
 * This is the main output structure returned by the graph analyzer.
 * It contains all information about modules, providers, and their dependencies.
 */
export interface GraphOutput {
	/** Array of all modules in the dependency graph */
	modules: ModuleInfo[];
	/** Array of all providers across all modules */
	providers: ProviderInfo[];
	/** Metadata about the analysis run */
	metadata: GraphMetadata;
	/** Analysis results (optional, only included when analysis is enabled) */
	analysis?: GraphAnalysis;
}

/**
 * Analysis results for the dependency graph
 *
 * Contains results from various analysis features like circular dependency detection,
 * unused provider detection, module depth analysis, and provider scope analysis.
 */
export interface GraphAnalysis {
	/** Circular dependency analysis results */
	circularDependencies?: CircularDependency[];
	/** Unused provider analysis results */
	unusedProviders?: UnusedProvider[];
	/** Module depth analysis results */
	depthAnalysis?: {
		/** Maximum depth in the module hierarchy */
		maxDepth: number;
		/** Average depth across all modules */
		averageDepth: number;
		/** Total number of modules analyzed */
		totalModules: number;
		/** Modules at each depth level */
		depthLevels: DepthLevel[];
		/** Detailed information for each module */
		moduleDetails: ModuleDepthInfo[];
		/** Modules with excessive depth (potential code smell) */
		deepModules: ModuleDepthInfo[];
		/** Threshold used for identifying deep modules */
		deepModuleThreshold: number;
	};
	/** Provider scope analysis results */
	scopeAnalysis?: {
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
	};
}

/**
 * Metadata about the dependency graph analysis
 *
 * Contains information about when and how the analysis was performed,
 * along with summary statistics.
 */
export interface GraphMetadata {
	/** Path to the application entry point file */
	entryPoint: string;
	/** Name of the root module */
	rootModule: string;
	/** ISO timestamp of when the analysis was performed */
	analyzedAt: string;
	/** Version of the graph analyzer */
	version: string;
	/** Total number of modules in the graph */
	totalModules: number;
	/** Total number of providers across all modules */
	totalProviders: number;
}

/**
 * Information about a single module in the dependency graph
 *
 * Represents a Nexus IoC module decorated with @NsModule.
 */
export interface ModuleInfo {
	/** Module name (class name) */
	name: string;
	/** File path where the module is defined */
	path: string;
	/** Names of modules imported by this module */
	imports: string[];
	/** Tokens of providers exported by this module */
	exports: string[];
	/** Tokens of providers registered in this module */
	providers: string[];
	/** Whether this module is marked as global */
	isGlobal: boolean;
}

/**
 * Information about a single provider in the dependency graph
 *
 * Represents a provider registered in a Nexus IoC module.
 * Can be a class, value, factory, or class-based provider.
 */
export interface ProviderInfo {
	/** Provider token (identifier used for injection) */
	token: string;
	/** Type of provider */
	type: "Class" | "UseValue" | "UseFactory" | "UseClass";
	/** Name of the module that registers this provider */
	module: string;
	/** Lifecycle scope of the provider (only for class providers) */
	scope?: "Singleton" | "Request" | "Transient";
	/** Dependencies required by this provider */
	dependencies: Dependency[];
	/** Static value (only for UseValue providers) */
	value?: string;
	/** Factory function name (only for UseFactory providers) */
	factory?: string;
	/** Implementation class name (only for UseClass providers) */
	useClass?: string;
}
