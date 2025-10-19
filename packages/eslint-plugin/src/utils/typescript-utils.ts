import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";
import type { TypedRuleContext } from "../types/rule-context.interface";

/**
 * Get TypeScript program and type checker from ESLint rule context
 */
export function getTypeScriptContext(
	context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
): TypedRuleContext | null {
	try {
		const parserServices = ESLintUtils.getParserServices(context);

		if (!parserServices || !parserServices.program) {
			return null;
		}

		const program = parserServices.program;
		const typeChecker = program.getTypeChecker();

		return {
			program,
			typeChecker,
			getTsNodeAtLocation(node: TSESTree.Node): ts.Node | undefined {
				return parserServices.esTreeNodeToTSNodeMap.get(node);
			},
			getSourceFile(): ts.SourceFile | undefined {
				const fileName = context.filename || context.getFilename?.();
				return program.getSourceFile(fileName);
			},
		};
	} catch (_error) {
		return null;
	}
}

/**
 * Check if a node is a decorator with a specific name
 */
export function isDecoratorWithName(
	node: ts.Node,
	decoratorName: string,
): boolean {
	if (!ts.isDecorator(node)) {
		return false;
	}

	const expression = node.expression;

	if (ts.isIdentifier(expression)) {
		return expression.text === decoratorName;
	}

	if (
		ts.isCallExpression(expression) &&
		ts.isIdentifier(expression.expression)
	) {
		return expression.expression.text === decoratorName;
	}

	return false;
}

/**
 * Get all decorators from a node
 */
export function getDecorators(node: ts.Node): readonly ts.Decorator[] {
	if (ts.canHaveDecorators(node)) {
		return ts.getDecorators(node) || [];
	}
	return [];
}

/**
 * Check if a class has a specific decorator
 */
export function hasDecorator(
	node: ts.ClassDeclaration,
	decoratorName: string,
): boolean {
	const decorators = getDecorators(node);
	return decorators.some((decorator) =>
		isDecoratorWithName(decorator, decoratorName),
	);
}

/**
 * Get the name of a class declaration
 */
export function getClassName(node: ts.ClassDeclaration): string | undefined {
	return node.name?.text;
}

/**
 * Check if a node is an injectable class
 */
export function isInjectableClass(node: ts.Node): node is ts.ClassDeclaration {
	return ts.isClassDeclaration(node) && hasDecorator(node, "Injectable");
}

/**
 * Check if a node is a module class
 */
export function isModuleClass(node: ts.Node): node is ts.ClassDeclaration {
	return (
		ts.isClassDeclaration(node) &&
		(hasDecorator(node, "NsModule") || hasDecorator(node, "Global"))
	);
}
