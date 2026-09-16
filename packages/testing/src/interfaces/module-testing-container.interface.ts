import type {
	ContainerBaseInterface,
	LazyModule,
	ModuleContainerInterface,
	ModuleMetadata,
	ModulePluginInterface,
	ModuleRef,
	UnloadResult,
} from "@nexus-ioc/core";

export interface ModuleTestingContainerInterface<_T extends ModuleMetadata>
	extends ContainerBaseInterface,
		ModulePluginInterface {
	setModuleDecorator(
		decorator: <M extends ModuleMetadata = ModuleMetadata>(
			metadata: M,
		) => ClassDecorator,
	): this;

	compile(): Promise<ModuleContainerInterface>;

	load(lazyModule: LazyModule): Promise<ModuleRef>;

	unload(ref: ModuleRef): Promise<UnloadResult>;
}
