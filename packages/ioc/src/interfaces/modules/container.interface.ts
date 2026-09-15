import type { ContainerBaseInterface } from "@nexus-ioc/shared";
import type { Type } from "../type.interface";
import type { ModuleGraphInterface } from "./module-graph.interface";

// Re-export base interface from shared package
export type { ContainerBaseInterface } from "@nexus-ioc/shared";

// Extend base interface with strongly-typed graph property
export interface ContainerInterface extends ContainerBaseInterface {
	run(rootModule: Type): Promise<void>;
	graph: ModuleGraphInterface;
}
