import type { ProvidersInterface } from "../../interfaces/providers.interface";

const provideRegexp = /provide:\s*"([^"]+)"/;
const useFactoryRegexp = /useFactory:\s*((?:\([^)]*\)\s*=>\s*\{[^}]*\}))/;
const injectRegexp = /inject:\s*\[([^\]]+)\]/;

export class UseFactoryParser implements ProvidersInterface {
	private token: string | null = null;
	private value: string | null = null;
	private inject: string[] | null = null;

	constructor(private readonly provider: string) {}

	parse() {
		const token = this.provider.match(provideRegexp);
		const useFactory = this.provider.match(useFactoryRegexp);
		const inject = this.provider.match(injectRegexp);

		if (token) {
			this.token = token[1];
		}

		if (useFactory) {
			this.value = useFactory[1];
		}

		if (inject) {
			this.inject = inject[1].split(",").map((inject) => inject.trim());
		}

		return this;
	}
}
