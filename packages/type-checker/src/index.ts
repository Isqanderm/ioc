/**
 * @packageDocumentation
 * @nexus-ioc/type-checker - Framework-agnostic semantic analysis for Nexus IoC.
 */

export {
	createNexusAnalyzer,
	NexusAnalyzer,
	type NexusAnalyzerOptions,
} from "./analysis/nexus-analyzer";
export {
	createNexusApplicationAnalyzer,
	NexusApplicationAnalyzer,
} from "./analysis/nexus-application-analyzer";
export {
	createNexusApplicationGraphBuilder,
	NexusApplicationGraphBuilder,
} from "./analysis/nexus-application-graph-builder";
export type {
	NexusApplicationGraph,
	NexusResolvedDependency,
	NexusUnresolvedDependency,
} from "./analysis/nexus-application-graph-model";
export type { NexusApplication } from "./analysis/nexus-application-model";
export { findApplicationEntryPoint } from "./analysis/nexus-entry-point";
export type {
	NexusClass,
	NexusDecorator,
	NexusDecoratorKind,
	NexusDependency,
	NexusModule,
	NexusModuleExport,
	NexusModuleImport,
	NexusProvider,
	NexusProviderKind,
	NexusSourceSpan,
	NexusToken,
} from "./analysis/nexus-semantic-model";

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
// Program construction
export { createNexusProgram } from "./program/create-program-from-tsconfig";
export type { ILanguageServiceLike } from "./types/language-service.interface";
export { type ILogger, NoOpLogger } from "./types/logger.interface";
