import type { ContainerBaseInterface, LazyModule } from "@nexus-ioc/shared";
import type { DynamicModule } from "../dynamic-module.interface";
import type { Type } from "../type.interface";
import type {
	GraphSegment,
	ModuleGraphInterface,
	UnloadResult,
} from "./module-graph.interface";

export type { ContainerBaseInterface } from "@nexus-ioc/shared";

// Extend base interface with strongly-typed graph property
export interface ContainerInterface extends ContainerBaseInterface {
	run(rootModule: Type, internalModules?: DynamicModule[]): Promise<void>;
	load(lazyModule: LazyModule): Promise<GraphSegment>;
	unload(lazyModule: LazyModule): Promise<UnloadResult>;
	graph: ModuleGraphInterface;
}
