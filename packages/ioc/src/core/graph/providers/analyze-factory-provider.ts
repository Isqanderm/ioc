import type { FactoryProvider } from "../../../interfaces";
import { AnalyzeProvider } from "../analyze-provider";

export class AnalyzeFactoryProvider extends AnalyzeProvider {
	public get metatype() {
		return this.provider as FactoryProvider;
	}

	public get provide() {
		return this.metatype.provide;
	}

	public get inject() {
		return this.metatype.inject;
	}
}
