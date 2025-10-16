import type { AnalyzeProvider } from "../analyze-provider";
import { AnalyzeClassProvider } from "../providers/analyze-class-provider";
import { AnalyzeFactoryProvider } from "../providers/analyze-factory-provider";
import { AnalyzeFunctionProvider } from "../providers/analyze-function-provider";
import { AnalyzeValueProvider } from "../providers/analyze-value-provider";

export function isAnalyzeClassProvider(
	target: AnalyzeProvider,
): target is AnalyzeClassProvider {
	return target instanceof AnalyzeClassProvider;
}

export function isAnalyzeFactoryProvider(
	target: AnalyzeProvider,
): target is AnalyzeFactoryProvider {
	return target instanceof AnalyzeFactoryProvider;
}

export function isAnalyzeFunctionProvider(
	target: AnalyzeProvider,
): target is AnalyzeFunctionProvider {
	return target instanceof AnalyzeFunctionProvider;
}

export function isAnalyzeValueProvider(
	target: AnalyzeProvider,
): target is AnalyzeValueProvider {
	return target instanceof AnalyzeValueProvider;
}
