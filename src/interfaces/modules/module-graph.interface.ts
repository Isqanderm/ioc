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

export type Node =
	| {
			type: NodeTypeEnum.MODULE;
			id: Token;
			label: string;
			metatype: Module | DynamicModule;
			moduleContainer: ModuleContainerInterface;
			isDynamic: boolean;
			isGlobal: boolean;
	  }
	| {
			type: NodeTypeEnum.PROVIDER;
			id: InjectionToken;
			label: string;
			scope: Scope;
			metatype: Provider;
			moduleContainer: ModuleContainerInterface;
	  };

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
	getNode(token: InjectionToken): Node;
	getEdge(token: InjectionToken): Edge[];
	getAllNodes(): Node[];
	getAllEdges(): Edge[][];
	nodes: Map<InjectionToken, Node>;
	edges: Map<InjectionToken, Edge[]>;
}
