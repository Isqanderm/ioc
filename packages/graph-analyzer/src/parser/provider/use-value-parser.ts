import type { ProvidersInterface } from "../../interfaces/providers.interface";

const provideRegexp = /provide:\s*"([^"]+)"/;
const useValueRegexp = /useValue:\s*"([^"]+)"/;

export class UseValueParser implements ProvidersInterface {
	public readonly type = "UseValue";
	private _token: string | null = null;
	private _value: string | null = null;

	constructor(private readonly provider: string) {}

	parse() {
		const token = this.provider.match(provideRegexp);
		const useValue = this.provider.match(useValueRegexp);

		if (token) {
			this._token = token[1];
		}

		if (useValue) {
			this._value = useValue[1];
		}

		return this;
	}

	get token(): string | null {
		return this._token;
	}

	get value(): string | null {
		return this._value;
	}
}
