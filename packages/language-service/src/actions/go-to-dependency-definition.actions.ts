import {
	findTypeReferences,
	type NsModuleDeclaration,
	NsModuleParser,
	NsModulesParser,
	type ProviderType,
} from "@nexus-ioc/type-checker";
import * as ts from "typescript/lib/tsserverlibrary";
import type { NsLanguageService } from "../language-service/ns-language-service";

/**
 * Finds the definition location for a dependency token used in an @Inject decorator
 *
 * This function analyzes the AST to locate where a dependency is provided in NsModule declarations.
 * It searches through all modules that reference the class containing the @Inject decorator and
 * returns the provider definition locations.
 *
 * @param focusNode - The AST node representing the dependency token (identifier or string literal)
 * @param tsNsLs - The Nexus IoC Language Service instance
 * @returns Definition info with text span and provider locations, or undefined if not in @Inject decorator
 *
 * @example
 * // For @Inject(AppService), returns the location of AppService in the providers array
 * // For @Inject("TOKEN"), returns the location of { provide: "TOKEN", ... } in the providers array
 */
export const goToDependencyDefinitionActions = (
	focusNode: ts.Node,
	tsNsLs: NsLanguageService,
): ts.DefinitionInfoAndBoundSpan | undefined => {
	const textSpan = {
		start: focusNode.getStart(),
		length: focusNode.getWidth(),
	};

	const injectExpressionNode = focusNode.parent as ts.CallExpression;
	if (
		ts.isIdentifier(injectExpressionNode.expression) &&
		injectExpressionNode.expression.text === "Inject"
	) {
		const injectDecoratorNode = injectExpressionNode.parent as ts.Decorator;
		const classDeclarationNode = (
			(injectDecoratorNode.parent as ts.Node).parent as ts.Node
		).parent as ts.ClassDeclaration;
		const typeChecker = tsNsLs.tsLS
			.getProgram()
			?.getTypeChecker() as ts.TypeChecker;

		const references = findTypeReferences(classDeclarationNode, tsNsLs);

		const referenceModules: NsModuleDeclaration[] = [];

		for (const reference of references) {
			const sourceFileReference = tsNsLs.tsLS
				.getProgram()
				?.getSourceFile(reference.fileName);

			if (!sourceFileReference) {
				continue;
			}

			const modules = NsModulesParser.executeByClassDependency(
				sourceFileReference,
				classDeclarationNode,
				tsNsLs,
			);
			const nsModule = NsModuleParser.execute(modules, typeChecker, tsNsLs);

			referenceModules.push(...nsModule);
		}

		const providers = referenceModules.reduce<ProviderType[]>((accum, item) => {
			return accum.concat(
				item.providers.filter(
					(provider) => provider.provide.getText() === focusNode.getText(),
				),
			);
		}, []);
		const definitionInfos = providers.map<ts.DefinitionInfo>(
			(provider) =>
				({
					kind: ts.ScriptElementKind.variableElement,
					name: provider.provide
						.getText()
						.replaceAll('"', "")
						.replaceAll("'", "")
						.replaceAll("`", "") as string,
					fileName: provider.declaration.getSourceFile().fileName,
					containerKind: ts.ScriptElementKind.link,
					containerName: "containerName",
					textSpan: {
						start: provider.start - 2,
						length: provider.length + 2,
					},
				}) as ts.DefinitionInfo,
		);

		return {
			textSpan,
			definitions: definitionInfos,
		};
	}
};
