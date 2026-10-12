import {
	AsyncProviderInjectionError,
	CircularInjectionError,
} from "../../errors/injection-errors";
import { ProviderNotFoundError } from "../../errors/provider-errors";
import {
	type Edge,
	EdgeTypeEnum,
	type ModuleGraphInterface,
	type Node,
	NodeTypeEnum,
	type Provider,
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
import {
	type InjectionContext,
	type InjectOptions,
	withInjectionContext,
} from "../injection/injection-context";
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

function isThenable(value: unknown): value is PromiseLike<unknown> {
	return (
		value !== null &&
		(typeof value === "object" || typeof value === "function") &&
		typeof (value as { then?: unknown }).then === "function"
	);
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
			return (await this.createInstance(node, ctx, isCircularDependency)) as T;
		}

		// For Singleton scope, check global cache first
		if (scope === Scope.Singleton && this.providersContainer.has(token)) {
			return this.providersContainer.get(token);
		}

		// For Request and Singleton scopes, check resolve cache (within current resolution tree)
		if (ctx.cache.has(token)) {
			return ctx.cache.get(token);
		}

		const instance = await this.createInstance(node, ctx, isCircularDependency);
		this.commitInstance(node, instance, ctx);
		return instance as T;
	}

	/**
	 * Caching rules shared by the async and sync paths: Singleton and Scoped
	 * go into the resolution-tree cache; Singletons (and value providers) go
	 * into the global cache and the destroy order. Transient is never cached.
	 */
	private commitInstance(
		node: AnalyzeProvider,
		instance: unknown,
		ctx: ResolutionContext,
	): void {
		const scope = node.scope;
		if (scope === Scope.Transient) {
			return;
		}
		ctx.cache.set(node.id, instance);
		if (
			(scope === Scope.Singleton || isValueProvider(node.metatype)) &&
			!this.providersContainer.has(node.id)
		) {
			this.providersContainer.set(node.id, instance);
			this.initializationOrder.push(node.id);
		}
	}

	/** Undoes commitInstance for `instance`, if it is still the cached one. */
	private evictInstance(
		node: AnalyzeProvider,
		instance: unknown,
		ctx: ResolutionContext,
	): void {
		const token = node.id;
		if (ctx.cache.has(token) && ctx.cache.get(token) === instance) {
			ctx.cache.delete(token);
		}
		if (
			this.providersContainer.has(token) &&
			this.providersContainer.get(token) === instance
		) {
			this.providersContainer.delete(token);
			const index = this.initializationOrder.lastIndexOf(token);
			if (index !== -1) {
				this.initializationOrder.splice(index, 1);
			}
		}
	}

	private async createInstance(
		node: AnalyzeProvider,
		ctx: ResolutionContext,
		isCircularDependency = false,
	): Promise<unknown> {
		ctx.enter(node.id);
		try {
			return await this.createInstanceInContext(
				node,
				ctx,
				isCircularDependency,
			);
		} finally {
			ctx.leave(node.id);
		}
	}

	private async createInstanceInContext(
		node: AnalyzeProvider,
		ctx: ResolutionContext,
		isCircularDependency: boolean,
	): Promise<unknown> {
		const provider = node.metatype;
		const dependencyEdges = this.constructorEdges(node).filter(
			(edge) => edge.metadata.unreached === false,
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
		const injectionContext = this.contextFor(node, ctx);

		if (isClassProvider(provider)) {
			instance = withInjectionContext(
				injectionContext,
				() => new provider.useClass(...deps),
			);
			await this.injectPropertyDependencies(instance, node, ctx);
		} else if (isValueProvider(provider)) {
			instance = provider.useValue;
		} else if (isFactoryProvider(provider)) {
			instance = await withInjectionContext(injectionContext, () =>
				provider.useFactory(...deps),
			);
		} else {
			instance = withInjectionContext(
				injectionContext,
				() => new (provider as Type)(...deps),
			);
			await this.injectPropertyDependencies(instance, node, ctx);
		}

		// onModuleInit of providers created via inject() must finish before
		// this instance's own onModuleInit runs.
		await ctx.drainPendingInits();

		if (instance?.onModuleInit) {
			try {
				await instance.onModuleInit();
			} catch (error) {
				throw this.wrapInitError(provider, error);
			}
		}

		return instance;
	}

	/**
	 * inject() entry point: resolves `token` synchronously for `requester`.
	 * The token must be visible from the requester's module, the same rule
	 * as `@Inject`.
	 */
	public resolveSync(
		token: ProviderToken,
		ctx: ResolutionContext,
		requester: AnalyzeProvider,
		options: InjectOptions,
	): unknown {
		const node = this.graph.getNode(token);
		const visible =
			node?.type === NodeTypeEnum.PROVIDER &&
			this.graph.isProviderVisible(requester.moduleContainer, token);
		if (!visible) {
			if (options.optional) {
				return undefined;
			}
			throw new ProviderNotFoundError(token, requester.id);
		}
		return this.resolveProviderSync(node as AnalyzeProvider, ctx);
	}

	/**
	 * Synchronous counterpart of resolveProvider for a provider node whose
	 * reachability was already established (visibility check or graph edge).
	 */
	private resolveProviderSync(
		node: AnalyzeProvider,
		ctx: ResolutionContext,
	): unknown {
		const token = node.id;
		if (ctx.isConstructing(token)) {
			throw new CircularInjectionError([...ctx.path, token]);
		}
		if (node.scope === Scope.Singleton && this.providersContainer.has(token)) {
			return this.providersContainer.get(token);
		}
		if (node.scope !== Scope.Transient && ctx.cache.has(token)) {
			return ctx.cache.get(token);
		}
		return this.createInstanceSync(node, ctx);
	}

	/** Resolves a static @Inject edge on the synchronous path. */
	private resolveEdgeSync(edge: Edge, ctx: ResolutionContext): unknown {
		if (edge.metadata.isCircular) {
			throw new CircularInjectionError([...ctx.path, edge.target]);
		}
		// Unreached edges resolve to undefined, as on the async path. Reached
		// edges were checked by the graph, so there is no second visibility
		// check; a missing (@Optional) node resolves to undefined.
		if (edge.metadata.unreached) {
			return undefined;
		}
		const target = this.graph.getNode(edge.target);
		if (!target || target.type !== NodeTypeEnum.PROVIDER) {
			return undefined;
		}
		return this.resolveProviderSync(target, ctx);
	}

	/**
	 * Synchronous mirror of createInstance + resolveProvider caching, used
	 * when inject() reaches a provider that does not exist yet.
	 */
	private createInstanceSync(
		node: AnalyzeProvider,
		ctx: ResolutionContext,
	): unknown {
		ctx.enter(node.id);
		try {
			const provider = node.metatype;
			const deps = this.constructorEdges(node).map((edge) =>
				this.resolveEdgeSync(edge, ctx),
			);
			const injectionContext = this.contextFor(node, ctx);

			// biome-ignore lint/suspicious/noExplicitAny: instance creation
			let instance: any;
			if (isValueProvider(provider)) {
				instance = provider.useValue;
			} else if (isFactoryProvider(provider)) {
				const result = withInjectionContext(injectionContext, () =>
					provider.useFactory(...deps),
				);
				if (isThenable(result)) {
					// Never leave the abandoned promise rejecting unhandled.
					result.then(undefined, () => {});
					throw new AsyncProviderInjectionError(node.id);
				}
				instance = result;
			} else {
				const Class = isClassProvider(provider)
					? provider.useClass
					: (provider as Type);
				instance = withInjectionContext(
					injectionContext,
					() => new Class(...deps),
				);
				this.injectPropertyDependenciesSync(instance, node, ctx);
			}

			// onModuleInit is not part of creation: it runs with no injection
			// context, so inject() there throws InjectionContextError.
			const runInit = () =>
				withInjectionContext(null, () => this.callInitSync(provider, instance));
			let pendingInit: Promise<unknown> | undefined;
			if (instance?.onModuleInit) {
				// Every init queued so far belongs to an instance this one may
				// have received (created here or a cache hit on one still
				// initializing), so wait for all of them. This cannot deadlock:
				// each deferred init only waits on inits queued before it.
				const earlier = [...ctx.pendingInits];
				pendingInit =
					earlier.length > 0 ? Promise.all(earlier).then(runInit) : runInit();
			}

			this.commitInstance(node, instance, ctx);
			if (pendingInit) {
				// A failed async init must not leave a broken cached instance.
				ctx.addPendingInit(
					pendingInit.catch((error) => {
						this.evictInstance(node, instance, ctx);
						throw error;
					}),
				);
			}
			return instance;
		} finally {
			ctx.leave(node.id);
		}
	}

	/**
	 * Calls onModuleInit synchronously. A synchronous throw is wrapped and
	 * rethrown; an async result is returned with its rejection wrapped.
	 */
	private callInitSync(
		provider: Provider,
		instance: { onModuleInit: () => unknown },
	): Promise<unknown> | undefined {
		let result: unknown;
		try {
			result = instance.onModuleInit();
		} catch (error) {
			throw this.wrapInitError(provider, error);
		}
		if (isThenable(result)) {
			return Promise.resolve(result).catch((error) => {
				throw this.wrapInitError(provider, error);
			});
		}
		return undefined;
	}

	private wrapInitError(provider: Provider, error: unknown): Error {
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
		return wrappedError;
	}

	private contextFor(
		node: AnalyzeProvider,
		ctx: ResolutionContext,
	): InjectionContext {
		return {
			inject: (token, options) => this.resolveSync(token, ctx, node, options),
		};
	}

	private constructorEdges(node: Node): Edge[] {
		return this.graph
			.getEdge(node.id)
			.filter(
				(edge) =>
					edge.type === EdgeTypeEnum.DEPENDENCY &&
					edge.metadata.inject === "constructor",
			);
	}

	private propertyEdges(node: Node): Edge[] {
		return this.graph
			.getEdge(node.id)
			.filter(
				(edge) =>
					edge.type === EdgeTypeEnum.DEPENDENCY &&
					edge.metadata.inject === "property" &&
					edge.metadata.unreached === false &&
					edge.metadata.isCircular === false,
			);
	}

	private injectPropertyDependenciesSync(
		instance: Type,
		node: Node,
		ctx: ResolutionContext,
	): void {
		for (const edge of this.propertyEdges(node)) {
			(instance as unknown as Record<string, unknown>)[
				edge.metadata.key as string
			] = this.resolveEdgeSync(edge, ctx);
		}
	}

	private async injectPropertyDependencies(
		instance: Type,
		node: Node,
		ctx: ResolutionContext,
	) {
		for (const edge of this.propertyEdges(node)) {
			(instance as unknown as Record<string, unknown>)[
				edge.metadata.key as string
			] = await this.resolveProvider(edge.target, ctx);
		}
	}
}
