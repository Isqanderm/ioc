import type {
	GraphError,
	LazyModule,
	ModuleContainerInterface,
} from "@nexus-ioc/shared";
import type { AnalyzeLazyModule } from "../../core/graph/analyze-lazy-module";
import type { AnalyzeModule } from "../../core/graph/analyze-module";
import type { AnalyzeProvider } from "../../core/graph/analyze-provider";
import type { InjectionToken } from "../injection-token.interface";

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
	source: InjectionToken;
	target: InjectionToken;
	metadata: {
		index?: number;
		key?: string;
		inject?: "constructor" | "property";
		lazy?: boolean;
		isCircular?: boolean;
		unreached?: boolean;
	};
};

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
	providerTokens: InjectionToken[];
	errors: GraphError[];
}

export interface ModuleGraphInterface {
	compile(): Promise<void>;
	compileSegment(
		root: ModuleContainerInterface,
		lazyModule: LazyModule,
	): Promise<GraphSegment>;
	isProviderExported(
		moduleContainer: ModuleContainerInterface,
		token: InjectionToken,
	): Promise<boolean>;
	getNode(token: InjectionToken): Node | undefined;
	getEdge(token: InjectionToken): Edge[];
	getAllNodes(): Node[];
	getAllEdges(): Edge[][];
	nodes: Map<InjectionToken, Node>;
	edges: Map<InjectionToken, Edge[]>;
	errors: GraphError[];
}
