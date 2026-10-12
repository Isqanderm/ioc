import {
	EdgeTypeEnum,
	type ModuleGraphInterface,
	type Node,
	NodeTypeEnum,
	type ProviderToken,
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
import { ResolutionContext } from "./resolution-context";

// Type & { dependencyName: ProviderToken }
type CircularDependencyFn = () => typeof Proxy;
function isCircularDependencyFn(
	fn: CircularDependencyFn | ProviderToken,
): fn is CircularDependencyFn {
	// @ts-expect-error
	return !!(typeof fn === "function" && fn.dependencyName);
}

export class Resolver {
	private readonly providersContainer = new ProvidersContainer();
	private readonly initializationOrder: ProviderToken[] = [];

	constructor(private readonly graph: ModuleGraphInterface) {}

	/** Cached singleton lookup; never creates. Uses has() so falsy values count. */
	public getInstantiated(
		token: ProviderToken,
	): { found: true; instance: unknown } | { found: false } {
		if (!this.providersContainer.has(token)) {
			return { found: false };
		}
		return { found: true, instance: this.providersContainer.get(token) };
	}

	public async close(): Promise<void> {
		const errors: unknown[] = [];
		for (const token of [...this.initializationOrder].reverse()) {
			const instance = this.providersContainer.get(token);
			if (instance?.onModuleDestroy) {
				try {
					await instance.onModuleDestroy();
				} catch (error) {
					errors.push(error);
				}
			}
		}
		this.providersContainer.clear();
		this.initializationOrder.length = 0;
		if (errors.length > 0) {
			throw new AggregateError(
				errors,
				"One or more onModuleDestroy hooks failed",
			);
		}
	}

	/**
	 * Destroys exactly the given singletons: `onModuleDestroy` in reverse
	 * initialization order, then removed from the cache and from
	 * `initializationOrder`. A token that was never instantiated (never
	 * resolved, or `Transient`/non-singleton scope) is silently skipped.
	 */
	public async destroy(tokens: ProviderToken[]): Promise<void> {
		const dead = new Set(tokens);
		const orderedDead = this.initializationOrder.filter((token) =>
			dead.has(token),
		);

		for (const token of [...orderedDead].reverse()) {
			const instance = this.providersContainer.get(token);
			if (instance?.onModuleDestroy) {
				await instance.onModuleDestroy();
			}
			this.providersContainer.delete(token);
		}

		const survivors = this.initializationOrder.filter(
			(token) => !dead.has(token),
		);
		this.initializationOrder.length = 0;
		this.initializationOrder.push(...survivors);
	}

	public async resolveProvider<T>(
		token: ProviderToken,
		ctx: ResolutionContext = new ResolutionContext(),
		isCircularDependency = false,
	): Promise<T | undefined> {
		const node = this.graph.getNode(token);

		if (!node) {
			return undefined;
		}

		// Module and LAZY placeholder nodes share the token space with providers
		// but carry no instance, so they resolve to undefined instead of failing.
		if (node.type !== NodeTypeEnum.PROVIDER) {
			return undefined;
		}

		// Get the scope of the provider
		const scope = node.scope;

		// For Transient scope, always create a new instance (no caching at all)
		if (scope === Scope.Transient) {
			const [instance] = await this.createInstance(
				node,
				ctx,
				isCircularDependency,
			);
			return instance as T;
		}

		// For Singleton scope, check global cache first
		if (scope === Scope.Singleton && this.providersContainer.has(token)) {
			return this.providersContainer.get(token);
		}

		// For Request and Singleton scopes, check resolve cache (within current resolution tree)
		if (ctx.cache.has(token)) {
			return ctx.cache.get(token);
		}

		const [instance, saveInCache] = await this.createInstance(
			node,
			ctx,
			isCircularDependency,
		);

		// Add to resolve cache for current resolution context (for Request and Singleton)
		// This ensures same instance is used within a single dependency resolution tree
		if (scope === Scope.Singleton || scope === Scope.Scoped) {
			ctx.cache.set(token, instance);
		}

		// Only save to global cache for Singleton scope
		if (saveInCache) {
			this.providersContainer.set(token, instance);
			this.initializationOrder.push(token);
		}

		return instance as T;
	}

	private async createInstance(
		node: AnalyzeProvider,
		ctx: ResolutionContext,
		isCircularDependency = false,
	): Promise<[Type, boolean]> {
		const provider = node.metatype;
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
									const instance = ctx.cache.get(edge.target);
									return instance?.[prop];
								},
							},
						);
					(
						circularResolver as unknown as {
							dependencyName: ProviderToken;
						}
					).dependencyName = edge.target;
					resolvedDependencies.push(circularResolver as CircularDependencyFn);
					continue;
				}
				resolvedDependencies.push(
					await this.resolveProvider(edge.target, ctx, true),
				);
				continue;
			}
			resolvedDependencies.push(await this.resolveProvider(edge.target, ctx));
		}

		const deps = resolvedDependencies.map((dep) =>
			isCircularDependencyFn(dep as ProviderToken | CircularDependencyFn)
				? (dep as CircularDependencyFn)()
				: dep,
		);

		// biome-ignore lint/suspicious/noExplicitAny: instance creation
		let instance: any;
		let saveInCache = true;
		const scope = node.scope;

		if (isClassProvider(provider)) {
			instance = new provider.useClass(...deps);
			await this.injectPropertyDependencies(instance, node, ctx);
			saveInCache = scope === Scope.Singleton;
		} else if (isValueProvider(provider)) {
			instance = provider.useValue;
			saveInCache = true;
		} else if (isFactoryProvider(provider)) {
			instance = await provider.useFactory(...deps);
			saveInCache = scope === Scope.Singleton;
		} else {
			instance = new (provider as Type)(...deps);
			await this.injectPropertyDependencies(instance, node, ctx);
			saveInCache = scope === Scope.Singleton;
		}

		if (instance?.onModuleInit) {
			try {
				await instance.onModuleInit();
			} catch (error) {
				const providerName =
					typeof provider === "function"
						? provider.name
						: ((provider as { provide?: ProviderToken }).provide?.toString() ??
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
		ctx: ResolutionContext,
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
			] = await this.resolveProvider(edge.target, ctx);
		}
	}
}
