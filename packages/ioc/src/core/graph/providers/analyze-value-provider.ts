import type { ValueProvider } from "../../../interfaces";
import { AnalyzeProvider } from "../analyze-provider";

export class AnalyzeValueProvider extends AnalyzeProvider {
	public get metatype() {
		return this.provider as ValueProvider;
	}

	public get provide() {
		return this.metatype.provide;
	}

	public get useValue() {
		return this.metatype.useValue;
	}
}
