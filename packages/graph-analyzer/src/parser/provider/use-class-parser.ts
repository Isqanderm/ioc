import type { ProvidersInterface } from "../../interfaces/providers.interface";

const provideRegexp = /provide:\s*([^,\s]+)/;
const useClassRegexp = /useClass:\s*([A-Za-z_][A-Za-z0-9_]*)/;
const scopeRegexp = /scope:\s*([A-Za-z_][\w.]*)/;

export class UseClassParser implements ProvidersInterface {
	public readonly type = "UseClass";
	private _token: string | null = null;
	private _value: string | null = null;
	private _scope: string | null = null;

	constructor(private readonly provider: string) {}

	parse() {
		const token = this.provider.match(provideRegexp);
		const useClass = this.provider.match(useClassRegexp);
		const scope = this.provider.match(scopeRegexp);

		if (token) {
			this._token = token[1];
		}

		if (useClass) {
			this._value = useClass[1];
		}

		if (scope) {
			this._scope = scope[1];
		}

		return this;
	}

	get token(): string | null {
		return this._token;
	}

	get value(): string | null {
		return this._value;
	}

	get scope(): string | null {
		return this._scope;
	}
}
