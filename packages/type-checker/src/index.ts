/**
 * @packageDocumentation
 * @nexus-ioc/type-checker - Framework-agnostic type-checking for Nexus IoC
 *
 * This package provides the core type-checking logic for Nexus IoC dependency injection.
 * It can be used by:
 * - TypeScript Language Service Plugins (VS Code)
 * - ESLint Plugins (WebStorm, IntelliJ IDEA, and all IDEs)
 * - CLI Tools (CI/CD pipelines)
 * - Custom tooling and integrations
 *
 * @example
 * ```typescript
 * import {
 *   InjectParser,
 *   InjectableParser,
 *   NsModuleParser,
 *   compareTypes,
 *   NoOpLogger
 * } from '@nexus-ioc/type-checker';
 *
 * // Parse a class for @Inject decorators
 * const logger = new NoOpLogger();
 * const params = InjectParser.execute(classDeclaration, logger);
 *
 * // Compare types for compatibility
 * const isCompatible = compareTypes(paramType, providerType, typeChecker);
 * ```
 */

// Helpers
export { checkTypesHelper } from "./helpers/check-types.helper";
export { CircularDependencyDetectorHelper } from "./helpers/circular-dependency-detector.helper";
export { compareTypes } from "./helpers/compare-types.helper";
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
// Types
export { type ILogger, NoOpLogger } from "./types/logger.interface";
