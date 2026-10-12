import {
	CircularDependencyDetectorHelper,
	checkTypesHelper,
	compareTypes,
	type ExportType,
	findTypeReferences,
	InjectableParser,
	type InjectParameterDeclaration,
	InjectParser,
	type ModuleDeclaration,
	ModuleParser,
	ModulesParser,
	type ProviderType,
} from "@nexus-ioc/type-checker";
import * as ts from "typescript/lib/tsserverlibrary";
import type { NsLanguageService } from "../language-service/ns-language-service";

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
					length:
						circular.classDeclaration.getEnd() -
						circular.classDeclaration.getStart(),
					messageText: `Circular dependency path: ${circular.cycle.join(" -> ")}`,
				},
			],
		});
	}

	// Validate factory provider dependencies
	const allModules = ModulesParser.execute(sourceFile);
	const parsedModules = ModuleParser.execute(allModules, typeChecker, tsNsLs);

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
								moduleProvider.provide
									.getText()
									.replaceAll('"', "")
									.replaceAll("'", "") ===
								tokenText.replaceAll('"', "").replaceAll("'", "")
							) {
								found = true;
								break;
							}
						} else if (ts.isIdentifier(injectToken)) {
							if (
								checkTypesHelper(
									moduleProvider.declaration,
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

					// Check in imported modules
					if (!found) {
						for (const importedModule of module.imports) {
							if (ts.isIdentifier(importedModule.declaration)) {
								const references =
									findTypeReferences(importedModule.declaration, tsNsLs) || [];

								for (const reference of references) {
									const importedSourceFile = tsNsLs.tsLS
										.getProgram()
										?.getSourceFile(reference.fileName) as ts.SourceFile;

									if (!importedSourceFile) continue;

									const importedModules = ModulesParser.executeByModuleName(
										importedSourceFile,
										importedModule.declaration,
										typeChecker,
										tsNsLs,
									);
									const importedNsModules = ModuleParser.execute(
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

					// A child module falls back to its declaring module's visibility
					if (!found) {
						found =
							findInDeclaringModules(
								module,
								injectToken,
								tsNsLs,
								typeChecker,
							) !== undefined;
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
		const referenceModules: ModuleDeclaration[] = [];

		for (const reference of references) {
			const sourceFileReference = tsNsLs.tsLS
				.getProgram()
				?.getSourceFile(reference.fileName);

			if (!sourceFileReference) {
				continue;
			}

			const modules = ModulesParser.executeByClassDependency(
				sourceFileReference,
				injectableClass,
				tsNsLs,
			);
			const nsModule = ModuleParser.execute(modules, typeChecker, tsNsLs);

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

								const modules = ModulesParser.executeByModuleName(
									sourceFile,
									module.declaration,
									typeChecker,
									tsNsLs,
								);
								const nsModules = ModuleParser.execute(
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

				// A child module falls back to its declaring module's visibility
				if (!dependencyDeclare) {
					dependencyDeclare = findInDeclaringModules(
						referenceModule,
						param.name,
						tsNsLs,
						typeChecker,
					);
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

				// Perform type checking for found dependencies
				// Skip type checking for optional dependencies - they can accept the provider type or undefined
				if (dependencyDeclare && param.parameterType && !param.isOptional) {
					let declarationNode: ts.Node | undefined;

					// For ProviderType (has 'provide' property), use the declaration
					if ("provide" in dependencyDeclare) {
						declarationNode = dependencyDeclare.declaration;
					}
					// For ExportType (no 'provide' property), use the declaration directly
					else {
						declarationNode = dependencyDeclare.declaration;
					}

					if (declarationNode) {
						const isEqual = compareTypes(
							param.parameterType,
							declarationNode,
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
			}

			// Skip error reporting for optional dependencies in orphan services
			if (!referenceModules.length && !param.isOptional) {
				// Check global modules before reporting error for orphan services
				let foundInGlobalModule = false;
				let globalDependencyDeclare: ExportType | undefined;
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
						globalDependencyDeclare = dependencyDeclare;
						break;
					}
				}

				// Perform type checking for dependencies found in global modules
				// Skip type checking for optional dependencies - they can accept the provider type or undefined
				if (
					globalDependencyDeclare &&
					param.parameterType &&
					!param.isOptional
				) {
					const isEqual = compareTypes(
						param.parameterType,
						globalDependencyDeclare.declaration,
						typeChecker,
					);

					if (!isEqual) {
						diagnostic.push({
							file: sourceFile,
							start: param.start,
							length: param.length,
							messageText: `Type mismatch for dependency '${param.name.getText()}' (found in global module)`,
							category: ts.DiagnosticCategory.Error,
							code: 9999,
						});
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
/** Every `@Module` declared in the program's own (non-declaration,
 * non-`node_modules`) source files. */
function findProjectModules(
	tsNsLs: NsLanguageService,
	typeChecker: ts.TypeChecker,
): ModuleDeclaration[] {
	const program = tsNsLs.tsLS.getProgram();
	if (!program) {
		return [];
	}

	const result: ModuleDeclaration[] = [];
	for (const sourceFile of program.getSourceFiles()) {
		if (
			sourceFile.isDeclarationFile ||
			sourceFile.fileName.includes("node_modules")
		) {
			continue;
		}

		const modules = ModulesParser.execute(sourceFile);
		result.push(...ModuleParser.execute(modules, typeChecker, tsNsLs));
	}

	return result;
}

/** Whether `identifier` names the class `module` was parsed from. */
function refersToModule(
	identifier: ts.Identifier,
	module: ModuleDeclaration,
	typeChecker: ts.TypeChecker,
): boolean {
	let symbol = typeChecker.getSymbolAtLocation(identifier);
	if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
		symbol = typeChecker.getAliasedSymbol(symbol);
	}
	return (
		symbol?.declarations?.some(
			(declaration) =>
				declaration.getSourceFile().fileName === module.sourceFile.fileName &&
				declaration.getStart() === module.start,
		) ?? false
	);
}

function matchesToken(
	token: ts.Expression,
	candidate: ProviderType | ExportType,
	typeChecker: ts.TypeChecker,
	tsNsLs: NsLanguageService,
): boolean {
	if (ts.isStringLiteral(token)) {
		const text = token.text;
		if ("provide" in candidate) {
			return (
				candidate.provideType !== "class" &&
				candidate.provide.getText().replaceAll('"', "").replaceAll("'", "") ===
					text
			);
		}
		return candidate.name?.replaceAll('"', "").replaceAll("'", "") === text;
	}

	return (
		ts.isIdentifier(token) &&
		checkTypesHelper(candidate.declaration, token, typeChecker, tsNsLs)
	);
}

/** `token` among `module`'s own providers or its imports' exports. */
function findInModuleVisibility(
	module: ModuleDeclaration,
	token: ts.Expression,
	projectModules: readonly ModuleDeclaration[],
	tsNsLs: NsLanguageService,
	typeChecker: ts.TypeChecker,
): ProviderType | ExportType | undefined {
	const own = module.providers.find((provider) =>
		matchesToken(token, provider, typeChecker, tsNsLs),
	);
	if (own) return own;

	for (const importEntry of module.imports) {
		if (!ts.isIdentifier(importEntry.declaration)) continue;
		const declaration = importEntry.declaration;

		for (const importedModule of projectModules) {
			if (!refersToModule(declaration, importedModule, typeChecker)) continue;
			const exported = importedModule.exports.find((entry) =>
				matchesToken(token, entry, typeChecker, tsNsLs),
			);
			if (exported) return exported;
		}
	}

	return undefined;
}

/**
 * A module listed in another module's `@Module({ children })` is the root
 * of a child container, which falls back to what the declaring module sees
 * in the parent: its own providers and its imports' exports (global modules
 * are already searched by the caller). The search recurses up the chain of
 * declaring modules. Returns `undefined` for a module nobody declares as a
 * child, so diagnostics for ordinary modules are unchanged.
 */
function findInDeclaringModules(
	childModule: ModuleDeclaration,
	token: ts.Expression,
	tsNsLs: NsLanguageService,
	typeChecker: ts.TypeChecker,
	projectModules?: readonly ModuleDeclaration[],
	visited: Set<string> = new Set(),
): ProviderType | ExportType | undefined {
	const key = `${childModule.sourceFile.fileName}:${childModule.start}`;
	if (visited.has(key)) return undefined;
	visited.add(key);

	const modules = projectModules ?? findProjectModules(tsNsLs, typeChecker);
	const declaringModules = modules.filter((module) =>
		module.children.some((child) =>
			refersToModule(child.declaration, childModule, typeChecker),
		),
	);

	for (const declaringModule of declaringModules) {
		const found =
			findInModuleVisibility(
				declaringModule,
				token,
				modules,
				tsNsLs,
				typeChecker,
			) ??
			findInDeclaringModules(
				declaringModule,
				token,
				tsNsLs,
				typeChecker,
				modules,
				visited,
			);
		if (found) return found;
	}

	return undefined;
}

function findGlobalModules(
	tsNsLs: NsLanguageService,
	typeChecker: ts.TypeChecker,
): ModuleDeclaration[] {
	const program = tsNsLs.tsLS.getProgram();
	if (!program) {
		return [];
	}

	const globalModules: ModuleDeclaration[] = [];
	const sourceFiles = program.getSourceFiles();

	for (const sourceFile of sourceFiles) {
		// Skip declaration files and node_modules
		if (
			sourceFile.isDeclarationFile ||
			sourceFile.fileName.includes("node_modules")
		) {
			continue;
		}

		const modules = ModulesParser.execute(sourceFile);
		const nsModules = ModuleParser.execute(modules, typeChecker, tsNsLs);

		for (const nsModule of nsModules) {
			if (nsModule.isGlobal && nsModule.exports.length > 0) {
				globalModules.push(nsModule);
			}
		}
	}

	return globalModules;
}
