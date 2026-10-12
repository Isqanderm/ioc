import "reflect-metadata";
import { ProviderNotFoundError } from "../../errors";
import type {
	ContainerBaseInterface,
	DynamicModule,
	GetOptions,
	LazyModule,
	ModuleContainerInterface,
	Provider,
	ProviderToken,
	Type,
} from "../../interfaces";
import { MODULE_METADATA } from "../../interfaces";
import { isDynamicModule } from "../../utils/helpers";
import { isLazyModule } from "../../utils/lazy-module";

export class ModuleContainer implements ModuleContainerInterface {
	private _token = "";

	constructor(
		private readonly _metatype: Type | DynamicModule,
		private readonly container: ContainerBaseInterface,
	) {}

	public get token(): string {
		return this._token;
	}

	public set token(value: string) {
		this._token = value;
	}

	public get metatype() {
		return this._metatype;
	}

	private get declaredImports(): (Type | DynamicModule | LazyModule)[] {
		if (isDynamicModule(this.metatype)) {
			return this.metatype.imports || [];
		}
		return Reflect.getMetadata(MODULE_METADATA.IMPORTS, this.metatype) || [];
	}

	private _resolvedImports: ModuleContainerInterface[] | undefined;

	public get resolvedImports(): ModuleContainerInterface[] | undefined {
		return this._resolvedImports;
	}

	public get imports(): Promise<ModuleContainerInterface[]> {
		const modules = this.declaredImports.filter(
			(item): item is Type | DynamicModule => !isLazyModule(item),
		);

		const self = this;
		return new Promise<ModuleContainerInterface[]>((resolved) => {
			async function run() {
				const imports = await Promise.all(
					modules.map((item) => self.container.addModule(item)),
				);
				self._resolvedImports = imports;
				resolved(imports);
			}
			run();
		});
	}

	public get lazyImports(): LazyModule[] {
		return this.declaredImports.filter(isLazyModule);
	}

	/**
	 * Children declared by the module class's `@Module` decorator. A dynamic
	 * module literal cannot declare children, but one built from a class that
	 * declares them (`forX()`, extra child providers) keeps them.
	 */
	public get children(): readonly (Type | LazyModule)[] {
		const target = isDynamicModule(this.metatype)
			? this.metatype.module
			: this.metatype;
		return Reflect.getMetadata(MODULE_METADATA.CHILDREN, target) || [];
	}

	public get providers(): Provider[] {
		if (isDynamicModule(this.metatype)) {
			return this.metatype.providers || [];
		}

		return Reflect.getMetadata(MODULE_METADATA.PROVIDERS, this.metatype) || [];
	}

	public get exports(): ProviderToken[] {
		if (isDynamicModule(this.metatype)) {
			return this.metatype.exports || [];
		}

		return Reflect.getMetadata(MODULE_METADATA.EXPORTS, this.metatype) || [];
	}

	/**
	 * Synchronously returns an already-created singleton, with the same
	 * contract as `Test.get()`.
	 *
	 * @throws {ProviderNotFoundError} If no provider has this token (unless optional)
	 * @throws {ProviderScopeError} If the provider is Transient; use resolve()
	 * @throws {ProviderNotInstantiatedError} If the singleton is not created yet; use resolve()
	 */
	public get<T>(token: ProviderToken<T>): T;
	public get<T>(
		token: ProviderToken<T>,
		options: { optional: true },
	): T | undefined;
	public get<T>(token: ProviderToken<T>, options: { optional?: false }): T;
	public get<T>(token: ProviderToken<T>, options: GetOptions): T | undefined;
	public get<T>(
		token: ProviderToken<T>,
		options: GetOptions = {},
	): T | undefined {
		if (!this.container.hasProvider(token)) {
			if (options.optional) {
				return undefined;
			}
			throw new ProviderNotFoundError(token);
		}
		return this.container.get<T>(token);
	}

	/**
	 * Resolves a provider asynchronously, creating it according to its scope.
	 *
	 * @throws {ProviderNotFoundError} If no provider has this token (unless optional)
	 */
	public resolve<T>(token: ProviderToken<T>): Promise<T>;
	public resolve<T>(
		token: ProviderToken<T>,
		options: { optional: true },
	): Promise<T | undefined>;
	public resolve<T>(
		token: ProviderToken<T>,
		options: { optional?: false },
	): Promise<T>;
	public resolve<T>(
		token: ProviderToken<T>,
		options: GetOptions,
	): Promise<T | undefined>;
	public async resolve<T>(
		token: ProviderToken<T>,
		options: GetOptions = {},
	): Promise<T | undefined> {
		if (!this.container.hasProvider(token)) {
			if (options.optional) {
				return undefined;
			}
			throw new ProviderNotFoundError(token);
		}
		return this.container.resolve<T>(token);
	}

	public get errors() {
		return this.container.errors;
	}
}
