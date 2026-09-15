import {
	EdgeTypeEnum,
	type InjectionToken,
	type ModuleGraphInterface,
	type Node,
	type Provider,
	Scope,
	type Type,
} from "../../interfaces";
import {
	isClassProvider,
	isFactoryProvider,
	isValueProvider,
} from "../../utils/helpers";
import type { AnalyzeProvider } from "../graph/analyze-provider";
import { ProvidersContainer } from "./providers-container";

// Type & { dependencyName: InjectionToken }
type CircularDependencyFn = () => typeof Proxy;
function isCircularDependencyFn(
	fn: CircularDependencyFn | InjectionToken,
): fn is CircularDependencyFn {
	// @ts-expect-error
	return !!(typeof fn === "function" && fn.dependencyName);
}

export class Resolver {
	private readonly providersContainer = new ProvidersContainer();
	private readonly initializationOrder: InjectionToken[] = [];

	constructor(private readonly graph: ModuleGraphInterface) {}

	public async close(): Promise<void> {
		for (const token of [...this.initializationOrder].reverse()) {
			const instance = this.providersContainer.get(token);
			if (instance?.onModuleDestroy) {
				await instance.onModuleDestroy();
			}
		}
		this.providersContainer.clear();
		this.initializationOrder.length = 0;
	}

	public async resolveProvider<T>(
		token: InjectionToken,
		resolveCache: ProvidersContainer = new ProvidersContainer(),
		isCircularDependency = false,
	): Promise<T | undefined> {
		const node = this.graph.getNode(token);

		if (!node) {
			return undefined;
		}

		// Get the scope of the provider
		const scope = (node as AnalyzeProvider).scope;

		// For Transient scope, always create a new instance (no caching at all)
		if (scope === Scope.Transient) {
			const [instance] = await this.createInstance(
				node,
				resolveCache,
				isCircularDependency,
			);
			return instance as T;
		}

		// For Singleton scope, check global cache first
		if (scope === Scope.Singleton && this.providersContainer.has(token)) {
			return this.providersContainer.get(token);
		}

		// For Request and Singleton scopes, check resolve cache (within current resolution tree)
		if (resolveCache.has(token)) {
			return resolveCache.get(token);
		}

		const [instance, saveInCache] = await this.createInstance(
			node,
			resolveCache,
			isCircularDependency,
		);

		// Add to resolve cache for current resolution context (for Request and Singleton)
		// This ensures same instance is used within a single dependency resolution tree
		if (scope === Scope.Singleton || scope === Scope.Scoped) {
			resolveCache.set(token, instance);
		}

		// Only save to global cache for Singleton scope
		if (saveInCache) {
			this.providersContainer.set(token, instance);
			this.initializationOrder.push(token);
		}

		return instance as T;
	}

	private async createInstance(
		node: Node,
		resolveCache: ProvidersContainer,
		isCircularDependency = false,
	): Promise<[Type, boolean]> {
		const provider = node.metatype as Provider;
		const dependencyEdges = this.graph
			.getEdge(node.id)
			.filter(
				(edge) =>
					edge.type === EdgeTypeEnum.DEPENDENCY &&
					edge.metadata.inject === "constructor" &&
					edge.metadata.unreached === false,
			);

		const resolvedDependencies: (CircularDependencyFn | unknown)[] = [];
		for (const edge of dependencyEdges) {
			if (edge.metadata.isCircular) {
				if (isCircularDependency) {
					const circularResolver = () =>
						new Proxy(
							{},
							{
								get: (_, prop) => {
									const instance = resolveCache.get(edge.target);
									return instance?.[prop];
								},
							},
						);
					(
						circularResolver as unknown as {
							dependencyName: InjectionToken;
						}
					).dependencyName = edge.target;
					resolvedDependencies.push(circularResolver as CircularDependencyFn);
					continue;
				}
				resolvedDependencies.push(
					await this.resolveProvider(edge.target, resolveCache, true),
				);
				continue;
			}
			resolvedDependencies.push(
				await this.resolveProvider(edge.target, resolveCache),
			);
		}

		const deps = resolvedDependencies.map((dep) =>
			isCircularDependencyFn(dep as InjectionToken | CircularDependencyFn)
				? (dep as CircularDependencyFn)()
				: dep,
		);

		// biome-ignore lint/suspicious/noExplicitAny: instance creation
		let instance: any;
		let saveInCache = true;
		const scope = (node as AnalyzeProvider).scope;

		if (isClassProvider(provider)) {
			instance = new provider.useClass(...deps);
			await this.injectPropertyDependencies(instance, node, resolveCache);
			saveInCache = scope === Scope.Singleton;
		} else if (isValueProvider(provider)) {
			instance = provider.useValue;
			saveInCache = true;
		} else if (isFactoryProvider(provider)) {
			instance = await provider.useFactory(...deps);
			saveInCache = scope === Scope.Singleton;
		} else {
			instance = new (provider as Type)(...deps);
			await this.injectPropertyDependencies(instance, node, resolveCache);
			saveInCache = scope === Scope.Singleton;
		}

		if (instance?.onModuleInit) {
			try {
				await instance.onModuleInit();
			} catch (error) {
				const providerName =
					typeof provider === "function"
						? provider.name
						: ((provider as { provide?: InjectionToken }).provide?.toString() ??
							"Unknown");
				const errorMessage = `Failed to initialize provider "${providerName}": ${error instanceof Error ? error.message : String(error)}`;
				const wrappedError = new Error(errorMessage);
				if (error instanceof Error && error.stack) {
					wrappedError.stack = `${wrappedError.stack}\nCaused by: ${error.stack}`;
				}
				throw wrappedError;
			}
		}

		return [instance, saveInCache];
	}

	private async injectPropertyDependencies(
		instance: Type,
		node: Node,
		resolveCache: ProvidersContainer,
	) {
		const dependencies = this.graph
			.getEdge(node.id)
			.filter(
				(edge) =>
					edge.type === EdgeTypeEnum.DEPENDENCY &&
					edge.metadata.inject === "property" &&
					edge.metadata.unreached === false &&
					edge.metadata.isCircular === false,
			);

		for (const edge of dependencies) {
			(instance as unknown as Record<string, unknown>)[
				edge.metadata.key as string
			] = await this.resolveProvider(edge.target, resolveCache);
		}
	}
}
