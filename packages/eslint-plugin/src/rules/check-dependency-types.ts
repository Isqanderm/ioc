import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import {
	getTypeScriptContext,
	isInjectableClass,
} from "../utils/typescript-utils";

const createRule = ESLintUtils.RuleCreator(
	(name) =>
		`https://github.com/Isqanderm/ioc/tree/main/packages/eslint-plugin#${name}`,
);

type MessageIds = "injectableRequired";
type Options = [];

export default createRule<Options, MessageIds>({
	name: "check-dependency-types",
	meta: {
		type: "problem",
		docs: {
			description:
				"Validates that classes with @Inject decorators are marked as @Injectable",
		},
		messages: {
			injectableRequired:
				"Class '{{className}}' uses @Inject but is not decorated with @Injectable. Add @Injectable() decorator to this class.",
		},
		schema: [],
	},
	defaultOptions: [],
	create(context) {
		const tsContext = getTypeScriptContext(context);

		if (!tsContext) {
			// TypeScript parser not available, skip this rule
			return {};
		}

		return {
			ClassDeclaration(node: TSESTree.ClassDeclaration) {
				const tsNode = tsContext.getTsNodeAtLocation(node);

				if (!tsNode) {
					return;
				}

				// Check if class has @Inject decorators but no @Injectable
				const hasInjectDecorator = hasInjectInClass(node);
				const isInjectable = isInjectableClass(tsNode);

				if (hasInjectDecorator && !isInjectable) {
					context.report({
						node,
						messageId: "injectableRequired",
						data: {
							className: node.id?.name || "AnonymousClass",
						},
					});
				}
			},
		};
	},
});

/**
 * Check if a class has any @Inject decorators
 */
function hasInjectInClass(classNode: TSESTree.ClassDeclaration): boolean {
	if (!classNode.body || !classNode.body.body) {
		return false;
	}

	for (const member of classNode.body.body) {
		// Check constructor parameters
		if (
			member.type === "MethodDefinition" &&
			member.kind === "constructor" &&
			member.value.type === "FunctionExpression"
		) {
			for (const param of member.value.params) {
				if (hasInjectDecorator(param)) {
					return true;
				}
			}
		}

		// Check properties
		if (member.type === "PropertyDefinition") {
			if (hasInjectDecorator(member)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check if a node has @Inject decorator
 */
function hasInjectDecorator(node: TSESTree.Node): boolean {
	if (!("decorators" in node) || !node.decorators) {
		return false;
	}

	const decorators = node.decorators as TSESTree.Decorator[];

	return decorators.some((decorator) => {
		if (decorator.expression.type === "Identifier") {
			return decorator.expression.name === "Inject";
		}
		if (decorator.expression.type === "CallExpression") {
			const callee = decorator.expression.callee;
			return callee.type === "Identifier" && callee.name === "Inject";
		}
		return false;
	});
}
