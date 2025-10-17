import type { GraphError } from "@nexus-ioc/shared";
import type { AnalyzeModule } from "../../core/graph/analyze-module";
import type { AnalyzeProvider } from "../../core/graph/analyze-provider";
import type { InjectionToken } from "../injection-token.interface";

// Re-export GraphError from shared package
export type { GraphError } from "@nexus-ioc/shared";

export enum NodeTypeEnum {
	MODULE = "module",
	PROVIDER = "provider",
}

export enum EdgeTypeEnum {
	IMPORT = "import",
	EXPORT = "export",
	PROVIDER = "provider",
	DEPENDENCY = "dependency",
}

export type Node = AnalyzeModule | AnalyzeProvider;

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

export interface ModuleGraphInterface {
	compile(): Promise<void>;
	getNode(token: InjectionToken): Node | undefined;
	getEdge(token: InjectionToken): Edge[];
	getAllNodes(): Node[];
	getAllEdges(): Edge[][];
	nodes: Map<InjectionToken, Node>;
	edges: Map<InjectionToken, Edge[]>;
	errors: GraphError[];
}
