import type { InjectionToken } from "../tokens/injection-token";
import type { Abstract } from "./abstract.interface";
import type { Type } from "./type.interface";

// biome-ignore lint/suspicious/noExplicitAny: provider token
export type ProviderToken<T = any> =
	| string
	| symbol
	| Type<T>
	| Abstract<T>
	| InjectionToken<T>
	// biome-ignore lint/complexity/noBannedTypes: Function type needed for provider token
	| Function;
