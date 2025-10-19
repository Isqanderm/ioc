import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import { getTypeScriptContext, isModuleClass } from "../utils/typescript-utils";

const createRule = ESLintUtils.RuleCreator(
	(name) =>
		`https://github.com/Isqanderm/ioc/tree/main/packages/eslint-plugin#${name}`,
);

type MessageIds = "moduleRequired";
type Options = [];

export default createRule<Options, MessageIds>({
	name: "valid-provider-config",
	meta: {
		type: "problem",
		docs: {
			description:
				"Ensures classes with providers are decorated with @NsModule",
		},
		messages: {
			moduleRequired:
				"Class '{{className}}' appears to be a module but is not decorated with @NsModule. Add @NsModule() decorator to this class.",
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

				// Check if class looks like a module but isn't decorated
				const looksLikeModule = hasModuleLikeProperties(node);
				const isModule = isModuleClass(tsNode);

				if (looksLikeModule && !isModule) {
					context.report({
						node,
						messageId: "moduleRequired",
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
 * Check if a class has properties that suggest it's a module
 */
function hasModuleLikeProperties(
	classNode: TSESTree.ClassDeclaration,
): boolean {
	// Check if class name ends with "Module"
	if (classNode.id?.name.endsWith("Module")) {
		return true;
	}

	// Could add more heuristics here
	return false;
}
