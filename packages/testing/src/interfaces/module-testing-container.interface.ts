import type { ModuleMetadata } from "nexus-ioc/dist/interfaces/module-metadata.interface";
import type {
	ContainerBaseInterface,
	ModuleContainerInterface,
	ModuleGraphInterface,
} from "nexus-ioc/dist/interfaces/modules";
import type { ModulePluginInterface } from "nexus-ioc/dist/interfaces/plugins";

export interface ModuleTestingContainerInterface<T extends ModuleMetadata>
	extends ContainerBaseInterface,
		ModulePluginInterface {
	graph: ModuleGraphInterface;
	setModuleDecorator(
		decorator: <M extends ModuleMetadata = ModuleMetadata>(
			metadata: M,
		) => ClassDecorator,
	): this;

	compile(): Promise<ModuleContainerInterface>;
}
