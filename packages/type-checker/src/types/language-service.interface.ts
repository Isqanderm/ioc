import type * as ts from "typescript/lib/tsserverlibrary";

/**
 * Minimal language service interface for type-checker package
 *
 * This interface allows the type-checker to work with different
 * language service implementations without tight coupling.
 *
 * Implementations can provide:
 * - TypeScript Language Service (for VS Code plugins)
 * - TypeScript Program (for ESLint plugins)
 * - Custom implementations for CLI tools
 */
export interface ILanguageServiceLike {
	/**
	 * The underlying TypeScript Language Service
	 */
	tsLS: ts.LanguageService;
}
