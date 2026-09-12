import type { TSESTree } from "@typescript-eslint/utils";
import type * as ts from "typescript";

/**
 * Extended context for ESLint rules that need TypeScript type information
 */
export interface TypedRuleContext {
	/**
	 * TypeScript program instance
	 */
	program: ts.Program;

	/**
	 * TypeScript type checker
	 */
	typeChecker: ts.TypeChecker;

	/**
	 * Get TypeScript node from ESTree node
	 */
	getTsNodeAtLocation(node: TSESTree.Node): ts.Node | undefined;

	/**
	 * Get source file for the current file being linted
	 */
	getSourceFile(): ts.SourceFile | undefined;
}

/**
 * Options for rules that can be configured
 */
export interface RuleOptions {
	/**
	 * Whether to check property injection
	 */
	checkProperties?: boolean;

	/**
	 * Whether to check constructor injection
	 */
	checkConstructors?: boolean;

	/**
	 * Maximum depth for circular dependency detection
	 */
	maxDepth?: number;
}
