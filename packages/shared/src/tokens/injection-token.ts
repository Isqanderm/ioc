/**
 * A typed, unique token for providers that are not classes (configs,
 * interfaces, primitives). Compared by identity: two tokens with the same
 * description are different tokens.
 *
 * @example
 * export const API_URL = new InjectionToken<string>("API_URL");
 * providers: [{ provide: API_URL, useValue: "https://..." }]
 * app.get(API_URL); // string
 */
export class InjectionToken<T> {
	/** Phantom member: carries T for type inference; never set at runtime. */
	declare readonly __type?: T;

	constructor(public readonly description: string) {}

	public toString(): string {
		return `InjectionToken ${this.description}`;
	}
}
