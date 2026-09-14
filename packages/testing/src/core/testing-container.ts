import {
	type DynamicModule,
	type GraphError,
	type InjectionToken,
	type ModuleContainerInterface,
	Module as ModuleDecorator,
	type ModuleMetadata,
	type ScannerPluginInterface,
	type Type,
} from "@nexus-ioc/core";
import { Container } from "@nexus-ioc/core/internal";
import { ContainerNotCompiledError } from "@nexus-ioc/shared";
import type { ModuleTestingContainerInterface } from "../interfaces";
import { HashTestingUtil } from "./hash-testing-util";
import { TestingCreator } from "./testing-creator";

export class Test<T extends ModuleMetadata = ModuleMetadata>
	implements ModuleTestingContainerInterface<T>
{
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private readonly hashTestingUtil = new HashTestingUtil();
	private readonly container = new Container(this.hashTestingUtil);
	private readonly moduleTestingCreator = new TestingCreator<T>();
	private _moduleContainer: ModuleContainerInterface | null = null;
	private _moduleDecorator: <D extends T>(metadata: D) => ClassDecorator =
		ModuleDecorator;
	private _module: Type | null = null;
	private containerCompiled = false;

	private constructor(private readonly metatype: T) {}

	public static createModule<M extends ModuleMetadata = ModuleMetadata>(
		metatype: M,
	): Test<M> {
		return new Test<M>(metatype);
	}

	public async addModule(
		metatype: Type | DynamicModule,
	): Promise<ModuleContainerInterface> {
		return this.container.addModule(metatype);
	}

	public async getModule(
		metatype: Type,
	): Promise<ModuleContainerInterface | undefined> {
		return this.container.getModule(metatype);
	}

	public async replaceModule(
		metatypeToReplace: Type,
		newMetatype: Type,
	): Promise<ModuleContainerInterface> {
		return this.container.replaceModule(metatypeToReplace, newMetatype);
	}

	public get<T>(token: InjectionToken): Promise<T | undefined> {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this.container.get<T>(token);
	}

	public async compile(): Promise<ModuleContainerInterface> {
		this._module = this.moduleTestingCreator.create(
			this.metatype,
			this._moduleDecorator,
		);
		this._moduleContainer = await this.container.addModule(this._module);

		await this.container.run(this._moduleContainer.metatype as Type);

		this.containerCompiled = true;

		for (const scannerPlugin of this.scannerPlugins) {
			await scannerPlugin.scan(this.container.graph);
		}

		return this._moduleContainer;
	}

	public get module() {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this._module;
	}

	public get moduleContainer() {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this._moduleContainer;
	}

	addScannerPlugin(
		scanner: ScannerPluginInterface | ScannerPluginInterface[],
	): this {
		const plugins = Array.isArray(scanner) ? scanner : [scanner];
		this.scannerPlugins.push(...plugins);
		return this;
	}

	public setModuleDecorator(decorator: (metadata: T) => ClassDecorator): this {
		this._moduleDecorator = decorator;
		return this;
	}

	public get errors() {
		if (!this.containerCompiled) {
			throw new ContainerNotCompiledError();
		}

		return this._moduleContainer?.errors as GraphError[];
	}
}
