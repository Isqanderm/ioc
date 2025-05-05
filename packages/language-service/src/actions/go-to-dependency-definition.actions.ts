import * as ts from "typescript/lib/tsserverlibrary";
import { findTypeReferences } from "../helpers/find-type-references.helper";
import {
	type NsModuleDeclaration,
	NsModuleParser,
	type ProviderType,
} from "../parsers/ns-module.parser";
import { NsModulesParser } from "../parsers/ns-modules.parser";
import type { NsLanguageService } from "../language-service/ns-language-service";

/**
 * Данный метод нужен для поиска объявлений для зависимости и формирования
 * @param focusNode {ts.Node}
 * @param tsNsLs
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
