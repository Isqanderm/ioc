import type {
	GraphError,
	LazyModule,
	ModuleContainerInterface,
} from "@nexus-ioc/shared";
import type { AnalyzeLazyModule } from "../../core/graph/analyze-lazy-module";
import type { AnalyzeModule } from "../../core/graph/analyze-module";
import type { AnalyzeProvider } from "../../core/graph/analyze-provider";
import type { ProviderToken } from "../injection-token.interface";
import type { Type } from "../type.interface";

// Re-export GraphError from shared package
export type { GraphError } from "@nexus-ioc/shared";

export enum NodeTypeEnum {
	MODULE = "module",
	PROVIDER = "provider",
	LAZY = "lazy",
}

export enum EdgeTypeEnum {
	IMPORT = "import",
	EXPORT = "export",
	PROVIDER = "provider",
	DEPENDENCY = "dependency",
	LAZY = "lazy",
}

export type Node = AnalyzeModule | AnalyzeProvider | AnalyzeLazyModule;

export type Edge = {
	type: EdgeTypeEnum;
	source: ProviderToken;
	target: ProviderToken;
	metadata: {
		index?: number;
		key?: string;
		inject?: "constructor" | "property" | "runtime";
		lazy?: boolean;
		isCircular?: boolean;
		unreached?: boolean;
		/**
		 * The dependency is satisfied by the parent container chain (a child
		 * graph only); its target is not resolved in this graph.
		 */
		external?: boolean;
		/**
		 * An `@Optional()` dependency whose target was not visible from the
		 * source's module when the edge was compiled (it may not have existed
		 * yet). Set only when true. The resolver injects the target only
		 * while it exists and is visible from the source's module.
		 */
		lateBound?: boolean;
	};
};

export interface ModuleGraphOptions {
	/**
	 * Whether the parent container chain can provide `token`. Consulted only
	 * when a dependency is not visible locally.
	 */
	externalLookup?: (token: ProviderToken) => boolean;
}

/**
 * The part of the graph added by a single lazy module load.
 * A non-empty `errors` list means the segment was rolled back and none of
 * its nodes or edges remain in the graph.
 */
export interface GraphSegment {
	lazyModule: LazyModule;
	moduleContainer: ModuleContainerInterface;
	/** Module node ids added by this segment. */
	moduleTokens: string[];
	/** Provider node ids added by this segment. */
	providerTokens: ProviderToken[];
	errors: GraphError[];
}

/** What `ModuleGraph.unloadSegment` removed from the graph. */
export interface SegmentUnloadResult {
	destroyedModules: string[];
	destroyedProviders: ProviderToken[];
}

/** What unloading a lazy module did. */
export interface UnloadResult extends SegmentUnloadResult {
	/**
	 * Child applications this unload started closing because the module
	 * that declared them in `@Module({ children })` was destroyed. A child
	 * whose close failed still counts; a child that was already closing
	 * (its own `close()`) does not, though the unload still waits for it.
	 */
	closedChildren: number;
}

export interface ModuleGraphInterface {
	compile(): Promise<void>;
	compileSegment(
		root: ModuleContainerInterface,
		lazyModule: LazyModule,
	): Promise<GraphSegment>;
	unloadSegment(
		lazyModule: LazyModule,
		protectedRoots: Set<string>,
	): SegmentUnloadResult;
	isProviderVisible(
		moduleContainer: ModuleContainerInterface,
		token: ProviderToken,
	): boolean;
	isProviderExported(
		moduleContainer: ModuleContainerInterface,
		token: ProviderToken,
	): Promise<boolean>;
	/**
	 * Records a dependency discovered at runtime by `inject()`. Idempotent;
	 * keeps the target's module alive while the source's module is loaded.
	 */
	addRuntimeDependency(source: ProviderToken, target: ProviderToken): void;
	/**
	 * The container of the module that declares `child` in `@Module({ children })`,
	 * including modules of loaded lazy segments.
	 */
	findChildDeclaration(
		child: Type | LazyModule,
	): ModuleContainerInterface | undefined;
	getNode(token: ProviderToken): Node | undefined;
	getEdge(token: ProviderToken): Edge[];
	getAllNodes(): Node[];
	getAllEdges(): Edge[][];
	nodes: Map<ProviderToken, Node>;
	edges: Map<ProviderToken, Edge[]>;
	rootToken: string;
	internalRootTokens: string[];
	errors: GraphError[];
	/**
	 * Changes whenever a compile, segment load or unload may have changed
	 * which providers exist or are visible; lets callers cache visibility.
	 */
	readonly version: number;
}
