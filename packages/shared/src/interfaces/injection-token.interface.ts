import type { Abstract } from "./abstract.interface";
import type { Type } from "./type.interface";

// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter allows any token type
export type InjectionToken<T = any> =
	| string
	| symbol
	| Type<T>
	| Abstract<T>
	// biome-ignore lint/complexity/noBannedTypes: Function type is required for dependency injection tokens
	| Function;
