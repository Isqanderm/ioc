import * as ts from "typescript/lib/tsserverlibrary";
import { CircularDependencyDetectorHelper } from "../helpers/circular-dependency-detector.helper";
import { checkTypesHelper } from "../helpers/check-types.helper";
import { compareTypes } from "../helpers/compare-types.helper";
import { findTypeReferences } from "../helpers/find-type-references.helper";
import type { NsLanguageService } from "../language-service/ns-language-service";
import { type InjectParameterDeclaration, InjectParser } from "../parsers/inject.parser";
import { InjectableParser } from "../parsers/injectable.parser";
import {
	type ExportType,
	type NsModuleDeclaration,
	NsModuleParser,
	type ProviderType,
} from "../parsers/ns-module.parser";
import { NsModulesParser } from "../parsers/ns-modules.parser";

/**
 * Generates semantic diagnostics for Nexus IoC dependency injection
 *
 * Analyzes @Injectable classes and their @Inject decorators to detect:
 * - Missing dependencies (not provided in any module)
 * - Type mismatches between injected and provided types
 * - Services not connected to any module
 * - Circular dependencies
 *
 * @param fileName - The source file to analyze
 * @param tsNsLs - The Nexus IoC Language Service instance
 * @returns Array of TypeScript diagnostics including original diagnostics and DI-specific errors
 */
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

	// Build a map of class names to their inject parameters for circular dependency detection
	const paramsMap = new Map<string, InjectParameterDeclaration[]>();

	for (const injectableClass of injectableClasses) {
		const params = InjectParser.execute(injectableClass, tsNsLs.logger);
		const className = injectableClass.name?.text;
		if (className && params.length > 0) {
			paramsMap.set(className, params);
		}
	}

	// Check for circular dependencies
	const circularDetector = new CircularDependencyDetectorHelper();
	const circularAnalysis = circularDetector.detectCircularDependencies(
		injectableClasses,
		paramsMap,
	);

	// Add circular dependency diagnostics
	for (const circular of circularAnalysis.circularDependencies) {
		diagnostic.push({
			file: sourceFile,
			start: circular.circularParam.start,
			length: circular.circularParam.length,
			messageText: `${circular.message}. Consider using forwardRef() to resolve this circular dependency.`,
			category: ts.DiagnosticCategory.Error,
			code: 9998,
			relatedInformation: [
				{
					category: ts.DiagnosticCategory.Suggestion,
					code: 9998,
					file: sourceFile,
					start: circular.classDeclaration.getStart(),
					length: circular.classDeclaration.getEnd() - circular.classDeclaration.getStart(),
					messageText: `Circular dependency path: ${circular.cycle.join(" -> ")}`,
				},
			],
		});
	}

	// Validate factory provider dependencies
	const allModules = NsModulesParser.execute(sourceFile);
	const parsedModules = NsModuleParser.execute(allModules, typeChecker, tsNsLs);

	for (const module of parsedModules) {
		for (const provider of module.providers) {
			if (provider.provideType === "useFactory" && provider.inject) {
				// Validate each dependency in the inject array
				for (const injectToken of provider.inject) {
					const tokenText = injectToken.getText();
					let found = false;

					// Check if the dependency exists in the same module
					for (const moduleProvider of module.providers) {
						if (ts.isStringLiteral(injectToken)) {
							if (
								moduleProvider.provide.getText().replaceAll('"', "").replaceAll("'", "") ===
								tokenText.replaceAll('"', "").replaceAll("'", "")
							) {
								found = true;
								break;
							}
						} else if (ts.isIdentifier(injectToken)) {
							if (checkTypesHelper(moduleProvider.declaration, injectToken, typeChecker, tsNsLs)) {
								found = true;
								break;
							}
						}
					}

					// Check in imported modules
					if (!found) {
						for (const importedModule of module.imports) {
							if (ts.isIdentifier(importedModule.declaration)) {
								const references = findTypeReferences(importedModule.declaration, tsNsLs) || [];

								for (const reference of references) {
									const importedSourceFile = tsNsLs.tsLS
										.getProgram()
										?.getSourceFile(reference.fileName) as ts.SourceFile;

									if (!importedSourceFile) continue;

									const importedModules = NsModulesParser.executeByModuleName(
										importedSourceFile,
										importedModule.declaration,
										typeChecker,
										tsNsLs,
									);
									const importedNsModules = NsModuleParser.execute(
										importedModules,
										typeChecker,
										tsNsLs,
									);

									for (const importedNsModule of importedNsModules) {
										for (const exportedProvider of importedNsModule.exports) {
											if (ts.isStringLiteral(injectToken)) {
												if (exportedProvider.name === tokenText) {
													found = true;
													break;
												}
											} else if (ts.isIdentifier(injectToken)) {
												if (
													checkTypesHelper(
														exportedProvider.declaration,
														injectToken,
														typeChecker,
														tsNsLs,
													)
												) {
													found = true;
													break;
												}
											}
										}
										if (found) break;
									}
									if (found) break;
								}
								if (found) break;
							}
						}
					}

					// Check in global modules
					if (!found) {
						const globalModules = findGlobalModules(tsNsLs, typeChecker);
						for (const globalModule of globalModules) {
							for (const exportedProvider of globalModule.exports) {
								if (ts.isStringLiteral(injectToken)) {
									if (exportedProvider.name === tokenText) {
										found = true;
										break;
									}
								} else if (ts.isIdentifier(injectToken)) {
									if (
										checkTypesHelper(
											exportedProvider.declaration,
											injectToken,
											typeChecker,
											tsNsLs,
										)
									) {
										found = true;
										break;
									}
								}
							}
							if (found) break;
						}
					}

					if (!found) {
						diagnostic.push({
							file: sourceFile,
							start: injectToken.getStart(),
							length: injectToken.getEnd() - injectToken.getStart(),
							messageText: `Factory provider dependency '${tokenText}' is not provided in module '${module.moduleName}'`,
							category: ts.DiagnosticCategory.Error,
							code: 9999,
							relatedInformation: [
								{
									category: ts.DiagnosticCategory.Suggestion,
									code: 9999,
									file: sourceFile,
									start: provider.start,
									length: provider.length,
									messageText: `Factory provider: ${provider.provide.getText()}`,
								},
							],
						});
					}
				}
			}
		}
	}

	// Process each injectable class for missing dependencies and type mismatches
	for (const injectableClass of injectableClasses) {
		const className = injectableClass.name?.text;
		const params = className ? paramsMap.get(className) : undefined;

		if (!params || !params.length) {
			continue;
		}

		tsNsLs.logger.log(
			`[NsLanguageServer][getSemanticDiagnostics][params] ${params.length}`,
		);

		const references = findTypeReferences(injectableClass, tsNsLs);
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
				tsNsLs,
			);
			const nsModule = NsModuleParser.execute(modules, typeChecker, tsNsLs);

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
								tsNsLs,
							);
						}

						return false;
					});

				if (!dependencyDeclare) {
					referenceModule.imports.forEach((module) => {
						if (ts.isIdentifier(module.declaration)) {
							const references =
								findTypeReferences(module.declaration, tsNsLs) || [];

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
									tsNsLs,
								);
								const nsModules = NsModuleParser.execute(
									modules,
									typeChecker,
									tsNsLs,
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
												tsNsLs,
											);
										}

										return false;
									});
								}
							}
						}
					});
				}

				// Search global modules if dependency not found
				if (!dependencyDeclare) {
					const globalModules = findGlobalModules(tsNsLs, typeChecker);

					for (const globalModule of globalModules) {
						dependencyDeclare = globalModule.exports.find((provider) => {
							if (ts.isStringLiteral(param.name)) {
								return provider.name === param.name.getText();
							}

							if (ts.isIdentifier(param.name)) {
								return checkTypesHelper(
									provider.declaration,
									param.name,
									typeChecker,
									tsNsLs,
								);
							}

							return false;
						});

						if (dependencyDeclare) {
							break;
						}
					}
				}

				// Skip error reporting for optional dependencies
				if (!dependencyDeclare && !param.isOptional) {
					diagnostic.push({
						file: sourceFile,
						start: param.start,
						length: param.length,
						messageText: `Class '${injectableClass.name?.text}' is missing dependency: ${param.name.getText()}`,
						category: ts.DiagnosticCategory.Error,
						code: 9999,
						relatedInformation: [
							{
								category: ts.DiagnosticCategory.Suggestion,
								code: 9999,
								file: referenceModule.sourceFile,
								start: referenceModule.start,
								length: referenceModule.length,
								messageText: `Module: ${referenceModule.moduleName}`,
							},
						],
					});
				}

				// Check if dependencyDeclare is a ProviderType (has 'provide' property)
				if (
					dependencyDeclare &&
					"provide" in dependencyDeclare &&
					dependencyDeclare.provide &&
					param.parameterType
				) {
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
							messageText: `Type mismatch for dependency '${param.name.getText()}'`,
							category: ts.DiagnosticCategory.Error,
							code: 9999,
							relatedInformation: [
								{
									category: ts.DiagnosticCategory.Suggestion,
									code: 9999,
									file: referenceModule.sourceFile,
									start: referenceModule.start,
									length: referenceModule.length,
									messageText: `Module: ${referenceModule.moduleName}`,
								},
							],
						});
					}
				}
			}

			// Skip error reporting for optional dependencies in orphan services
			if (!referenceModules.length && !param.isOptional) {
				// Check global modules before reporting error for orphan services
				let foundInGlobalModule = false;
				const globalModules = findGlobalModules(tsNsLs, typeChecker);

				for (const globalModule of globalModules) {
					const dependencyDeclare = globalModule.exports.find((provider) => {
						if (ts.isStringLiteral(param.name)) {
							return provider.name === param.name.getText();
						}

						if (ts.isIdentifier(param.name)) {
							return checkTypesHelper(
								provider.declaration,
								param.name,
								typeChecker,
								tsNsLs,
							);
						}

						return false;
					});

					if (dependencyDeclare) {
						foundInGlobalModule = true;
						break;
					}
				}

				// Only report error if not found in global modules
				if (!foundInGlobalModule) {
					// Case when we specified dependencies in the class, but it is not connected to any module
					diagnostic.push({
						file: sourceFile,
						start: param.start,
						length: param.length,
						messageText: `Class '${injectableClass.name?.text}' is missing dependency: ${param.name.getText()}`,
						category: ts.DiagnosticCategory.Error,
						code: 9999,
					});
				}
			}
		}
	}

	return [...originalDiagnostic, ...diagnostic];
};

/**
 * Finds all global modules in the project
 *
 * Searches through all source files in the program to find modules
 * decorated with @Global() that export providers.
 *
 * @param tsNsLs - The Nexus IoC Language Service instance
 * @param typeChecker - TypeScript type checker for type analysis
 * @returns Array of global module declarations
 */
function findGlobalModules(
	tsNsLs: NsLanguageService,
	typeChecker: ts.TypeChecker,
): NsModuleDeclaration[] {
	const program = tsNsLs.tsLS.getProgram();
	if (!program) {
		return [];
	}

	const globalModules: NsModuleDeclaration[] = [];
	const sourceFiles = program.getSourceFiles();

	for (const sourceFile of sourceFiles) {
		// Skip declaration files and node_modules
		if (sourceFile.isDeclarationFile || sourceFile.fileName.includes("node_modules")) {
			continue;
		}

		const modules = NsModulesParser.execute(sourceFile);
		const nsModules = NsModuleParser.execute(modules, typeChecker, tsNsLs);

		for (const nsModule of nsModules) {
			if (nsModule.isGlobal && nsModule.exports.length > 0) {
				globalModules.push(nsModule);
			}
		}
	}

	return globalModules;
}
