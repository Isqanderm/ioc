import {
	EdgeTypeEnum,
	type InjectionToken,
	type ModuleGraphInterface,
	type Node,
	type Provider,
	Scope,
	type Type,
} from "../../interfaces";
import { isClassProvider, isFactoryProvider, isValueProvider } from "../../utils/helpers";
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

	constructor(private readonly graph: ModuleGraphInterface) {}

	public async resolveProvider<T>(
		token: InjectionToken,
		resolveCache: ProvidersContainer = new ProvidersContainer(),
		isCircularDependency = false,
	): Promise<T | undefined> {
		if (this.providersContainer.has(token)) {
			return this.providersContainer.get(token);
		}

		const node = this.graph.getNode(token);

		if (!node) {
			return undefined;
		}

		if (resolveCache.has(token)) {
			return resolveCache.get(token);
		}

		const [instance, saveInCache] = await this.createInstance(
			node,
			resolveCache,
			isCircularDependency,
		);

		resolveCache.set(token, instance);

		if (saveInCache) {
			this.providersContainer.set(token, instance);
		}

		return instance as T;
	}

	private async createInstance(
		node: Node,
		resolveCache: ProvidersContainer,
		isCircularDependency = false,
	): Promise<[Type, boolean]> {
		const provider = node.metatype as Provider;
		const dependencies = this.graph
			.getEdge(node.id)
			.filter(
				(edge) =>
					edge.type === EdgeTypeEnum.DEPENDENCY &&
					edge.metadata.inject === "constructor" &&
					edge.metadata.unreached === false,
			)
			.map<InjectionToken | CircularDependencyFn>((edge) => {
				if (edge.metadata.isCircular) {
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

					circularResolver.dependencyName = edge.target;

					return circularResolver;
				}

				return edge.target;
			});

		const depsChunks = dependencies.reduce<
			[(CircularDependencyFn | null)[], (InjectionToken | null)[]]
		>(
			(prev, depToken) => {
				if (isCircularDependencyFn(depToken)) {
					prev[0].push(depToken as CircularDependencyFn);
					prev[1].push(null);

					return prev;
				}

				prev[0].push(null);
				prev[1].push(depToken);

				return prev;
			},
			[[], []],
		);

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		let resolvedDependencies: any[] = [];

		for (const depToken of dependencies) {
			if (isCircularDependencyFn(depToken)) {
				// @ts-ignore
				if (isCircularDependency) {
					resolvedDependencies.push(depToken);
					continue;
				}

				const instance = await this.resolveProvider(
					// @ts-ignore
					depToken.dependencyName,
					resolveCache,
					true,
				);

				resolvedDependencies.push(instance);
				continue;
			}

			const instance = await this.resolveProvider(depToken, resolveCache);

			this.providersContainer.set(depToken, instance);

			resolvedDependencies.push(instance);
		}

		resolvedDependencies = resolvedDependencies.map<InjectionToken | CircularDependencyFn>(
			(dependency, index) => {
				if (depsChunks[0]?.[index]) {
					return depsChunks[0]?.[index] as CircularDependencyFn;
				}

				return dependency as InjectionToken;
			},
		);

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		let instance: any;
		let saveInCache = true;

		const deps = resolvedDependencies.map((depToken) =>
			isCircularDependencyFn(depToken) ? depToken() : depToken,
		);

		if (isClassProvider(provider)) {
			instance = new provider.useClass(...deps);

			await this.injectPropertyDependencies(instance, node, resolveCache);

			if ((node as AnalyzeProvider).scope === Scope.Request) {
				saveInCache = false;
			}
		} else if (isValueProvider(provider)) {
			instance = provider.useValue;
		} else if (isFactoryProvider(provider)) {
			instance = await provider.useFactory(...deps);
		} else {
			instance = new (provider as Type)(...deps);

			await this.injectPropertyDependencies(instance, node, resolveCache);
		}

		instance?.onModuleInit?.();

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
			instance[edge.metadata.key as string] = await this.resolveProvider(edge.target, resolveCache);
		}
	}
}
