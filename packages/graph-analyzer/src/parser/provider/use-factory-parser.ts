import type { ProvidersInterface } from "../../interfaces/providers.interface";

const provideRegexp = /provide:\s*"([^"]+)"/;
const useFactoryRegexp = /useFactory:\s*((?:\([^)]*\)\s*=>\s*\{[^}]*\}))/;
const injectRegexp = /inject:\s*\[([^\]]+)\]/;
const scopeRegexp = /scope:\s*([^,}]+)/;

export class UseFactoryParser implements ProvidersInterface {
	public readonly type = "UseFactory";
	private _token: string | null = null;
	private _value: string | null = null;
	private _inject: string[] = [];
	private _scope: string | null = null;

	constructor(private readonly provider: string) {}

	parse() {
		const token = this.provider.match(provideRegexp);
		const useFactory = this.provider.match(useFactoryRegexp);
		const inject = this.provider.match(injectRegexp);
		const scope = this.provider.match(scopeRegexp);

		if (token) {
			this._token = token[1];
		}

		if (useFactory) {
			this._value = useFactory[1];
		}

		if (inject) {
			this._inject = inject[1]
				.split(",")
				.map((inject) => inject.trim())
				.map((inject) => inject.replace(/^["']|["']$/g, "")); // Remove surrounding quotes
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

	get inject(): string[] {
		return this._inject;
	}

	get scope(): string | null {
		return this._scope;
	}
}
