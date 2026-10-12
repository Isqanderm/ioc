import { tsquery } from "@phenomnomnominal/tsquery";
import * as ts from "typescript/lib/tsserverlibrary";
import type { ILanguageServiceLike } from "../types/language-service.interface";

export type ProviderType = {
	provide: ts.Expression | ts.StringLiteral;
	provideType: "class" | "useClass" | "useValue" | "useFactory";
	declaration: ts.Expression | ts.Identifier;
	/** For useFactory providers, this contains the inject array */
	inject?: (ts.Expression | ts.StringLiteral)[];
	start: number;
	end: number;
	length: number;
};

export type ImportType = {
	importType: "local" | "feature" | "global";
	declaration: ts.Expression;
	start: number;
	end: number;
	length: number;
};

export type ExportType = {
	name?: string;
	scope: "internal" | "external";
	declaration: ts.Identifier | ts.StringLiteral;
	start: number;
	end: number;
	length: number;
	illegal: boolean;
};

/** An `@Module({ children })` entry, reduced to the identifier naming the
 * child module class: the entry itself for a direct reference, or `X` in a
 * `lazy(() => import("…").then((m) => m.X))` /
 * `lazy(async () => (await import("…")).X)` loader. Entries of any other
 * shape are left out. */
export type ChildType = {
	declaration: ts.Identifier;
	isLazy: boolean;
	start: number;
	end: number;
	length: number;
};

export type ModuleDeclaration = {
	moduleName: string;
	providers: ProviderType[];
	imports: ImportType[];
	exports: ExportType[];
	children: ChildType[];
	isGlobal: boolean;
	start: number;
	end: number;
	length: number;
	sourceFile: ts.SourceFile;
};

const findPropertyInObject = (obj: ts.ObjectLiteralExpression, key: string) =>
	obj.properties.find((property) => {
		if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
			return property.name.text === key;
		}

		if (ts.isMethodDeclaration(property) && ts.isIdentifier(property.name)) {
			return property.name.text === key;
		}

		return false;
	});

