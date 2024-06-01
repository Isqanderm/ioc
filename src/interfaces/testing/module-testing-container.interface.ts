import type { ContainerBaseInterface } from "../modules/container.interface";
import type { ModuleContainerInterface } from "../modules/module-container.interface";
import type { ModuleGraphInterface } from "../modules/module-graph.interface";

export interface ModuleTestingContainerInterface
	extends ContainerBaseInterface {
	// getModule(token: InjectionToken): Module | DynamicModule;
	// addModule(metatype: Type<unknown>): this;
	// removeModule(metatype: Type<unknown>): this;
	// replaceModule(
	// 	metatypeToReplace: Type<unknown>,
	// 	newMetatype: Type<unknown>,
	// ): this;

	// getProvider(token: InjectionToken): Provider;
	// addProvider(provider: Provider): this;
	// removeProvider(provider: InjectionToken): this;
	// replaceProvider(providerToReplace: Provider, newProvider: Provider): this;

	graph: ModuleGraphInterface;

	compile(): Promise<ModuleContainerInterface>;
}
