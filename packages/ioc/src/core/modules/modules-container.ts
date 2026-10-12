import "reflect-metadata";
import {
	type ContainerInterface,
	type DynamicModule,
	type HashUtilInterface,
	MODULE_TOKEN_WATERMARK,
	type ModuleContainerInterface,
	type ModulesContainerInterface,
	type Type,
} from "../../interfaces";
import { isDynamicModule } from "../../utils/helpers";
import { ModuleContainerFactory } from "./module-container-factory";
import { ModuleTokenFactory } from "./module-token-factory";

export type Token = string;

export class ModulesContainer implements ModulesContainerInterface {
	private readonly containers = new Map<Token, ModuleContainerInterface>();
	/**
	 * Modules registered through `replaceModule`, keyed by the replaced class.
	 * Every lookup of a replaced module (`addModule`, `getModule`) is redirected
	 * to its replacement, even when the replaced module was not registered yet.
	 * Modules that were not replaced are never affected. This holds for
	 * everything this container adds later too, lazy modules included.
	 */
	private readonly replacements = new Map<Type, Type>();
	private readonly moduleTokenFactory = new ModuleTokenFactory(this.hashUtils);
	private readonly moduleContainerFactory = new ModuleContainerFactory(
		this.moduleTokenFactory,
	);

	constructor(
		private readonly hashUtils: HashUtilInterface,
		private readonly container: ContainerInterface,
	) {}

	async addModule(
		module: Type | DynamicModule,
	): Promise<ModuleContainerInterface> {
		module = this.applyReplacement(module);
		const cacheModule = await this.getModule(module);

		if (cacheModule) {
			return cacheModule;
		}

		return this.setModule(module);
	}

	getModule(
		module: Type | DynamicModule,
	): ModuleContainerInterface | undefined {
		return this.getModuleFromCache(this.applyReplacement(module));
	}

	removeModule(token: Token): void {
		this.containers.delete(token);
	}

	async replaceModule(
		moduleToReplace: Type,
		newModule: Type,
	): Promise<ModuleContainerInterface> {
		if (moduleToReplace === newModule) {
			return this.addModule(newModule);
		}

		const tokenToReplace = this.getModuleFromCache(moduleToReplace);
		this.replacements.set(moduleToReplace, newModule);
		const newModuleContainer = await this.setModule(newModule);

		this.containers.set(
			tokenToReplace?.token || newModuleContainer.token,
			newModuleContainer,
		);

		return newModuleContainer;
	}

	/**
	 * Maps a module through the replacements. The chain is followed
	 * (`A -> B -> C` gives `C`) and stops at a cycle (`A -> B`, `B -> A`).
	 *
	 * A `DynamicModule` whose `module` class is replaced is swapped for the
	 * replacement class used as a plain static module: the replacement is a
	 * class, so the dynamic module's own providers, imports and exports (meant
	 * for the replaced class) are dropped.
	 */
	private applyReplacement(module: Type | DynamicModule): Type | DynamicModule {
		if (this.replacements.size === 0) {
			return module;
		}

		let current: Type = isDynamicModule(module) ? module.module : module;
		const seen = new Set<Type>([current]);
		let replaced = false;

		for (
			let next = this.replacements.get(current);
			next !== undefined && !seen.has(next);
			next = this.replacements.get(current)
		) {
			seen.add(next);
			current = next;
			replaced = true;
		}

		return replaced ? current : module;
	}

	private async setModule(
		module: Type | DynamicModule,
	): Promise<ModuleContainerInterface> {
		const moduleContainer = await this.moduleContainerFactory.create(
			module,
			this.container,
			(exported) => this.applyReplacement(exported) as Type,
		);

		this.containers.set(moduleContainer.token, moduleContainer);

		return moduleContainer;
	}

	private getModuleFromCache(
		module: Type | DynamicModule,
	): ModuleContainerInterface | undefined {
		const token = Reflect.getMetadata(MODULE_TOKEN_WATERMARK, module) as Token;

		return this.containers.get(token);
	}
}
