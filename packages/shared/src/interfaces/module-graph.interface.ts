import type { GraphError } from "./graph-error.interface";
import type { ProviderToken } from "./injection-token.interface";

export interface ModuleGraphInterface {
	compile(): Promise<void>;
	getNode(token: ProviderToken): unknown | undefined;
	getEdge(token: ProviderToken): unknown[];
	getAllNodes(): unknown[];
	getAllEdges(): unknown[][];
	nodes: Map<ProviderToken, unknown>;
	edges: Map<ProviderToken, unknown[]>;
	errors: GraphError[];
}
