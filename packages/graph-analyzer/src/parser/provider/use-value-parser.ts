import type { ProvidersInterface } from "../../interfaces/providers.interface";

const provideRegexp = /provide:\s*"([^"]+)"/;
const useValueRegexp = /useValue:\s*"([^"]+)"/;

export class UseValueParser implements ProvidersInterface {
	private token: string | null = null;
	private value: string | null = null;

	constructor(private readonly provider: string) {}

	parse() {
		const token = this.provider.match(provideRegexp);
		const useValue = this.provider.match(useValueRegexp);

		if (token) {
			this.token = token[1];
		}

		if (useValue) {
			this.value = useValue[1];
		}

		return this;
	}
}
