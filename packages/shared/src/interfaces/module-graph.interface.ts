import type { GraphError } from "./graph-error.interface";
import type { InjectionToken } from "./injection-token.interface";

export interface ModuleGraphInterface {
	compile(): Promise<void>;
	getNode(token: InjectionToken): unknown | undefined;
	getEdge(token: InjectionToken): unknown[];
	getAllNodes(): unknown[];
	getAllEdges(): unknown[][];
	nodes: Map<InjectionToken, unknown>;
	edges: Map<InjectionToken, unknown[]>;
	errors: GraphError[];
}
