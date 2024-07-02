import {
	type ClassProvider,
	type Edge,
	EdgeTypeEnum,
	type FactoryProvider,
	type InjectionToken,
	type ModuleContainerInterface,
	type ModuleGraphInterface,
	type Node,
	NodeTypeEnum,
	PROPERTY_DEPS_METADATA,
	type Provider,
	SELF_DECLARED_DEPS_METADATA,
	type Type,
} from "../../interfaces";
import {
	getDependencyToken,
	getProviderScope,
	getProviderToken,
	isClassProvider,
	isDynamicModule,
	isFactoryProvider,
	isGlobalModule,
} from "../../utils/helpers";

export class ModuleGraph implements ModuleGraphInterface {
	private _nodes: Map<InjectionToken, Node> = new Map();
	private _edges: Map<InjectionToken, Edge[]> = new Map();
	private _globalModules: Map<InjectionToken, ModuleContainerInterface> =
		new Map();

	constructor(private readonly _root: ModuleContainerInterface) {}

	public get nodes() {
		return this._nodes;
	}

	public get edges() {
		return this._edges;
	}

	public async compile() {
		const visited = new Set<InjectionToken>();
		const imports = [this._root];

		while (imports.length) {
			const importModule = imports.shift();

			if (!importModule) {
				continue;
			}

			if (visited.has(importModule.token)) {
				continue;
			}

			await this.addModule(importModule);

			const moduleImports = await importModule.imports;

			imports.push(...moduleImports);

			visited.add(importModule.token);
		}

		await this.addDependencies();
		await this.detectCircularDependencies();
		await this.detectCircularImports();
	}

	public getNode(token: InjectionToken): Node {
		return this._nodes.get(token) as Node;
	}

	public getEdge(token: InjectionToken) {
		return this._edges.get(token) || [];
	}

	getAllEdges(): Edge[][] {
		return [...this._edges.values()];
	}

	getAllNodes(): Node[] {
		return [...this._nodes.values()];
	}

	private addEdge(token: InjectionToken, edge: Edge) {
		const edges: Edge[] = this._edges.get(token) || [];

		edges.push(edge);

		this._edges.set(token, edges);
	}

	private addNode(token: InjectionToken, node: Node) {
		this._nodes.set(token, node);
	}

	private async addModule(module: ModuleContainerInterface) {
		const isDynamic = isDynamicModule(module.metatype);
		const metatype = isDynamicModule(module.metatype)
			? module.metatype.module
			: module.metatype;

		const isGlobal = isGlobalModule(metatype);

		this.addNode(module.token, {
			type: NodeTypeEnum.MODULE,
			id: module.token,
			label: metatype.name,
			metatype: metatype,
			moduleContainer: module,
			isGlobal,
			isDynamic,
		});

		if (isGlobal) {
			this._globalModules.set(module.token, module);
		}

		const imports = await module.imports;
		const providers: Provider[] = [...module.providers];

		for (const imp of imports) {
			this.addEdge(module.token, {
				type: EdgeTypeEnum.IMPORT,
				source: imp.token,
				target: module.token,
				metadata: {
					isCircular: false,
				},
			});
		}

		for (const provider of providers) {
			const token = getProviderToken(provider);
			const providerLabel = typeof token === "function" ? token.name : token;

			this.addNode(getProviderToken(provider), {
				type: NodeTypeEnum.PROVIDER,
				id: getProviderToken(provider),
				label: providerLabel.toString(),
				metatype: provider,
				moduleContainer: module,
				scope: getProviderScope(provider),
			});

			this.addEdge(module.token, {
				type: EdgeTypeEnum.PROVIDER,
				source: getProviderToken(provider),
				target: module.token,
				metadata: {
					unreached: false,
					isCircular: false,
				},
			});
		}
	}

	private async addDependencies() {
		const providers = [...this.nodes].filter(
			([_, node]) => node.type === NodeTypeEnum.PROVIDER,
		);
		const visited = new Set<InjectionToken>();

		for (const [token, node] of providers) {
			if (visited.has(token)) {
				continue;
			}

			if (isFactoryProvider(node.metatype as Provider)) {
				await this.addFactoryProviderDependency(token, node);
			}
			if (isClassProvider(node.metatype as Provider)) {
				await this.addClassProviderDependency(token, node);
			} else {
				await this.addClassDependency(token, node);
			}

			visited.add(token);
		}
	}

	private async addClassDependency(token: InjectionToken, node: Node) {
		const constructorDependencies = this.getConstructorDependencies(
			node.metatype as Provider,
		);

		for (const dependency of constructorDependencies) {
			const dependencyToken = getDependencyToken(dependency.param);
			const isExported = await this.isProviderExported(
				node.moduleContainer,
				dependencyToken,
			);

			this.addEdge(token, {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					index: dependency.index,
					inject: "constructor",
					lazy: dependency.lazy || false,
				},
			});
		}

		const propertiesDependencies = this.getPropertiesDependencies(
			node.metatype as Provider,
		);

