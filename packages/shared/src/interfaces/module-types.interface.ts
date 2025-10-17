import type { InjectionToken } from "./injection-token.interface";
import type { Scope } from "./scope.interface";
import type { Type } from "./type.interface";

export type Module = Type;
// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter allows any provider type
export type Provider<T = any> =
	| ClassProvider<T>
	| ValueProvider<T>
	| FactoryProvider<T>
	| Type<T>;

// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter allows any class type
export interface ClassProvider<T = any> {
	provide: InjectionToken;
	useClass: Type<T>;
	scope?: Scope;
}

// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter allows any value type
export interface ValueProvider<T = any> {
	provide: InjectionToken;
	useValue: T;
}

// biome-ignore lint/suspicious/noExplicitAny: Generic type parameter allows any factory return type
export interface FactoryProvider<T = any> {
	provide: InjectionToken;
	// biome-ignore lint/suspicious/noExplicitAny: Factory arguments can be of any type from DI container
	useFactory: (...args: any[]) => T | Promise<T>;
	inject?: InjectionToken[];
	scope?: Scope;
}
