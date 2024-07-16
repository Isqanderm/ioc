import type {
	ContainerBaseInterface,
	ContainerInterface,
	DynamicModule,
	GraphPluginInterface,
	HashUtilInterface,
	InjectionToken,
	Module,
	ModuleContainerInterface,
	ModuleGraphInterface,
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
	private _parent?: ContainerBaseInterface;

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

	async run(
		rootModule: Module,
		graphPlugins: GraphPluginInterface[],
	): Promise<void> {
		const root = await this.modulesContainer.addModule(rootModule);

		// TODO: fix types
		// @ts-ignore
		this._graph = new ModuleGraph(root, graphPlugins, this._parent?.graph);

		this.moduleGraphResolver = new Resolver(this._graph);

		await this._graph.compile();
	}

	get graph() {
		return this._graph as ModuleGraphInterface;
	}

	parent(parentContainer: ContainerBaseInterface): this {
		this._parent = parentContainer;
		return this;
	}
}
