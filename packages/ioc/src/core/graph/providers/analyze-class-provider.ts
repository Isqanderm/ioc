import type { ClassProvider } from "../../../interfaces";
import { AnalyzeProvider } from "../analyze-provider";

export class AnalyzeClassProvider extends AnalyzeProvider {
	public get metatype() {
		return this.provider as ClassProvider;
	}

	public get provide() {
		return this.metatype.provide;
	}

	public get useClass() {
		return this.metatype.useClass;
	}
}
