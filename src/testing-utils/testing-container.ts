import { Container } from "../core/modules/container";
import type { InjectionToken } from "../interfaces/injection-token.interface";
import type { ModuleMetadata } from "../interfaces/module-metadata.interface";
import type { Module } from "../interfaces/module-types.interface";
import type { ModuleContainerInterface } from "../interfaces/modules/module-container.interface";
import type { ModuleGraphInterface } from "../interfaces/modules/module-graph.interface";
import type { ModuleTestingContainerInterface } from "../interfaces/testing/module-testing-container.interface";
import { HashTestingUtil } from "./hash-testing-util";
import { TestingCreator } from "./testing-creator";

export class TestingContainer implements ModuleTestingContainerInterface {
	private readonly hashTestingUtil = new HashTestingUtil();
	private readonly container = new Container(this.hashTestingUtil);
	private readonly moduleTestingCreator = new TestingCreator();
	private _moduleContainer: ModuleContainerInterface | null = null;
	private _module: Module | null = null;

	private constructor(private readonly metatype: ModuleMetadata) {}

	static createTestingContainer(metatype: ModuleMetadata) {
		return new TestingContainer(metatype);
	}

	async addModule(metatype: Module): Promise<ModuleContainerInterface> {
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
	): Promise<ModuleContainerInterface | null> {
		return this.container.replaceModule(metatypeToReplace, newMetatype);
	}

	get<T>(token: InjectionToken): Promise<T | undefined> {
		return this.container.get<T>(token);
	}

	async compile(): Promise<ModuleContainerInterface> {
		this._module = this.moduleTestingCreator.create(this.metatype);
		this._moduleContainer = await this.container.addModule(this._module);

		await this.container.run(this._moduleContainer.metatype as Module);
		return this._moduleContainer;
	}

	get module() {
		return this._module;
	}

	get moduleContainer() {
		return this._moduleContainer;
	}

	get graph(): ModuleGraphInterface {
		return this.container.graph;
	}
}