/**
 * Parser for @Module decorator metadata
 *
 * Extracts and analyzes module declarations including providers, imports, and exports.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: static-only class provides namespace for related parsing methods
export class ModuleParser {
	/**
	 * Parses @Module decorators from class declarations
	 *
	 * @param modules - Array of class declarations with @Module decorators
	 * @param typeChecker - TypeScript type checker for type analysis
	 * @param tsNsLs - The Nexus IoC Language Service instance
	 * @returns Array of parsed module declarations with providers, imports, and exports
	 */
	public static execute(
		modules: ts.ClassDeclaration[],
		typeChecker: ts.TypeChecker,
		tsNsLs: ILanguageServiceLike,
	): ModuleDeclaration[] {
		const result: ModuleDeclaration[] = [];

		for (const module of modules) {
			const moduleName = ModuleParser.getModuleName(module);

			if (!ModuleParser) {
				continue;
			}

			const start = module.getStart();
			const end = module.getEnd();
			const length = end - start;
			const { providers, imports, exports, children } =
				ModuleParser.getModuleDecoratorValue(module, typeChecker, tsNsLs);
			const isGlobal = ModuleParser.hasGlobalDecorator(module);
			const sourceFile = module.getSourceFile();

			result.push({
				moduleName,
				providers,
				imports,
				exports,
				children,
				isGlobal,
				start,
				end,
				length,
				sourceFile,
			});
		}

		return result;
	}

	private static getModuleName(classDeclaration: ts.ClassDeclaration) {
		return classDeclaration.name?.getText() as string;
	}

	/**
	 * Checks if a class has the @Global() decorator
	 *
	 * @param classDeclaration - The class declaration to check
	 * @returns true if the class has @Global() or @Global decorator
	 */
	private static hasGlobalDecorator(
		classDeclaration: ts.ClassDeclaration,
	): boolean {
		if (!classDeclaration.modifiers) {
			return false;
		}

		for (const modifier of classDeclaration.modifiers) {
			if (ts.isDecorator(modifier)) {
				const expression = modifier.expression;
				// Handle @Global() - call expression
				if (ts.isCallExpression(expression)) {
					const identifier = expression.expression;
					if (ts.isIdentifier(identifier) && identifier.text === "Global") {
						return true;
					}
				}
				// Handle @Global - identifier (without parentheses)
				else if (ts.isIdentifier(expression) && expression.text === "Global") {
					return true;
				}
			}
		}

		return false;
	}

	private static getModuleDecoratorValue(
		classDeclaration: ts.ClassDeclaration,
		typeChecker: ts.TypeChecker,
		tsNsLs: ILanguageServiceLike,
	) {
		const [decoratorValue] =
			tsquery.query<ts.ObjectLiteralExpression>(
				classDeclaration,
				`CallExpression:has(Identifier[name="Module"]) > ObjectLiteralExpression`,
			) || [];

		const providersRaw = decoratorValue.properties.find(
			(item) => item.name?.getText() === "providers",
		) as ts.PropertyAssignment;
		const importsRaw = decoratorValue.properties.find(
			(item) => item.name?.getText() === "imports",
		) as ts.PropertyAssignment;
		const exportsRaw = decoratorValue.properties.find(
			(item) => item.name?.getText() === "exports",
		) as ts.PropertyAssignment;
		const childrenRaw = decoratorValue.properties.find(
			(item) => item.name?.getText() === "children",
		) as ts.PropertyAssignment;

		const providers = providersRaw?.initializer
			? ModuleParser.parseProviders(
					providersRaw.initializer as ts.ArrayLiteralExpression,
					tsNsLs,
				)
			: [];
		const imports = importsRaw?.initializer
			? ModuleParser.parseImports(
					importsRaw.initializer as ts.ArrayLiteralExpression,
					tsNsLs,
				)
			: [];
		const exports = exportsRaw?.initializer
			? ModuleParser.parseExports(
					exportsRaw.initializer as ts.ArrayLiteralExpression,
					providers,
					typeChecker,
					tsNsLs,
				)
			: [];

		const children =
			childrenRaw?.initializer &&
			ts.isArrayLiteralExpression(childrenRaw.initializer)
				? ModuleParser.parseChildren(childrenRaw.initializer, typeChecker)
				: [];

		return {
			imports,
			exports,
			providers,
			children,
		};
	}

	private static parseChildren(
		children: ts.ArrayLiteralExpression,
		typeChecker: ts.TypeChecker,
	): ChildType[] {
		const result: ChildType[] = [];

		for (const element of children.elements) {
			const lazyCall = ModuleParser.findLazyCall(element, typeChecker);
			const declaration = lazyCall
				? ModuleParser.getLazyExportName(lazyCall)
				: ts.isIdentifier(element)
					? element
					: undefined;
			if (!declaration) continue;

			const start = element.getStart();
			const end = element.getEnd();
			result.push({
				declaration,
				isLazy: lazyCall !== undefined,
				start,
				end,
				length: end - start,
			});
		}

		return result;
	}

	/** The `lazy(...)` call an entry stands for: the entry itself, or the
	 * initializer of the `const` it names (looked up in the same file, then
	 * through the type checker when one is available). */
	private static findLazyCall(
		element: ts.Expression,
		typeChecker: ts.TypeChecker,
	): ts.CallExpression | undefined {
		if (ts.isCallExpression(element)) {
			return ModuleParser.isLazyCall(element) ? element : undefined;
		}
		if (!ts.isIdentifier(element)) return undefined;

		let initializer = ModuleParser.findLocalConstInitializer(element);
		if (!initializer && typeof typeChecker.getSymbolAtLocation === "function") {
			let symbol = typeChecker.getSymbolAtLocation(element);
			if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
				symbol = typeChecker.getAliasedSymbol(symbol);
			}
			const declaration = symbol?.valueDeclaration;
			if (declaration && ts.isVariableDeclaration(declaration)) {
				initializer = declaration.initializer;
			}
		}

		return initializer &&
			ts.isCallExpression(initializer) &&
			ModuleParser.isLazyCall(initializer)
			? initializer
			: undefined;
	}

	private static findLocalConstInitializer(
		identifier: ts.Identifier,
	): ts.Expression | undefined {
		for (const statement of identifier.getSourceFile().statements) {
			if (!ts.isVariableStatement(statement)) continue;
			for (const declaration of statement.declarationList.declarations) {
				if (
					ts.isIdentifier(declaration.name) &&
					declaration.name.text === identifier.text
				) {
					return declaration.initializer;
				}
			}
		}
		return undefined;
	}

	private static isLazyCall(call: ts.CallExpression): boolean {
		return ts.isIdentifier(call.expression) && call.expression.text === "lazy";
	}

	/** `X` in `() => import("…").then((m) => m.X)` or
	 * `async () => (await import("…")).X`; `undefined` for any other shape. */
	private static getLazyExportName(
		call: ts.CallExpression,
	): ts.Identifier | undefined {
		const loader = call.arguments[0];
		if (
			!loader ||
			!(ts.isArrowFunction(loader) || ts.isFunctionExpression(loader))
		) {
			return undefined;
		}

		const result = ModuleParser.skipParentheses(
			ModuleParser.getReturnedExpression(loader),
		);
		if (!result) return undefined;

		if (ts.isPropertyAccessExpression(result)) {
			const target = ModuleParser.skipParentheses(result.expression);
			return target &&
				ts.isAwaitExpression(target) &&
				ModuleParser.isDynamicImport(target.expression) &&
				ts.isIdentifier(result.name)
				? result.name
				: undefined;
		}

		if (
			!ts.isCallExpression(result) ||
			!ts.isPropertyAccessExpression(result.expression) ||
			result.expression.name.text !== "then" ||
			!ModuleParser.isDynamicImport(result.expression.expression)
		) {
			return undefined;
		}

		const callback = result.arguments[0];
		if (
			!callback ||
			!(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
		) {
			return undefined;
		}
		const parameter = callback.parameters[0];
		const access = ModuleParser.skipParentheses(
			ModuleParser.getReturnedExpression(callback),
		);
		return parameter &&
			ts.isIdentifier(parameter.name) &&
			access &&
			ts.isPropertyAccessExpression(access) &&
			ts.isIdentifier(access.expression) &&
			access.expression.text === parameter.name.text &&
			ts.isIdentifier(access.name)
			? access.name
			: undefined;
	}

	private static isDynamicImport(expression: ts.Expression): boolean {
		const node = ModuleParser.skipParentheses(expression);
		return (
			node !== undefined &&
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword
		);
	}

	private static getReturnedExpression(
		fn: ts.ArrowFunction | ts.FunctionExpression,
	): ts.Expression | undefined {
		if (!ts.isBlock(fn.body)) return fn.body;
		if (fn.body.statements.length !== 1) return undefined;
		const [statement] = fn.body.statements;
		return ts.isReturnStatement(statement) ? statement.expression : undefined;
	}

	private static skipParentheses(
		expression: ts.Expression | undefined,
	): ts.Expression | undefined {
		let current = expression;
		while (current && ts.isParenthesizedExpression(current)) {
			current = current.expression;
		}
		return current;
	}

	private static parseImports(
		imports: ts.ArrayLiteralExpression,
		_tsNsLs: ILanguageServiceLike,
	) {
		const result: ImportType[] = [];

		imports.forEachChild((child) => {
			if (ts.isIdentifier(child) || ts.isCallExpression(child)) {
				const start = child.getStart();
				const end = child.getEnd();
				const length = end - start;
				let importType: ImportType["importType"] | null = null;
				let type: ts.Identifier | null = ts.isIdentifier(child) ? child : null;

				if (ts.isIdentifier(child)) {
					importType = "local";
				} else if (ts.isCallExpression(child)) {
					const [typeNode] = tsquery<ts.Identifier>(
						child,
						"PropertyAccessExpression Identifier",
					);

					type = typeNode;

					const isFeature = Boolean(
						tsquery(
							child,
							`PropertyAccessExpression Identifier[name="forFeature"]`,
						)?.length,
					);
					const isRoot = Boolean(
						tsquery(
							child,
							`PropertyAccessExpression Identifier[name="forRoot"]`,
						)?.length,
					);

					if (isFeature) {
						importType = "feature";
					} else if (isRoot) {
						importType = "global";
					}
				}

				if (!importType || !type) {
					return;
				}

				result.push({
					importType,
					start,
					end,
					length,
					declaration: type,
				});
				return;
			}
		});

		return result;
	}

	private static parseExports(
		exports: ts.ArrayLiteralExpression,
		providers: ProviderType[],
		typeChecker: ts.TypeChecker,
		_tsNsLs: ILanguageServiceLike,
	) {
		const result: ExportType[] = [];

		exports.forEachChild((child) => {
			if (ts.isIdentifier(child)) {
				const type = child;
				const start = child.getStart();
				const end = child.getEnd();
				const length = end - start;
				let importType = "external";

				for (const provider of providers) {
					const type1 = typeChecker.getTypeAtLocation(provider.declaration);
					const type2 = typeChecker.getTypeAtLocation(type);
					if (
						typeChecker.isTypeAssignableTo(type1, type2) &&
						typeChecker.isTypeAssignableTo(type2, type1) &&
						child.getText() === provider.provide.getText()
					) {
						importType = "internal";
					}
				}

				result.push({
					scope: importType as ExportType["scope"],
					declaration: type,
					start,
					end,
					length,
					illegal: false,
				});
				return;
			}

			if (ts.isStringLiteral(child)) {
				const type = child;
				const start = child.getStart();
				const end = child.getEnd();
				const length = end - start;
				let depType = "external";

				for (const provider of providers) {
					if (
						provider.provide
							?.getText()
							.replaceAll('"', "")
							.replaceAll("'", "") === type.text
					) {
						depType = "internal";
					}
				}

				result.push({
					name: type.getText(),
					scope: depType as ExportType["scope"],
					start,
					end,
					length,
					declaration: type,
					illegal: depType === "external",
				});
				return;
			}
		});

		return result;
	}

	private static parseProviders(
		providers: ts.ArrayLiteralExpression,
		tsNsLs: ILanguageServiceLike,
	) {
		const result: ProviderType[] = [];

		providers.forEachChild((child) => {
			if (ts.isIdentifier(child)) {
				const start = child.getStart();
				const end = child.getEnd();
				const length = end - start;

				result.push({
					provide: child,
					provideType: "class",
					start,
					end,
					length,
					declaration: child,
				});
				return;
			}

			if (ts.isObjectLiteralExpression(child)) {
				const provider = ModuleParser.parseUseProvider(child, tsNsLs);

				if (provider) {
					result.push(provider);
				}

				return;
			}
		});

		return result;
	}

	private static parseUseProvider(
		provider: ts.ObjectLiteralExpression,
		_tsNsLs: ILanguageServiceLike,
	): ProviderType | null {
		const provideNameNode = findPropertyInObject(provider, "provide");
		const provideUseClassNode = findPropertyInObject(provider, "useClass");
		const provideUseValueNode = findPropertyInObject(provider, "useValue");
		const provideUseFactoryNode = findPropertyInObject(provider, "useFactory");
		const provideInjectNode = findPropertyInObject(provider, "inject");
		const providerNode =
			provideUseClassNode || provideUseValueNode || provideUseFactoryNode;

		if (!provideNameNode || !providerNode) {
			return null;
		}

		let provide: null | ts.StringLiteral | ts.Expression = null;

		if (
			ts.isPropertyAssignment(provideNameNode) &&
			ts.isStringLiteral(provideNameNode.initializer)
		) {
			provide = provideNameNode.initializer;
		} else if (
			ts.isPropertyAssignment(provideNameNode) &&
			ts.isExpression(provideNameNode.initializer)
		) {
			provide = provideNameNode.initializer;
		}

		const providerTypeLink = ts.isPropertyAssignment(providerNode)
			? providerNode.initializer
			: null;

		if (!provide || !providerTypeLink) {
			return null;
		}

		const start = provideNameNode.getStart();
		const end = provideNameNode.getEnd();
		const length = end - start;

		let provideType: ProviderType["provideType"] | null = null;

		if (provideUseClassNode) {
			provideType = "useClass";
		} else if (provideUseValueNode) {
			provideType = "useValue";
		} else if (provideUseFactoryNode) {
			provideType = "useFactory";
		}

		if (!provideType) {
			return null;
		}

		// Parse inject array for factory providers
		let inject: (ts.Expression | ts.StringLiteral)[] | undefined;
		if (
			provideType === "useFactory" &&
			provideInjectNode &&
			ts.isPropertyAssignment(provideInjectNode) &&
			ts.isArrayLiteralExpression(provideInjectNode.initializer)
		) {
			const injectArray: (ts.Expression | ts.StringLiteral)[] = [];
			provideInjectNode.initializer.elements.forEach((element) => {
				if (ts.isStringLiteral(element) || ts.isIdentifier(element)) {
					injectArray.push(element);
				}
			});
			// Only set inject if we found elements
			if (injectArray.length > 0) {
				inject = injectArray;
			}
		}

		return {
			provide,
			provideType,
			declaration: providerTypeLink,
			inject,
			start,
			end,
			length,
		};
	}
}
