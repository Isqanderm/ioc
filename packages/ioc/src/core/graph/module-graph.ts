import {
	type ClassProvider,
	type Edge,
	EdgeTypeEnum,
	type GraphError,
	type InjectionToken,
	type ModuleContainerInterface,
	type ModuleGraphInterface,
	type Node,
	NodeTypeEnum,
	PROPERTY_DEPS_METADATA,
	PROPERTY_OPTIONAL_DEPS_METADATA,
	type Provider,
	SELF_DECLARED_DEPS_METADATA,
	SELF_DECLARED_OPTIONAL_DEPS_METADATA,
	type Type,
} from "../../interfaces";
import type { GraphPluginInterface } from "../../interfaces/plugins";
import { getDependencyToken, getProviderToken } from "../../utils/helpers";
import { AnalyzeModule } from "./analyze-module";
import type { AnalyzeProvider } from "./analyze-provider";
import {
	isAnalyzeClassProvider,
	isAnalyzeFactoryProvider,
	isAnalyzeFunctionProvider,
} from "./helpers";
import type { AnalyzeClassProvider } from "./providers/analyze-class-provider";
import type { AnalyzeFactoryProvider } from "./providers/analyze-factory-provider";
import type { AnalyzeFunctionProvider } from "./providers/analyze-function-provider";
import { ProviderFactory } from "./providers/provider-factory";

export class ModuleGraph implements ModuleGraphInterface {
	private _nodes: Map<InjectionToken, Node> = new Map();
	private _edges: Map<InjectionToken, Edge[]> = new Map();
	private _globalModules: Map<InjectionToken, ModuleContainerInterface> =
		new Map();
	private readonly _errors: GraphError[] = [];

	constructor(
		private readonly _root: ModuleContainerInterface,
		private readonly plugins: GraphPluginInterface[] = [],
	) {}

	public get nodes() {
		return this._nodes;
	}

	public get edges() {
		return this._edges;
	}

	public get errors() {
		return this._errors;
	}

