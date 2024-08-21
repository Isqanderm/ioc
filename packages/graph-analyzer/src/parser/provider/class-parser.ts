import type { ProvidersInterface } from "../../interfaces/providers.interface";

export class ClassParser implements ProvidersInterface {
	constructor(public readonly token: string) {}

	parse(): this {
		return this;
	}
}
