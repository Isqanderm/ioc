import * as ts from "typescript/lib/tsserverlibrary";
import { checkTypesHelper } from "../helpers/check-types.helper";
import { compareTypes } from "../helpers/compare-types.helper";
import { findTypeReferences } from "../helpers/find-type-references.helper";
import type { NsLanguageService } from "../language-service/ns-language-service";
import { InjectParser } from "../parsers/inject.parser";
import { InjectableParser } from "../parsers/injectable.parser";
import {
	type ExportType,
	type NsModuleDeclaration,
	NsModuleParser,
	type ProviderType,
} from "../parsers/ns-module.parser";
import { NsModulesParser } from "../parsers/ns-modules.parser";

export const getSemanticDiagnosticsActions = (
	fileName: string,
	tsNsLs: NsLanguageService,
) => {
	const sourceFile = tsNsLs.tsLS.getProgram()?.getSourceFile(fileName);
	const originalDiagnostic = tsNsLs.tsLS.getSemanticDiagnostics(fileName);
	const typeChecker = tsNsLs.tsLS.getProgram()?.getTypeChecker();

	if (!sourceFile || !typeChecker) {
		return originalDiagnostic;
	}

	const diagnostic: ts.Diagnostic[] = [];
	const injectableClasses = InjectableParser.execute(sourceFile);

	if (!injectableClasses.length) {
		return originalDiagnostic;
	}

	for (const injectableClass of injectableClasses) {
		const params = InjectParser.execute(injectableClass, tsNsLs.logger);

		if (!params.length) {
			continue;
		}

		tsNsLs.logger.log(
			`[NsLanguageServer][getSemanticDiagnostics][params] ${params.length}`,
		);

		const references = findTypeReferences(
			injectableClass,
			tsNsLs.tsLS,
			tsNsLs.logger,
		);
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
				injectableClass,
				tsNsLs.logger,
			);
			const nsModule = NsModuleParser.execute(
				modules,
				typeChecker,
				tsNsLs.logger,
			);

			referenceModules.push(...nsModule);
		}

		for (const param of params) {
			for (const referenceModule of referenceModules) {
				let dependencyDeclare: ProviderType | ExportType | undefined =
					referenceModule.providers.find((provider) => {
						if (ts.isStringLiteral(param.name)) {
							const name = param.name.getText();
							if (provider.provideType !== "class") {
								return name === provider.provide?.getText();
							}

							return false;
						}

						if (ts.isIdentifier(param.name)) {
							return checkTypesHelper(
								provider.declaration,
								param.name,
								typeChecker,
								tsNsLs.logger,
							);
						}

						return false;
					});

				if (!dependencyDeclare) {
					referenceModule.imports.map((module) => {
						if (ts.isIdentifier(module.declaration)) {
							const references =
								findTypeReferences(
									module.declaration,
									tsNsLs.tsLS,
									tsNsLs.logger,
								) || [];

							if (!references.length) {
								return;
							}

							for (const reference of references) {
								const sourceFile = tsNsLs.tsLS
									.getProgram()
									?.getSourceFile(reference.fileName) as ts.SourceFile;

								const modules = NsModulesParser.executeByModuleName(
									sourceFile,
									module.declaration,
									typeChecker,
									tsNsLs.logger,
								);
								const nsModules = NsModuleParser.execute(
									modules,
									typeChecker,
									tsNsLs.logger,
								);

								for (const nsModule of nsModules) {
									dependencyDeclare = nsModule.exports.find((provider) => {
										if (ts.isStringLiteral(param.name)) {
											return provider.name === param.name.getText();
										}

										if (ts.isIdentifier(param.name)) {
											return checkTypesHelper(
												provider.declaration,
												param.name,
												typeChecker,
												tsNsLs.logger,
											);
										}

										return false;
									});
								}
							}
						}
					});
				}

				if (!dependencyDeclare) {
					diagnostic.push({
						file: sourceFile,
						start: param.start,
						length: param.length,
						messageText: `У класса ${injectableClass.name?.text} отсутствуют зависимости: ${param.name.getText()}`,
						category: ts.DiagnosticCategory.Error,
						code: 9999,
						relatedInformation: [
							{
								category: ts.DiagnosticCategory.Suggestion,
								code: 9999,
								file: referenceModule.sourceFile,
								start: referenceModule.start,
								length: referenceModule.length,
								messageText: `Модуль: ${referenceModule.moduleName}`,
							},
						],
					});
				}

				if (dependencyDeclare?.provide && param.parameterType) {
					const isEqual = compareTypes(
						param.parameterType,
						dependencyDeclare.declaration,
						typeChecker,
					);

					if (!isEqual) {
						diagnostic.push({
							file: sourceFile,
							start: param.start,
							length: param.length,
							messageText: `У зависимости ${param.name.getText()} не совпадают типы`,
							category: ts.DiagnosticCategory.Error,
							code: 9999,
							relatedInformation: [
								{
									category: ts.DiagnosticCategory.Suggestion,
									code: 9999,
									file: referenceModule.sourceFile,
									start: referenceModule.start,
									length: referenceModule.length,
									messageText: `Модуль: ${referenceModule.moduleName}`,
								},
							],
						});
					}
				}
			}

			if (!referenceModules.length) {
				// кейс когда мы указали зависимости в классе, но он не связан ни с одним модулем
				diagnostic.push({
					file: sourceFile,
					start: param.start,
					length: param.length,
					messageText: `У класса ${injectableClass.name?.text} отсутствуют зависимости: ${param.name.getText()}`,
					category: ts.DiagnosticCategory.Error,
					code: 9999,
				});
			}
		}
	}

	return [...originalDiagnostic, ...diagnostic];
};
