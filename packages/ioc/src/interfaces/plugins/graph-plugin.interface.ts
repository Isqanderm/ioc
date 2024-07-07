import type {
	Edge,
	ModuleContainerInterface,
	ModuleGraphPlugin,
	Node,
} from "../modules";

export interface GraphPluginInterface {
	onAddModuleNode?<T extends Node>(node: T): T;
	onAddModuleImportEdge?<T extends Edge>(edge: T): T;
	onAddProviderNode?<T extends Node>(node: T): T;
	onAddProviderEdge?<T extends Edge>(edge: T): T;
	parseModule?<T extends ModuleContainerInterface = ModuleContainerInterface>(
		module: T,
		graph: ModuleGraphPlugin,
	): void;
	onAddUseFactoryDependency?<T extends Edge>(edge: T): T;
	onAddUseClassDependency?<T extends Edge>(edge: T): T;
	onAddClassDependency?<T extends Edge>(edge: T): T;
}
