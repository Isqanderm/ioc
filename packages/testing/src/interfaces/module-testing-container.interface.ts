import type {
	ContainerBaseInterface,
	InjectionToken,
	LazyModule,
	ModuleContainerInterface,
	ModuleMetadata,
	ModulePluginInterface,
	ModuleRef,
	UnloadResult,
} from "@nexus-ioc/core";

export interface ModuleTestingContainerInterface<_T extends ModuleMetadata>
	extends Omit<ContainerBaseInterface, "get" | "resolve" | "hasProvider">,
		ModulePluginInterface {
	setModuleDecorator(
		decorator: <M extends ModuleMetadata = ModuleMetadata>(
			metadata: M,
		) => ClassDecorator,
	): this;

	// TEMPORARY (Task 3 replaces this): old async get() contract.
	get<T>(token: InjectionToken): Promise<T | undefined>;

	compile(): Promise<ModuleContainerInterface>;

	load(lazyModule: LazyModule): Promise<ModuleRef>;

	unload(ref: ModuleRef): Promise<UnloadResult>;
}
