import type { ProvidersInterface } from "../../interfaces/providers.interface";

export class ClassParser implements ProvidersInterface {
	public readonly type = "Class";

	constructor(public readonly _token: string) {}

	parse(): this {
		return this;
	}

	get token(): string {
		return this._token;
	}
}
