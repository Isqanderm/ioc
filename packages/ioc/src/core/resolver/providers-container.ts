import type { InjectionToken } from "../../interfaces";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export class ProvidersContainer extends Map<InjectionToken, any> {}
