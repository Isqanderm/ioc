import type { ModuleMetadata } from "../module-metadata.interface";
import type {
	ContainerBaseInterface,
	ModuleContainerInterface,
	ModuleGraphInterface,
} from "../modules";
import type { ModulePluginInterface } from "../plugins";

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
