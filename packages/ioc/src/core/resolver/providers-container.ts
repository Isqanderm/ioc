import type { ProviderToken } from "../../interfaces";

// biome-ignore lint/suspicious/noExplicitAny: providers container
export class ProvidersContainer extends Map<ProviderToken, any> {}
