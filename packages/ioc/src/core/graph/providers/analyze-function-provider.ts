import type { Type } from "../../../interfaces";
import { AnalyzeProvider } from "../analyze-provider";

export class AnalyzeFunctionProvider extends AnalyzeProvider {
	public get metatype() {
		return this.provider as Type;
	}
}