		for (const dependency of propertiesDependencies) {
			const dependencyToken = getDependencyToken(dependency.type);
			const isExported = await this.isProviderExported(
				node.moduleContainer,
				dependencyToken,
			);

			this.addEdge(token, {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					key: dependency.key,
					inject: "property",
					lazy: dependency.lazy || false,
				},
			});
		}
	}

	private async addClassProviderDependency(token: InjectionToken, node: Node) {
		const Class = (node.metatype as ClassProvider).useClass;
		const constructorDependencies = this.getConstructorDependencies(Class);

		for (const dependency of constructorDependencies) {
			const dependencyToken = getDependencyToken(dependency.param);
			const isExported = await this.isProviderExported(
				node.moduleContainer,
				dependencyToken,
			);

			this.addEdge(token, {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					index: dependency.index,
					inject: "constructor",
					lazy: dependency.lazy || false,
				},
			});
		}

		const propertiesDependencies = this.getPropertiesDependencies(Class);

		for (const dependency of propertiesDependencies) {
			const dependencyToken = getDependencyToken(dependency.type);
			const isExported = await this.isProviderExported(
				node.moduleContainer,
				dependencyToken,
			);

			this.addEdge(token, {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					key: dependency.key,
					inject: "property",
					lazy: dependency.lazy || false,
				},
			});
		}
	}

	private async addFactoryProviderDependency(
		token: InjectionToken,
		node: Node,
	) {
		const dependencies = (node.metatype as FactoryProvider).inject || [];
		let index = 0;

		for (const dependency of dependencies) {
			const isExported = await this.isProviderExported(
				node.moduleContainer,
				dependency,
			);

			this.addEdge(token, {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependency,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					index: index++,
					inject: "constructor",
					lazy: false,
				},
			});
		}
	}

	private async isProviderExported(
		moduleContainer: ModuleContainerInterface,
		dependencyToken: InjectionToken,
	): Promise<boolean> {
		for (const globalModule of this._globalModules.values()) {
			if (
				globalModule.exports.some((provider) => provider === dependencyToken)
			) {
				return true;
			}
		}

		if (
			moduleContainer.providers.some(
				(provider) => getProviderToken(provider) === dependencyToken,
			)
		) {
			return true;
		}

		const visitedModules = new Set<ModuleContainerInterface>();
		const queue = [moduleContainer];

		while (queue.length) {
			const currentModule = queue.shift();

			if (!currentModule) {
				continue;
			}

			if (visitedModules.has(currentModule)) {
				continue;
			}

			visitedModules.add(currentModule);

			if (
				currentModule.exports.some((provider) => provider === dependencyToken)
			) {
				return true;
			}

			queue.push(...(await currentModule.imports));
		}

		return false;
	}

	private async detectCircularDependencies(): Promise<void> {
		const visit = (
			nodeId: InjectionToken,
			path: InjectionToken[],
			visited: Set<InjectionToken>,
			stack: Set<InjectionToken>,
		): boolean => {
			if (stack.has(nodeId)) {
				const cyclePath: [InjectionToken, InjectionToken][] = path.map(
					(node, index) => [node, path[index + 1] || nodeId],
				);

				// Помечаем ребра как круговые
				for (const [from, to] of cyclePath) {
					const edges = this._edges.get(from);
					if (edges) {
						const edge = edges.find((e) => e.target === to);
						if (edge) {
							edge.metadata.isCircular = true;
						}
					}
				}
				return true;
			}

			if (visited.has(nodeId)) {
				return false;
			}

			visited.add(nodeId);
			stack.add(nodeId);
			path.push(nodeId);

			const edges = this.getEdge(nodeId) || [];
			for (const edge of edges) {
				visit(edge.target, path, visited, stack);
			}

			stack.delete(nodeId);
			path.pop();
			return false;
		};

		const providers = [...this._nodes].filter(
			([_, node]) => node.type === NodeTypeEnum.PROVIDER,
		);

		for (const [nodeId, _] of providers) {
			visit(nodeId, [], new Set<InjectionToken>(), new Set<InjectionToken>());
		}
	}

	private async detectCircularImports(): Promise<void> {
		const visit = (
			nodeId: InjectionToken,
			path: InjectionToken[],
			visited: Set<InjectionToken>,
			stack: Set<InjectionToken>,
		): void => {
			if (stack.has(nodeId)) {
				const cycleStartIndex = path.indexOf(nodeId);
				const cyclePath = path.slice(cycleStartIndex);

				for (let i = 0; i < cyclePath.length; i++) {
					const from = cyclePath[i];
					const to = cyclePath[(i + 1) % cyclePath.length];
					const edges = this._edges.get(from);
					if (edges) {
						const edge = edges.find((e) => e.source === to);
						if (edge && edge.type === EdgeTypeEnum.IMPORT) {
							edge.metadata.isCircular = true;
						}
					}
				}
				return;
			}

			if (visited.has(nodeId)) {
				return;
			}

			visited.add(nodeId);
			stack.add(nodeId);
			path.push(nodeId);

			const edges = this.getEdge(nodeId) || [];
			for (const edge of edges) {
				if (edge.type === EdgeTypeEnum.IMPORT) {
					visit(edge.source, path, visited, stack);
				}
			}

			stack.delete(nodeId);
			path.pop();
		};

		const modules = [...this._nodes].filter(
			([_, node]) => node.type === NodeTypeEnum.MODULE,
		);

		for (const [nodeId, _] of modules) {
			visit(nodeId, [], new Set<InjectionToken>(), new Set<InjectionToken>());
		}
	}

	private getConstructorDependencies(
		provider: Provider,
	): { index: number; lazy: boolean; param: Type<unknown> }[] {
		return (
			Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, provider) || []
		).sort((a, b) => a.index - b.index);
	}

	private getPropertiesDependencies(
		provider: Provider,
	): { key: string; lazy: boolean; type: Type<unknown> }[] {
		return Reflect.getMetadata(PROPERTY_DEPS_METADATA, provider) || [];
	}
}