	public async compile() {
		await this.addModules();
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

	public getAllEdges(): Edge[][] {
		return [...this._edges.values()];
	}

	public getAllNodes(): Node[] {
		return [...this._nodes.values()];
	}

	// modules analyze
	private async addModules() {
		const visited = new Set<InjectionToken>();
		const imports = [this._root];

		while (imports.length) {
			const importModule = imports.shift();

			if (!importModule || visited.has(importModule.token)) {
				continue;
			}

			const analyzeModule = new AnalyzeModule(importModule);

			await this.addModule(analyzeModule);
			await this.addModuleImports(analyzeModule);
			await this.addModuleProviders(analyzeModule);
			await this.modulePlugins(analyzeModule);

			imports.push(...(await analyzeModule.imports));
			visited.add(analyzeModule.id);
		}
	}

	private async addModule(analyzeModule: AnalyzeModule) {
		const newNode = this.plugins.reduce<AnalyzeModule>((node, next) => {
			return next.onAddModuleNode?.(node) || node;
		}, analyzeModule);

		this.addNode(analyzeModule.id, newNode);

		if (analyzeModule.isGlobal) {
			this._globalModules.set(analyzeModule.id, analyzeModule.moduleContainer);
		}
	}

	private async addModuleImports(analyzeModule: AnalyzeModule) {
		const imports = await analyzeModule.edges;

		for (const importEdge of imports) {
			const newEdge = this.plugins.reduce<Edge>((prev, plugin) => {
				return plugin.onAddModuleImportEdge?.(prev) || prev;
			}, importEdge);

			this.addEdge(analyzeModule.id, newEdge);
		}
	}

	private async addModuleProviders(analyzeModule: AnalyzeModule) {
		for (const provider of analyzeModule.providers) {
			const analyzeProvider = ProviderFactory(
				provider,
				analyzeModule.moduleContainer,
			);

			if (analyzeProvider === null) {
				throw Error("Incompatibility Provider");
			}

			const providerNode = this.plugins.reduce<AnalyzeProvider>(
				(node, plugin) => {
					return plugin.onAddProviderNode?.(node) || node;
				},
				analyzeProvider,
			);

			this.addNode(analyzeProvider.id, providerNode);

			const providerEdge = this.plugins.reduce((edge, plugin) => {
				return plugin.onAddProviderEdge?.(edge) || edge;
			}, analyzeProvider.edge);

			this.addEdge(analyzeModule.id, providerEdge);
		}
	}

	private async modulePlugins(analyzeModule: AnalyzeModule) {
		for (const plugin of this.plugins) {
			plugin.parseModule?.(analyzeModule.moduleContainer, {
				addNode: this.addNode,
				addEdge: this.addEdge,
				getEdge: this.getEdge,
				getNode: this.getNode,
			});
		}
	}
	// modules analyze

	// graph helpers
	private addEdge(token: InjectionToken, edge: Edge) {
		const edges: Edge[] = this._edges.get(token) || [];

		edges.push(edge);

		this._edges.set(token, edges);
	}

	private addNode(token: InjectionToken, node: Node) {
		this._nodes.set(token, node);
	}
	// graph helpers

	// providers dependencies
	private async addDependencies() {
		const visited = new Set<InjectionToken>();
		const providerNodes = [...this.nodes].filter(
			([_, node]) => node.type === NodeTypeEnum.PROVIDER,
		) as [InjectionToken, AnalyzeProvider][];

		for (const [token, node] of providerNodes) {
			if (visited.has(token)) {
				continue;
			}

			if (isAnalyzeFactoryProvider(node)) {
				await this.addFactoryProviderDependency(token, node);
			} else if (isAnalyzeClassProvider(node)) {
				await this.addClassProviderDependency(token, node);
			} else if (isAnalyzeFunctionProvider(node)) {
				await this.addClassDependency(token, node);
			}

			visited.add(token);
		}
	}

	private async addClassDependency(
		token: InjectionToken,
		node: AnalyzeFunctionProvider,
	) {
		const constructorDependencies = this.getConstructorDependencies(
			node.metatype,
		);
		const optionalDependency = this.getOptionalConstructorDependencies(
			node.metatype,
		);

		for (const [index, dependency] of constructorDependencies.entries()) {
			const dependencyToken = getDependencyToken(dependency.param);
			const isExported =
				optionalDependency.includes(index) ||
				(await this.isProviderExported(node.moduleContainer, dependencyToken));

			if (!isExported) {
				this.errors.push({
					type: "UNREACHED_DEP_CONSTRUCTOR",
					token: node.label,
					dependency:
						typeof dependencyToken === "function"
							? dependencyToken.name
							: (dependencyToken as string),
					position: dependency.index,
				});
			}

			const newEdge = this.plugins.reduce<Edge>(
				(edge, plugin) => {
					return plugin.onAddClassDependency?.(edge) || edge;
				},
				{
					type: EdgeTypeEnum.DEPENDENCY,
					source: token,
					target: dependencyToken,
					metadata: {
						unreached: !isExported,
						isCircular: false,
						index: dependency.index,
						inject: "constructor",
					},
				},
			);

			this.addEdge(token, newEdge);
		}

		const propertiesDependencies = this.getPropertiesDependencies(
			node.metatype,
		);
		const optionalProperties = this.getOptionalPropertyDependencies(
			node.metatype,
		);

		for (const dependency of propertiesDependencies) {
			const dependencyToken = getDependencyToken(dependency.type);
			const isExported =
				optionalProperties.includes(dependency.key) ||
				(await this.isProviderExported(node.moduleContainer, dependencyToken));

			if (!isExported) {
				this.errors.push({
					type: "UNREACHED_DEP_PROPERTY",
					token: node.label,
					dependency:
						typeof dependencyToken === "function"
							? dependencyToken.name
							: (dependencyToken as string),
					key: dependency.key,
				});
			}

			const newEdge = this.plugins.reduce<Edge>(
				(edge, plugin) => {
					return plugin.onAddClassDependency?.(edge) || edge;
				},
				{
					type: EdgeTypeEnum.DEPENDENCY,
					source: token,
					target: dependencyToken,
					metadata: {
						unreached: !isExported,
						isCircular: false,
						key: dependency.key,
						inject: "property",
					},
				},
			);

			this.addEdge(token, newEdge);
		}
	}

	private async addClassProviderDependency(
		token: InjectionToken,
		node: AnalyzeClassProvider,
	) {
		const Class = node.useClass;
		const constructorDependencies = this.getConstructorDependencies(Class);
		const optionalDependency = this.getOptionalConstructorDependencies(Class);

		for (const [index, dependency] of constructorDependencies.entries()) {
			const dependencyToken = getDependencyToken(dependency.param);
			const isExported =
				optionalDependency.includes(index) ||
				(await this.isProviderExported(node.moduleContainer, dependencyToken));

			if (!isExported) {
				this.errors.push({
					type: "UNREACHED_DEP_CONSTRUCTOR",
					token: node.label,
					dependency:
						typeof dependencyToken === "function"
							? dependencyToken.name
							: (dependencyToken as string),
					position: dependency.index,
				});
			}

			const newEdge = this.plugins.reduce<Edge>(
				(edge, plugin) => {
					return plugin.onAddUseClassDependency?.(edge) || edge;
				},
				{
					type: EdgeTypeEnum.DEPENDENCY,
					source: token,
					target: dependencyToken,
					metadata: {
						unreached: !isExported,
						isCircular: false,
						index: dependency.index,
						inject: "constructor",
					},
				},
			);

			this.addEdge(token, newEdge);
		}

		const propertiesDependencies = this.getPropertiesDependencies(Class);
		const optionalProperty = this.getOptionalPropertyDependencies(Class);

		for (const dependency of propertiesDependencies) {
			const dependencyToken = getDependencyToken(dependency.type);
			const isExported =
				optionalProperty.includes(dependency.key) ||
				(await this.isProviderExported(node.moduleContainer, dependencyToken));

			if (!isExported) {
				this.errors.push({
					type: "UNREACHED_DEP_PROPERTY",
					token: node.label,
					dependency:
						typeof dependencyToken === "function"
							? dependencyToken.name
							: (dependencyToken as string),
					key: dependency.key,
				});
			}

			this.addEdge(token, {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					key: dependency.key,
					inject: "property",
				},
			});
		}
	}

