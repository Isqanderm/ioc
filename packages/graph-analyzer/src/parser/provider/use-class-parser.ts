import type { ProvidersInterface } from "../../interfaces/providers.interface";

const provideRegexp = /provide:\s*([^,\s]+)/;
const useClassRegexp = /useClass:\s*([A-Za-z_][A-Za-z0-9_]*)/;
const scopeRegexp = /scope:\s*([A-Za-z_][\w.]*)/;

export class UseClassParser implements ProvidersInterface {
	private token: string | null = null;
	private value: string | null = null;
	private scope: string | null = null;

	constructor(private readonly provider: string) {}

	parse() {
		const token = this.provider.match(provideRegexp);
		const useClass = this.provider.match(useClassRegexp);
		const scope = this.provider.match(scopeRegexp);

		if (token) {
			this.token = token[1];
		}

		if (useClass) {
			this.value = useClass[1];
		}

		if (scope) {
			this.scope = scope[1];
		}

		return this;
	}
}
