import type * as ts from "typescript";
import type { ProvidersInterface } from "../../interfaces/providers.interface";
import { ClassParser } from "./class-parser";
import { UseClassParser } from "./use-class-parser";
import { UseFactoryParser } from "./use-factory-parser";
import { UseValueParser } from "./use-value-parser";

export class ProvidersParser {
	constructor(
		private readonly providers: string[],
		private readonly sourceFile?: ts.SourceFile,
		private readonly currentFilePath?: string,
	) {}

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
				return new UseClassParser(
					cleanProvider,
					this.sourceFile,
					this.currentFilePath,
				).parse();
			}

			// For class providers, pass the source file and file path to enable dependency extraction
			return new ClassParser(
				cleanProvider,
				this.sourceFile,
				this.currentFilePath,
			).parse();
		});
	}
}
