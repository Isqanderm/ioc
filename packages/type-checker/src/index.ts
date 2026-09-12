/**
 * @packageDocumentation
 * @nexus-ioc/type-checker - Framework-agnostic semantic analysis for Nexus IoC.
 */

export type {
	NexusClassModel,
	NexusDecorator,
	NexusDecoratorKind,
	NexusDependency,
	NexusSourceSpan,
	NexusToken,
} from "./analysis/nexus-semantic-model";
export { createNexusAnalyzer, NexusAnalyzer } from "./analysis/nexus-analyzer";

// Helpers
export { checkTypesHelper } from "./helpers/check-types.helper";
export { CircularDependencyDetectorHelper } from "./helpers/circular-dependency-detector.helper";
export {
	compareBigIntTypes,
	compareBooleanTypes,
	compareNumberTypes,
	compareStringTypes,
	compareSymbolTypes,
	compareTypes,
} from "./helpers/compare-types.helper";
export { findNodeAtPosition } from "./helpers/find-node-at-position.helper";
export {
	findTypeReferences,
	type TypeReference,
} from "./helpers/find-type-references.helper";
export { getProviderType } from "./helpers/get-provider-type.helper";
export { getTypeOfNode } from "./helpers/get-type-of-node.helper";

// Parsers
export {
	type InjectParameterDeclaration,
	InjectParser,
} from "./parsers/inject.parser";
export { InjectableParser } from "./parsers/injectable.parser";
export {
	type ExportType,
	type ImportType,
	type NsModuleDeclaration,
	NsModuleParser,
	type ProviderType,
} from "./parsers/ns-module.parser";
export { NsModulesParser } from "./parsers/ns-modules.parser";

export type { ILanguageServiceLike } from "./types/language-service.interface";
export { type ILogger, NoOpLogger } from "./types/logger.interface";
