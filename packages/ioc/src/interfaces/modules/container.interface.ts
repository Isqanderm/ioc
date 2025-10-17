import type { ContainerBaseInterface } from "@nexus-ioc/shared";
import type { Module } from "../module-types.interface";
import type { ModuleGraphInterface } from "./module-graph.interface";

// Re-export base interface from shared package
export type { ContainerBaseInterface } from "@nexus-ioc/shared";

// Extend base interface with strongly-typed graph property
export interface ContainerInterface extends ContainerBaseInterface {
	run(rootModule: Module): Promise<void>;
	graph: ModuleGraphInterface;
}
