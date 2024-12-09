import * as ts from "typescript/lib/tsserverlibrary";
import { getCompletionInfoActions } from "./actions/get-completion-info.actions";
import { getSemanticDiagnosticsActions } from "./actions/get-semantic-diagnostics.actions";
import { findNodeAtPosition } from "./helpers/find-node-at-position.helper";
import { NsLanguageService } from "./language-service/ns-language-service";
import { Logger } from "./logger";

type PluginConfig = {
	debug?: boolean;
	path?: string;
};

const plugin: ts.server.PluginModuleFactory = () => {
	return {
		create: (pluginCreateInfo) => {
			const config = pluginCreateInfo.config as PluginConfig;
			const tsConfigDirectory =
				pluginCreateInfo.languageServiceHost.getCurrentDirectory();

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const logger = new Logger(config as any);

			const tsNsLs = new NsLanguageService(
				pluginCreateInfo.project,
				pluginCreateInfo.serverHost,
				pluginCreateInfo.languageService,
				config,
				logger,
			);

			return new Proxy(pluginCreateInfo.languageService, {
				get: (target, property: keyof ts.LanguageService) => {
					if (property === "getSemanticDiagnostics") {
						return (fileName: string) => {
							const program = pluginCreateInfo.languageService.getProgram();
							const sourceFile = program?.getSourceFile(fileName);

							if (!sourceFile || !program) {
								return target.getSemanticDiagnostics(fileName);
							}

							const originalDiagnostic =
								target.getSemanticDiagnostics(fileName);

							// CODE

							const diagnostic = getSemanticDiagnosticsActions(
								fileName,
								tsNsLs,
							);

							return [...originalDiagnostic, ...diagnostic];

							// CODE
						};
					}

					if (property === "getCompletionsAtPosition") {
						return (
							fileName: string,
							position: number,
							options?: ts.GetCompletionsAtPositionOptions,
						): ts.CompletionInfo | undefined => {
							const program = pluginCreateInfo.languageService.getProgram();
							const defaultCompletionsAtPosition =
								target.getCompletionsAtPosition(fileName, position, options);
							const sourceFile = program?.getSourceFile(fileName);

							if (!program || !sourceFile) {
								return defaultCompletionsAtPosition;
							}

							const node = findNodeAtPosition(sourceFile, position);
							if (!node || !ts.isCallExpression(node.parent)) {
								return defaultCompletionsAtPosition;
							}

							const injectExpressionNode = node.parent;
							if (
								ts.isIdentifier(injectExpressionNode.expression) &&
								injectExpressionNode.expression.text === "Inject"
							) {
								const injectDecoratorNode =
									injectExpressionNode.parent as ts.Decorator;
								const classDeclarationNode = (
									(injectDecoratorNode.parent as ts.Node).parent as ts.Node
								).parent as ts.ClassDeclaration;

								return getCompletionInfoActions(classDeclarationNode, tsNsLs);
							}

							return defaultCompletionsAtPosition;
						};
					}

					return target[property];
				},
			});
		},
	};
};

export = plugin;
