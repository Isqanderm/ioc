import type { ModuleContainerInterface, Provider } from "../../../interfaces";
import {
	isClassProvider,
	isFactoryProvider,
	isFunctionProvider,
	isValueProvider,
} from "../../../utils/helpers";
import { AnalyzeClassProvider } from "./analyze-class-provider";
import { AnalyzeFactoryProvider } from "./analyze-factory-provider";
import { AnalyzeFunctionProvider } from "./analyze-function-provider";
import { AnalyzeValueProvider } from "./analyze-value-provider";

export function ProviderFactory(
	provider: Provider,
	module: ModuleContainerInterface,
) {
	if (isFactoryProvider(provider)) {
		return new AnalyzeFactoryProvider(provider, module);
	}

	if (isClassProvider(provider)) {
		return new AnalyzeClassProvider(provider, module);
	}

	if (isFunctionProvider(provider)) {
		return new AnalyzeFunctionProvider(provider, module);
	}

	if (isValueProvider(provider)) {
		return new AnalyzeValueProvider(provider, module);
	}

	return null;
}
