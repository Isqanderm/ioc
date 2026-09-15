import "reflect-metadata";
import type {
	ContainerBaseInterface,
	DynamicModule,
	ModuleContainerFactoryInterface,
	ModuleContainerInterface,
	ModuleTokenFactoryInterface,
	Type,
} from "../../interfaces";
import { MODULE_TOKEN_WATERMARK } from "../../interfaces";
import { ModuleContainer } from "./module-container";

export class ModuleContainerFactory implements ModuleContainerFactoryInterface {
	constructor(
		private readonly moduleTokenFactory: ModuleTokenFactoryInterface,
	) {}

	public async create(
		module: Type | DynamicModule,
		container: ContainerBaseInterface,
	): Promise<ModuleContainerInterface> {
		const moduleContainer = new ModuleContainer(module, container);

		moduleContainer.token = await this.getModuleToken(module);

		Reflect.defineMetadata(
			MODULE_TOKEN_WATERMARK,
			moduleContainer.token,
			module,
		);

		return moduleContainer;
	}

	public getModuleToken(module: Type | DynamicModule): Promise<string> {
		return this.moduleTokenFactory.create(module);
	}

	public async getModuleContainerImports(
		module: ModuleContainerInterface,
	): Promise<ModuleContainerInterface[]> {
		return await module.imports;
	}
}