	private async addFactoryProviderDependency(
		token: InjectionToken,
		node: AnalyzeFactoryProvider,
	) {
		const dependencies = node.inject || [];
		let index = 0;

		for (const dependency of dependencies) {
			const isExported = await this.isProviderExported(
				node.moduleContainer,
				dependency,
			);

			if (!isExported) {
				this.errors.push({
					type: "UNREACHED_DEP_FACTORY",
					token: node.label,
					dependency:
						typeof dependency === "function"
							? dependency.name
							: (dependency as string),
					key: index,
				});
			}

			const factoryDependency = this.plugins.reduce<Edge>(
				(dep, plugin) => {
					return plugin?.onAddUseFactoryDependency?.(dep) || dep;
				},
				{
					type: EdgeTypeEnum.DEPENDENCY,
					source: token,
					target: dependency,
					metadata: {
						unreached: !isExported,
						isCircular: false,
						index: index++,
						inject: "constructor",
					},
				},
			);

			this.addEdge(token, factoryDependency);
		}
	}
	// providers dependencies

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

				const from = cyclePath[0];
				const to = cyclePath[cyclePath.length - 1];

				if (from[0] === to[1]) {
					const edges = this._edges.get(nodeId);

					for (const [from, to] of cyclePath) {
						const edges = this._edges.get(from);
						if (edges) {
							const edge = edges.find((e) => e.target === to);
							if (edge) {
								edge.metadata.isCircular = true;
							}
						}
					}

					this.errors.push({
						type: "CD_PROVIDERS",
						path: cyclePath,
					});
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
					const to = cyclePath[cyclePath.length - 1];
					const edges = this._edges.get(from);
					if (edges) {
						const edge = edges.find((e) => e.source === to);

						if (edge && edge.type === EdgeTypeEnum.IMPORT) {
							this.errors.push({
								type: "CD_IMPORTS",
								path: cyclePath.map((token) => this.getNode(token).label),
							});
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
		provider: Type,
	): { index: number; param: Type<unknown> }[] {
		return (
			Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, provider) || []
		).sort((a, b) => a.index - b.index);
	}

	private getOptionalConstructorDependencies(provider: Provider): number[] {
		return (
			Reflect.getMetadata(SELF_DECLARED_OPTIONAL_DEPS_METADATA, provider) || []
		).map(({ index }) => index);
	}

	private getOptionalPropertyDependencies(provider: Provider): string[] {
		return (
			Reflect.getMetadata(PROPERTY_OPTIONAL_DEPS_METADATA, provider) || []
		).map(({ key }) => key);
	}

	private getPropertiesDependencies(
		provider: Provider,
	): { key: string; type: Type<unknown> }[] {
		return Reflect.getMetadata(PROPERTY_DEPS_METADATA, provider) || [];
	}
}
