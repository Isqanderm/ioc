import { Container } from "../core/modules/container";
import { ContainerNotCompiledError } from "../errors/container-not-compiled.error";
import type {
	DynamicModule,
	InjectionToken,
	Module,
	ModuleContainerInterface,
	ModuleGraphInterface,
	ModuleMetadata,
} from "../interfaces";
import type { ModuleTestingContainerInterface } from "../interfaces/testing";
import { HashTestingUtil } from "./hash-testing-util";
import { TestingCreator } from "./testing-creator";

export class TestingContainer implements ModuleTestingContainerInterface {
	private readonly hashTestingUtil = new HashTestingUtil();
	private readonly container = new Container(this.hashTestingUtil);
	private readonly moduleTestingCreator = new TestingCreator();
	private _moduleContainer: ModuleContainerInterface | null = null;
	private _module: Module | null = null;
	private containerCompiled = false;

	private constructor(private readonly metatype: ModuleMetadata) {}

	static createTestingContainer(metatype: ModuleMetadata) {
		return new TestingContainer(metatype);
	}

	async addModule(
		metatype: Module | DynamicModule,
	): Promise<ModuleContainerInterface> {
		return this.container.addModule(metatype);
	}

	async getModule(
		metatype: Module,
	): Promise<ModuleContainerInterface | undefined> {
		return this.container.getModule(metatype);
	}

	async replaceModule(
		metatypeToReplace: Module,
		newMetatype: Module,
	): Promise<ModuleContainerInterface> {
		return this.container.replaceModule(metatypeToReplace, newMetatype);
	}

	get<T>(token: InjectionToken): Promise<T | undefined> {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this.container.get<T>(token);
	}

	async compile(): Promise<ModuleContainerInterface> {
		this._module = this.moduleTestingCreator.create(this.metatype);
		this._moduleContainer = await this.container.addModule(this._module);

		await this.container.run(this._moduleContainer.metatype as Module);

		this.containerCompiled = true;

		return this._moduleContainer;
	}

	get module() {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this._module;
	}

	get moduleContainer() {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this._moduleContainer;
	}

	get graph(): ModuleGraphInterface {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this.container.graph;
	}
}
