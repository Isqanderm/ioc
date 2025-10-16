import type { Abstract } from "./abstract.interface";
import type { Type } from "./type.interface";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type InjectionToken<T = any> =
	| string
	| symbol
	| Type<T>
	| Abstract<T>
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	| Function;

