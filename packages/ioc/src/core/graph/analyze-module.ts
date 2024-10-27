import {
	EdgeTypeEnum,
	type ModuleContainerInterface,
	NodeTypeEnum,
} from "../../interfaces";
import { isDynamicModule, isGlobalModule } from "../../utils/helpers";

export class AnalyzeModule {
	private readonly _isDynamic = isDynamicModule(this._module.metatype);
	private readonly _metatype = isDynamicModule(this._module.metatype)
		? this._module.metatype.module
		: this._module.metatype;
	private readonly _token = this._module.token;
	private readonly _label = this._metatype.name;

	constructor(private readonly _module: ModuleContainerInterface) {}

	public get type(): NodeTypeEnum.MODULE {
		return NodeTypeEnum.MODULE;
	}

	public get id() {
		return this._token;
	}

	public get label() {
		return this._label.toString();
	}

	public get moduleContainer() {
		return this._module;
	}

	public get metatype() {
		return this._metatype;
	}

	public get isDynamic() {
		return this._isDynamic;
	}

	public get node() {
		return {
			type: this.type,
			id: this.id,
			label: this.label,
			metatype: this.metatype,
			moduleContainer: this.moduleContainer,
			isGlobal: this.isGlobal,
			isDynamic: this.isDynamic,
		};
	}

	public get edges() {
		return Promise.resolve().then(async () => {
			const imports = await this._module.imports;

			return imports.map((importModule) => {
				const analyzeModule = new AnalyzeModule(importModule);
				return {
					type: EdgeTypeEnum.IMPORT,
					source: analyzeModule.id,
					target: this.id,
					metadata: {
						isCircular: false,
					},
				};
			});
		});
	}

	public get providers() {
		return [...this._module.providers];
	}

	public get isGlobal() {
		let isGlobal = isGlobalModule(this._metatype);

		if (isDynamicModule(this._module.metatype)) {
			if (this._module.metatype.module.forRoot) {
				isGlobal = true;
			}
		}

		return isGlobal;
	}

	public get imports() {
		return this._module.imports || [];
	}

	public get exports() {
		return this._module.exports || [];
	}
}
