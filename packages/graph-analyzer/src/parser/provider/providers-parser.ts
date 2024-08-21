import type { ProvidersInterface } from "../../interfaces/providers.interface";
import { ClassParser } from "./class-parser";
import { UseClassParser } from "./use-class-parser";
import { UseFactoryParser } from "./use-factory-parser";
import { UseValueParser } from "./use-value-parser";

export class ProvidersParser {
	constructor(private readonly providers: string[]) {}

	public parse(): ProvidersInterface[] {
		return this.providers.map((provider) => {
			const cleanProvider = provider.replace(/\s+/g, "");

			if (cleanProvider.includes("useValue:")) {
				return new UseValueParser(cleanProvider).parse();
			}

			if (cleanProvider.includes("useFactory:")) {
				return new UseFactoryParser(cleanProvider).parse();
			}

			if (cleanProvider.includes("useClass:")) {
				return new UseClassParser(cleanProvider).parse();
			}

			return new ClassParser(cleanProvider).parse();
		});
	}
}
