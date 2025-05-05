import type { CompletionEntry } from "typescript";
import ts from "typescript/lib/tsserverlibrary";
import { findTypeReferences } from "../helpers/find-type-references.helper";
import type { NsLanguageService } from "../language-service/ns-language-service";
import { NsModuleParser } from "../parsers/ns-module.parser";
import { NsModulesParser } from "../parsers/ns-modules.parser";

export const getCompletionInfoActions = (
	classDeclaration: ts.ClassDeclaration,
	tsNsLs: NsLanguageService,
): ts.CompletionInfo | undefined => {
	const typeChecker = tsNsLs.tsLS.getProgram()?.getTypeChecker();

	if (!typeChecker) {
		return;
	}

	const entries = findTypeReferences(classDeclaration, tsNsLs)
		.map((item) => {
			const sourceFile = tsNsLs.tsLS
				.getProgram()
				?.getSourceFile(item.fileName) as ts.SourceFile;
			return NsModulesParser.executeByClassDependency(
				sourceFile,
				classDeclaration,
				tsNsLs,
			);
		})
		.flatMap((items) => NsModuleParser.execute(items, typeChecker, tsNsLs))
		.flatMap((module) => module.providers)
		.map((provider, index): CompletionEntry | null => {
			if (ts.isStringLiteral(provider.provide)) {
				const name = provider.provide
					.getText()
					.replaceAll('"', "")
					.replaceAll("'", "");

				return {
					name,
					kind: ts.ScriptElementKind.string,
					kindModifiers: "export",
					sortText: `${index}`,
					insertText: name,
				};
			}

			if (ts.isClassDeclaration(provider.provide)) {
				return {
					name: provider.provide.name?.text as string,
					kind: ts.ScriptElementKind.classElement,
					kindModifiers: "export",
					sortText: `${index}`,
					insertText: provider.provide.name?.text as string,
				};
			}

			return null;
		})
		.filter(Boolean);

	return {
		isGlobalCompletion: false,
		isMemberCompletion: true,
		isNewIdentifierLocation: true,
		entries: entries as CompletionEntry[],
	};
};
