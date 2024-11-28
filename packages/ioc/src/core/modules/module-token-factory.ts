import type {
	DynamicModule,
	HashUtilInterface,
	Module,
	ModuleTokenFactoryInterface,
} from "../../interfaces";
import { isDynamicModule } from "../../utils/helpers";

export class ModuleTokenFactory implements ModuleTokenFactoryInterface {
	constructor(private readonly hashUtils: HashUtilInterface) {}

	public async create(metatype: Module | DynamicModule): Promise<string> {
		return this.hashUtils.hashString(metatype.toString());
	}
}
