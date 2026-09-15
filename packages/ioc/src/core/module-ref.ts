import type {
	ContainerInterface,
	GraphSegment,
	InjectionToken,
	Type,
} from "../interfaces";
import { isDynamicModule } from "../utils/helpers";

export interface ModuleRefGetOptions {
	/**
	 * `true` (default): only tokens the module can see — its own providers and
	 * providers exported to it by its imports or by global modules.
	 * `false`: any token in the container.
	 */
	strict?: boolean;
}

/**
 * Handle to a lazily loaded module. Providers physically live in the
 * application's single container; `get()` only scopes what is visible.
 */
export class ModuleRef {
	constructor(
		private readonly container: ContainerInterface,
		private readonly segment: GraphSegment,
	) {}

	public get name(): string {
		return this.segment.lazyModule.name;
	}

	public get module(): Type {
		const metatype = this.segment.moduleContainer.metatype;
		return isDynamicModule(metatype) ? metatype.module : metatype;
	}

	public async get<T>(
		token: InjectionToken,
		options: ModuleRefGetOptions = {},
	): Promise<T | undefined> {
		const strict = options.strict ?? true;

		if (
			strict &&
			!(await this.container.graph.isProviderExported(
				this.segment.moduleContainer,
				token,
			))
		) {
			return undefined;
		}

		return this.container.get<T>(token);
	}
}
