import type { AnalyzeModule } from "../../core/graph/analyze-module";
import type { AnalyzeProvider } from "../../core/graph/analyze-provider";
import type { Token } from "../../core/modules/modules-container";
import type { DynamicModule } from "../dynamic-module.interface";
import type { InjectionToken } from "../injection-token.interface";
import type { Module, Provider } from "../module-types.interface";
import type { Scope } from "../scope.interface";
import type { ModuleContainerInterface } from "./module-container.interface";

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

export type GraphError =
	| {
			type: "CD_IMPORTS";
			path: string[];
	  }
	| {
			type: "CD_PROVIDERS";
			path: [InjectionToken, InjectionToken][];
	  }
	| {
			type: "UNREACHED_DEP_CONSTRUCTOR";
			token: string;
			dependency: string;
			position: number;
	  }
	| {
			type: "UNREACHED_DEP_PROPERTY";
			token: string;
			dependency: string;
			key: string;
	  }
	| {
			type: "UNREACHED_DEP_FACTORY";
			token: string;
			dependency: string;
			key: number;
	  };

export interface ModuleGraphInterface {
	compile(): Promise<void>;
	getNode(token: InjectionToken): Node;
	getEdge(token: InjectionToken): Edge[];
	getAllNodes(): Node[];
	getAllEdges(): Edge[][];
	nodes: Map<InjectionToken, Node>;
	edges: Map<InjectionToken, Edge[]>;
	errors: GraphError[];
}
