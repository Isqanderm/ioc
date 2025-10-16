import type {
	ContainerInterface,
	DynamicModule,
	HashUtilInterface,
	InjectionToken,
	Module,
	ModuleContainerInterface,
	ModuleGraphInterface,
	NexusApplicationInterface,
} from "../../interfaces";
import { ModuleGraph } from "../graph/module-graph";
import { Resolver } from "../resolver/resolver";
import { ModulesContainer } from "./modules-container";

export class Container implements ContainerInterface {
	private readonly modulesContainer = new ModulesContainer(
		this.hashUtils,
		this,
	);

	private _graph: ModuleGraphInterface | null = null;
	private moduleGraphResolver: Resolver | null = null;

	constructor(private readonly hashUtils: HashUtilInterface) {}

	public async addModule(
		module: Module | DynamicModule,
	): Promise<ModuleContainerInterface> {
		return await this.modulesContainer.addModule(module);
	}

	public async replaceModule(
		moduleToReplace: Module,
		newModule: Module,
	): Promise<ModuleContainerInterface> {
		return await this.modulesContainer.replaceModule(
			moduleToReplace,
			newModule,
		);
	}

	public async getModule(
		module: Module,
	): Promise<ModuleContainerInterface | undefined> {
		return this.modulesContainer.getModule(module);
	}

	public async get<T>(token: InjectionToken): Promise<T | undefined> {
		return this.moduleGraphResolver?.resolveProvider<T>(token);
	}

	public async run(rootModule: Module): Promise<void> {
		const root = await this.modulesContainer.addModule(rootModule);

		this._graph = new ModuleGraph(root);

		this.moduleGraphResolver = new Resolver(this._graph);

		await this._graph.compile();
	}

	public get graph() {
		return this._graph as ModuleGraphInterface;
	}

	public get errors() {
		return this.graph.errors;
	}
}
