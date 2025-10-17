import type { InjectionToken } from "../../interfaces";

// biome-ignore lint/suspicious/noExplicitAny: providers container
export class ProvidersContainer extends Map<InjectionToken, any> {}
