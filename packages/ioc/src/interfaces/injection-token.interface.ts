import type { Abstract } from "./abstract.interface";
import type { Type } from "./type.interface";

// biome-ignore lint/suspicious/noExplicitAny: injection token interface
export type InjectionToken<T = any> =
	| string
	| symbol
	| Type<T>
	| Abstract<T>
	// biome-ignore lint/complexity/noBannedTypes: Function type needed for injection token
	| Function;
