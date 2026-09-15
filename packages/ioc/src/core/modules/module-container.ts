import "reflect-metadata";
import type {
	ContainerBaseInterface,
	DynamicModule,
	InjectionToken,
	LazyModule,
	ModuleContainerInterface,
	Provider,
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
				resolved(imports);
			}
			run();
		});
	}

	public get lazyImports(): LazyModule[] {
		return this.declaredImports.filter(isLazyModule);
	}

	public get providers(): Provider[] {
		if (isDynamicModule(this.metatype)) {
			return this.metatype.providers || [];
		}

		return Reflect.getMetadata(MODULE_METADATA.PROVIDERS, this.metatype) || [];
	}

	public get exports(): InjectionToken[] {
		if (isDynamicModule(this.metatype)) {
			return this.metatype.exports || [];
		}

		return Reflect.getMetadata(MODULE_METADATA.EXPORTS, this.metatype) || [];
	}

	public get<T>(token: InjectionToken): Promise<T | undefined> {
		return this.container.get(token);
	}

	public get errors() {
		return this.container.errors;
	}
}
