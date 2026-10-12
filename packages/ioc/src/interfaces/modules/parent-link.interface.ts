import type { ProviderToken } from "../injection-token.interface";
import type { Provider } from "../module-types.interface";

/** What a child container may take from its parent chain. */
export interface ParentLink {
	canProvide(token: ProviderToken): boolean;
	get<T>(token: ProviderToken<T>): T;
	resolve<T>(token: ProviderToken<T>): Promise<T>;
}

export interface CreateChildOptions {
	/** Extra providers appended to the child root module (e.g. per-instance config). */
	providers?: Provider[];
}
