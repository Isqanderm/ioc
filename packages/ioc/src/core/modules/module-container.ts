import "reflect-metadata";
import type {
	ContainerBaseInterface,
	DynamicModule,
	InjectionToken,
	Module,
	ModuleContainerInterface,
	Provider,
} from "../../interfaces";
import { MODULE_METADATA } from "../../interfaces";
import { isDynamicModule } from "../../utils/helpers";

export class ModuleContainer implements ModuleContainerInterface {
	private _token = "";

	constructor(
		private readonly _metatype: Module | DynamicModule,
		private readonly container: ContainerBaseInterface,
	) {}

	get token(): string {
		return this._token;
	}

	set token(value: string) {
		this._token = value;
	}

	get metatype() {
		return this._metatype;
	}

	get imports(): Promise<ModuleContainerInterface[]> {
		let modules: (Module | DynamicModule)[];
		if (isDynamicModule(this.metatype)) {
			modules = this.metatype.imports || [];
		} else {
			modules =
				Reflect.getMetadata(MODULE_METADATA.IMPORTS, this.metatype) || [];
		}

		const self = this;
		return new Promise<ModuleContainerInterface[]>((resolved) => {
			async function run() {
				const imports = await Promise.all(
					modules.map((item: Module | DynamicModule) => {
						return self.container.addModule(item);
					}),
				);

				resolved(imports);
			}

			// @ts-ignore
			run();
		});
	}

	get providers(): Provider[] {
		if (isDynamicModule(this.metatype)) {
			return this.metatype.providers || [];
		}

		return Reflect.getMetadata(MODULE_METADATA.PROVIDERS, this.metatype) || [];
	}

	get exports(): InjectionToken[] {
		if (isDynamicModule(this.metatype)) {
			return this.metatype.exports || [];
		}

		return Reflect.getMetadata(MODULE_METADATA.EXPORTS, this.metatype) || [];
	}

	get<T>(token: InjectionToken): Promise<T | undefined> {
		return this.container.get(token);
	}
}
