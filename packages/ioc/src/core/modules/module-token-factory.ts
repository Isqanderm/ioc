import type {
	DynamicModule,
	HashUtilInterface,
	Module,
	ModuleTokenFactoryInterface,
} from "../../interfaces";
import { isDynamicModule } from "../../utils/helpers";

export class ModuleTokenFactory implements ModuleTokenFactoryInterface {
	private readonly moduleTokenCache = new Map<string, string>();
	private readonly moduleTokens = new WeakMap<Module | DynamicModule, string>();
	private readonly moduleIdsCache = new WeakMap<
		Module | DynamicModule,
		string
	>();

	constructor(private readonly hashUtils: HashUtilInterface) {}

	public async create(metatype: Module | DynamicModule): Promise<string> {
		const moduleToken = this.moduleTokens.get(metatype);

		if (moduleToken) {
			return moduleToken;
		}

		const moduleId = this.getModuleId(metatype);

		const token = await this.getStaticModuleToken(
			moduleId,
			this.getModuleName(metatype),
		);

		this.moduleTokens.set(metatype, token);

		return token;
	}

	private getModuleId(metatype: Module | DynamicModule): string {
		let moduleId = this.moduleIdsCache.get(metatype);

		if (moduleId) {
			return moduleId;
		}

		moduleId = this.hashUtils.randomStringGenerator();
		this.moduleIdsCache.set(metatype, moduleId);
		return moduleId;
	}

	private async getStaticModuleToken(
		moduleId: string,
		moduleName: string,
	): Promise<string> {
		const key = `${moduleId}_${moduleName}`;
		if (this.moduleTokenCache.has(key)) {
			return this.moduleTokenCache.get(key) as string;
		}

		const hash = await this.hashUtils.hashString(key);
		this.moduleTokenCache.set(key, hash);
		return hash;
	}

	private getModuleName(metatype: Module | DynamicModule): string {
		if (isDynamicModule(metatype)) {
			return metatype.module.name;
		}

		return metatype.name;
	}
}
