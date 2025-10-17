import {
	type Edge,
	EdgeTypeEnum,
	type GraphError,
	type InjectionToken,
	MODULE_TOKEN_WATERMARK,
	MODULE_WATERMARK,
	type Module,
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
import {
	getDependencyToken,
	getProviderToken,
	isModule,
} from "../../utils/helpers";
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

/**
 * Helper function to safely convert InjectionToken to string for error messages
 */
function tokenToString(token: InjectionToken): string {
	return typeof token === "function" ? token.name : String(token);
}

/**
 * Type guard to check if a node is an AnalyzeProvider
 */
function isProviderNode(
	entry: [InjectionToken, Node],
): entry is [InjectionToken, AnalyzeProvider] {
	return entry[1].type === NodeTypeEnum.PROVIDER;
}

export class ModuleGraph implements ModuleGraphInterface {
	private _nodes: Map<InjectionToken, Node> = new Map();
	private _edges: Map<InjectionToken, Edge[]> = new Map();
	private _globalModules: Map<InjectionToken, ModuleContainerInterface> =
		new Map();
	private readonly _errors: GraphError[] = [];

	constructor(private readonly _root: ModuleContainerInterface) {}

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

	public getNode(token: InjectionToken): Node | undefined {
		return this._nodes.get(token);
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

			imports.push(...(await analyzeModule.imports));
			visited.add(analyzeModule.id);
		}
	}

	private async addModule(analyzeModule: AnalyzeModule) {
		this.addNode(analyzeModule.id, analyzeModule);

		if (analyzeModule.isGlobal) {
			this._globalModules.set(analyzeModule.id, analyzeModule.moduleContainer);
		}
	}

	private async addModuleImports(analyzeModule: AnalyzeModule) {
		const imports = await analyzeModule.edges;

		for (const importEdge of imports) {
			this.addEdge(analyzeModule.id, importEdge);
		}
	}

	private async addModuleProviders(analyzeModule: AnalyzeModule) {
		for (const provider of analyzeModule.providers) {
			const analyzeProvider = ProviderFactory(
				provider,
				analyzeModule.moduleContainer,
			);

			if (analyzeProvider === null) {
				continue;
			}

			this.addNode(analyzeProvider.id, analyzeProvider);
			this.addEdge(analyzeModule.id, analyzeProvider.edge);
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
		const providerNodes = [...this.nodes].filter(isProviderNode);

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
					dependency: tokenToString(dependencyToken),
					position: dependency.index,
				});
			}

			const newEdge: Edge = {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					index: dependency.index,
					inject: "constructor",
				},
			};

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
					dependency: tokenToString(dependencyToken),
					key: dependency.key,
				});
			}

			const newEdge: Edge = {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					key: dependency.key,
					inject: "property",
				},
			};

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
					dependency: tokenToString(dependencyToken),
					position: dependency.index,
				});
			}

			const newEdge: Edge = {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					index: dependency.index,
					inject: "constructor",
				},
			};

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
					dependency: tokenToString(dependencyToken),
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
					dependency: tokenToString(dependency),
					key: index,
				});
			}

			const factoryDependency: Edge = {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependency,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					index: index++,
					inject: "constructor",
				},
			};

			this.addEdge(token, factoryDependency);
		}
	}
	// providers dependencies

	private async isProviderExported(
		moduleContainer: ModuleContainerInterface,
		dependencyToken: InjectionToken,
	): Promise<boolean> {
		// check globals
		for (const globalModule of this._globalModules.values()) {
			if (
				globalModule.exports.some((provider) => provider === dependencyToken)
			) {
				return true;
			}
		}
		// check globals

		// check internals
		if (
			moduleContainer.providers.some(
				(provider) => getProviderToken(provider) === dependencyToken,
			)
		) {
			return true;
		}

		// externals
		const containerImports = await moduleContainer.imports;
		const visitedModules = new Set<InjectionToken | Module>();
		const queue = containerImports.flatMap(
			(firstLevelContainer) => firstLevelContainer.exports,
		);

		while (queue.length) {
			const currentExportToken = queue.shift();

			if (!currentExportToken || visitedModules.has(currentExportToken)) {
				continue;
			}

			if (currentExportToken === dependencyToken) {
				return true;
			}

			if (
				isModule(currentExportToken) &&
				Reflect.hasMetadata(MODULE_WATERMARK, currentExportToken)
			) {
				const token = Reflect.getMetadata(
					MODULE_TOKEN_WATERMARK,
					currentExportToken,
				);
				if (typeof token === "string") {
					const moduleContainer = this.getNode(token);

					if (moduleContainer && moduleContainer.type === NodeTypeEnum.MODULE) {
						queue.push(...(moduleContainer as AnalyzeModule).exports);
					}
				}
			}

			visitedModules.add(currentExportToken);
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
								path: cyclePath
									.map((token) => this.getNode(token))
									.filter((node): node is Node => node !== undefined)
									.map((node) => node.label),
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
