import type { InjectionToken } from "./injection-token.interface";
import type { Scope } from "./scope.interface";
import type { Type } from "./type.interface";

export type Module = Type;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type Provider<T = any> =
	| ClassProvider<T>
	| ValueProvider<T>
	| FactoryProvider<T>
	| Type<T>;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export interface ClassProvider<T = any> {
	provide: InjectionToken;
	useClass: Type<T>;
	scope?: Scope;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export interface ValueProvider<T = any> {
	provide: InjectionToken;
	useValue: T;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export interface FactoryProvider<T = any> {
	provide: InjectionToken;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	useFactory: (...args: any[]) => T | Promise<T>;
	inject?: InjectionToken[];
	scope?: Scope;
}
