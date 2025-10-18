import type { ProvidersInterface } from "../../interfaces/providers.interface";

const provideRegexp = /provide:\s*"([^"]+)"/;
const useValueRegexp = /useValue:\s*"([^"]+)"/;
const scopeRegexp = /scope:\s*([^,}]+)/;

export class UseValueParser implements ProvidersInterface {
	public readonly type = "UseValue";
	private _token: string | null = null;
	private _value: string | null = null;
	private _scope: string | null = null;

	constructor(private readonly provider: string) {}

	parse() {
		const token = this.provider.match(provideRegexp);
		const useValue = this.provider.match(useValueRegexp);
		const scope = this.provider.match(scopeRegexp);

		if (token) {
			this._token = token[1];
		}

		if (useValue) {
			this._value = useValue[1];
		}

		if (scope) {
			this._scope = scope[1].trim();
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
