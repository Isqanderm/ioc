import {
	type ContainerBaseInterface,
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
import { ProvidersContainer } from "./providers-container";

export class Resolver {
	private readonly providersContainer = new ProvidersContainer();

	constructor(private readonly graph: ModuleGraphInterface) {}

	public async resolveProvider<T>(
		token: InjectionToken,
		injectProperty = true,
	): Promise<T | undefined> {
		if (this.providersContainer.has(token)) {
			return this.providersContainer.get(token);
		}

		const node = this.graph.getNode(token);

		if (!node) {
			throw new Error(`Provider not found: ${token.toString()}`);
		}

		const [instance, saveInCache] = await this.createInstance(
			node,
			injectProperty,
		);

		if (saveInCache) {
			this.providersContainer.set(token, instance);
		}

		return instance as T;
	}

	private async createInstance(
		node: Node,
		injectProperty: boolean,
	): Promise<[Type, boolean]> {
		const provider = node.metatype as Provider;
		const dependencies = this.graph
			.getEdge(node.id)
			.filter(
				(edge) =>
					edge.type === EdgeTypeEnum.DEPENDENCY &&
					edge.metadata.inject === "constructor" &&
					edge.metadata.unreached === false &&
					edge.metadata.isCircular === false,
			)
			.map((edge) => edge.target);

		const resolvedDependencies = await Promise.all(
			dependencies.map((depToken) => {
				return this.resolveProvider(depToken);
			}),
		);

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		let instance: any;
		let saveInCache = true;

		if (isClassProvider(provider)) {
			instance = new provider.useClass(...resolvedDependencies);

			if (injectProperty) {
				await this.injectPropertyDependencies(instance, node);
			}

			if (provider.scope === Scope.Request) {
				saveInCache = false;
			}
		} else if (isValueProvider(provider)) {
			instance = provider.useValue;
		} else if (isFactoryProvider(provider)) {
			instance = await provider.useFactory(...resolvedDependencies);
		} else {
			instance = new (provider as Type)(...resolvedDependencies);

			if (injectProperty) {
				await this.injectPropertyDependencies(instance, node);
			}
		}

		instance?.onModuleInit?.();

		return [instance, saveInCache];
	}

	private async injectPropertyDependencies(instance: Type, node: Node) {
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
			instance[edge.metadata.key as string] = await this.resolveProvider(
				edge.target,
			);
		}
	}
}
