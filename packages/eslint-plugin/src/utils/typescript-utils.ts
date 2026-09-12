import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";
import {
	createNexusAnalyzer,
	type NexusDecoratorKind,
} from "@nexus-ioc/type-checker";
import type { TypedRuleContext } from "../types/rule-context.interface";

export type NexusTypeScriptContext = TypedRuleContext & {
	analyzer: ReturnType<typeof createNexusAnalyzer>;
};

/**
 * Get the TypeScript program, type checker and Nexus semantic analyzer from
 * the typed ESLint parser services.
 */
export function getTypeScriptContext(
	context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
): NexusTypeScriptContext | null {
	try {
		const parserServices = ESLintUtils.getParserServices(context);
		if (!parserServices.program) {
			return null;
		}

		const program = parserServices.program;
		return {
			program,
			typeChecker: program.getTypeChecker(),
			analyzer: createNexusAnalyzer(program),
			getTsNodeAtLocation(node: TSESTree.Node): ts.Node | undefined {
				return parserServices.esTreeNodeToTSNodeMap.get(node);
			},
			getSourceFile(): ts.SourceFile | undefined {
				return program.getSourceFile(context.filename || context.getFilename?.());
			},
		};
	} catch (_error) {
		return null;
	}
}

/**
 * Check whether a TypeScript node has a Nexus decorator resolved through the
 * TypeScript symbol graph rather than by comparing identifier text.
 */
export function hasNexusDecorator(
	analyzer: ReturnType<typeof createNexusAnalyzer>,
	node: ts.Node,
	kind: NexusDecoratorKind,
): boolean {
	return analyzer.hasDecorator(node, kind);
}

export function getDecorators(node: ts.Node): readonly ts.Decorator[] {
	return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

export function getClassName(node: ts.ClassDeclaration): string | undefined {
	return node.name?.text;
}

export function isInjectableClass(
	analyzer: ReturnType<typeof createNexusAnalyzer>,
	node: ts.Node,
): node is ts.ClassDeclaration {
	return ts.isClassDeclaration(node) && hasNexusDecorator(analyzer, node, "Injectable");
}

export function isModuleClass(
	analyzer: ReturnType<typeof createNexusAnalyzer>,
	node: ts.Node,
): node is ts.ClassDeclaration {
	return (
		ts.isClassDeclaration(node) &&
		(hasNexusDecorator(analyzer, node, "NsModule") ||
			hasNexusDecorator(analyzer, node, "Global"))
	);
}
