import type { Provider } from "../module-types.interface";

export interface ProviderTokenFactoryInterface {
	create(metatype: Provider): Promise<string>;
}
