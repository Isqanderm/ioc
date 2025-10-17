import type {
	ContainerBaseInterface,
	ModuleContainerInterface,
	ModuleMetadata,
	ModulePluginInterface,
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
}
