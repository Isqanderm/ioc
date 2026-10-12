import { CircularInjectionError } from "../../errors/injection-errors";
import {
	AsyncFactoryError,
	ProviderNotFoundError,
} from "../../errors/provider-errors";
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
	/**
	 * Singletons created by inject() whose onModuleInit (or the wait on
	 * inits queued before them) has not settled yet. Other resolution trees
	 * that hit such a cached singleton wait on this promise, so they never
	 * see it half-initialised or keep it after a failed init evicted it.
	 */
	private readonly inFlightInits = new Map<ProviderToken, Promise<unknown>>();

	constructor(private readonly graph: ModuleGraphInterface) {}

	/** Cached singleton lookup; never creates. Uses has() so falsy values count. */
	public getInstantiated(
		token: ProviderToken,
	): { found: true; instance: unknown } | { found: false } {
		// A singleton inject() created is cached before its async init settles;
		// like the async path, it counts as instantiated only after the init.
		if (!this.providersContainer.has(token) || this.inFlightInits.has(token)) {
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
		this.inFlightInits.clear();
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
		for (const token of dead) {
			this.inFlightInits.delete(token);
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
			const cached = this.providersContainer.get(token);
			const inFlight = this.inFlightInits.get(token);
			if (inFlight) {
				// Created by inject() in another tree; its init is still running.
				// On failure it was evicted, so the error propagates.
				await inFlight;
			}
			return cached;
		}

		// Check the resolve cache for singletons created earlier in this tree (within current resolution tree)
		if (ctx.cache.has(token)) {
			return ctx.cache.get(token);
		}

		const instance = await this.createInstance(node, ctx, isCircularDependency);
		this.commitInstance(node, instance, ctx);
		return instance as T;
	}

	/**
	 * Caching rules shared by the async and sync paths: Singletons go into the
	 * resolution-tree cache (cycle and identity handling within the tree), the
	 * global cache and the destroy order. Transient is never cached.
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
		// First writer wins if concurrent creations race for the same token.
		if (!this.providersContainer.has(node.id)) {
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
			instance = this.callFactory(node, provider, deps, injectionContext);
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
		const instance = this.resolveProviderSync(node as AnalyzeProvider, ctx);
		// Idempotent; covers cached and freshly created instances alike.
		this.graph.addRuntimeDependency(requester.id, (node as AnalyzeProvider).id);
		return instance;
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
			const inFlight = this.inFlightInits.get(token);
			if (inFlight) {
				// The requester's own init and eviction chain wait on it.
				ctx.addPendingInit(inFlight);
			}
			return this.providersContainer.get(token);
		}
		if (ctx.cache.has(token)) {
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
				instance = this.callFactory(node, provider, deps, injectionContext);
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
			// Conservatively wait on every init queued before this instance (it
			// may hold some of those instances, created here or via cache hits),
			// even without its own onModuleInit, so a failure there evicts this
			// instance too. No deadlock: each entry only waits on earlier ones.
			const earlier = [...ctx.pendingInits];
			let pendingInit: Promise<unknown> | undefined;
			if (earlier.length > 0) {
				const afterEarlier = Promise.all(earlier);
				pendingInit = instance?.onModuleInit
					? afterEarlier.then(runInit)
					: afterEarlier;
			} else if (instance?.onModuleInit) {
				pendingInit = runInit();
			}

			this.commitInstance(node, instance, ctx);
			if (pendingInit) {
				// A failed init (own or earlier) must not leave a broken cached
				// instance. The eviction is chained here, not in a drain, so it
				// also happens when the requester's constructor throws later.
				const settled = pendingInit.catch((error) => {
					this.evictInstance(node, instance, ctx);
					throw error;
				});
				ctx.addPendingInit(settled);
				this.trackInFlightInit(node.id, instance, settled);
			}
			return instance;
		} finally {
			ctx.leave(node.id);
		}
	}

	/** Runs a factory; factories must be synchronous. */
	private callFactory(
		node: AnalyzeProvider,
		provider: Extract<Provider, { useFactory: unknown }>,
		deps: unknown[],
		injectionContext: InjectionContext,
	): unknown {
		const result = withInjectionContext(injectionContext, () =>
			provider.useFactory(...deps),
		);
		if (isThenable(result)) {
			// Never leave the rejected promise unhandled.
			result.then(undefined, () => {});
			throw new AsyncFactoryError(node.id);
		}
		return result;
	}

	/** Registers `init` as the in-flight init of a just-committed singleton. */
	private trackInFlightInit(
		token: ProviderToken,
		instance: unknown,
		init: Promise<unknown>,
	): void {
		if (
			!this.providersContainer.has(token) ||
			this.providersContainer.get(token) !== instance
		) {
			return; // not the global singleton (lost a race)
		}
		this.inFlightInits.set(token, init);
		const clear = () => {
			if (this.inFlightInits.get(token) === init) {
				this.inFlightInits.delete(token);
			}
		};
		init.then(clear, clear);
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
		const wrappedError: Error & { cause?: unknown } = new Error(errorMessage);
		// Assigned rather than passed as ErrorOptions: the build targets ES2021.
		wrappedError.cause = error;
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
