import "reflect-metadata";
import {
	type ContainerInterface,
	type DynamicModule,
	type HashUtilInterface,
	MODULE_TOKEN_WATERMARK,
	type Module,
	type ModuleContainerInterface,
	type ModulesContainerInterface,
} from "../../interfaces";
import { ModuleContainerFactory } from "./module-container-factory";
import { ModuleTokenFactory } from "./module-token-factory";

export type Token = string;

export class ModulesContainer implements ModulesContainerInterface {
	private readonly containers = new Map<Token, ModuleContainerInterface>();
	private readonly moduleTokenFactory = new ModuleTokenFactory(this.hashUtils);
	private readonly moduleContainerFactory = new ModuleContainerFactory(this.moduleTokenFactory);

	constructor(
		private readonly hashUtils: HashUtilInterface,
		private readonly container: ContainerInterface,
	) {}

	async addModule(module: Module | DynamicModule): Promise<ModuleContainerInterface> {
		const cacheModule = await this.getModule(module);

		if (cacheModule) {
			return cacheModule;
		}

		return this.setModule(module);
	}

	getModule(module: Module | DynamicModule): ModuleContainerInterface | undefined {
		return this.getModuleFromCache(module);
	}

	async replaceModule(
		moduleToReplace: Module,
		newModule: Module,
	): Promise<ModuleContainerInterface> {
		const tokenToReplace = this.getModule(moduleToReplace);
		const newModuleContainer = await this.setModule(newModule);

		this.containers.set(tokenToReplace?.token || newModuleContainer.token, newModuleContainer);

		return newModuleContainer;
	}

	private async setModule(module: Module | DynamicModule): Promise<ModuleContainerInterface> {
		const moduleContainer = await this.moduleContainerFactory.create(module, this.container);

		this.containers.set(moduleContainer.token, moduleContainer);

		return moduleContainer;
	}

	private getModuleFromCache(module: Module | DynamicModule): ModuleContainerInterface | undefined {
		const token = Reflect.getMetadata(MODULE_TOKEN_WATERMARK, module) as Token;

		return this.containers.get(token);
	}
}
