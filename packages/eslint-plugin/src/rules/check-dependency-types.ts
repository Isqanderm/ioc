import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";
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
		if (!tsContext) return {};

		return {
			ClassDeclaration(node: TSESTree.ClassDeclaration) {
				const tsNode = tsContext.getTsNodeAtLocation(node);
				if (!tsNode || !ts.isClassDeclaration(tsNode)) return;

				const model = tsContext.analyzer.getClassModel(tsNode);
				if (
					model.dependencies.length > 0 &&
					!isInjectableClass(tsContext.analyzer, tsNode)
				) {
					context.report({
						node,
						messageId: "injectableRequired",
						data: { className: node.id?.name || "AnonymousClass" },
					});
				}
			},
		};
	},
});
