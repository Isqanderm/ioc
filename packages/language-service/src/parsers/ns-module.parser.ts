import { tsquery } from "@phenomnomnominal/tsquery";
import * as ts from "typescript/lib/tsserverlibrary";
import type { NsLanguageService } from "../language-service/ns-language-service";

export type ProviderType = {
	provide: ts.Expression | ts.StringLiteral;
	provideType: "class" | "useClass" | "useValue" | "useFactory";
	declaration: ts.Expression | ts.Identifier;
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

export type NsModuleDeclaration = {
	moduleName: string;
	providers: ProviderType[];
	imports: ImportType[];
	exports: ExportType[];
	start: number;
	end: number;
	length: number;
	sourceFile: ts.SourceFile;
};

const findPropertyInObject = (obj: ts.ObjectLiteralExpression, key: string) =>
	obj.properties.find((property) => {
		return obj.properties.find((property) => {
			if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
				return property.name.text === key;
			}

			if (ts.isMethodDeclaration(property) && ts.isIdentifier(property.name)) {
				return property.name.text === key;
			}

			return false;
		});
	});

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class NsModuleParser {
	public static execute(
		modules: ts.ClassDeclaration[],
		typeChecker: ts.TypeChecker,
		tsNsLs: NsLanguageService,
	): NsModuleDeclaration[] {
		const result: NsModuleDeclaration[] = [];

		for (const module of modules) {
			const moduleName = NsModuleParser.getNsModuleName(module);

			if (!NsModuleParser) {
				continue;
			}

			const start = module.getStart();
			const end = module.getEnd();
			const length = end - start;
			const { providers, imports, exports } =
				NsModuleParser.getNsModuleDecoratorValue(module, typeChecker, tsNsLs);
			const sourceFile = module.getSourceFile();

			result.push({
				moduleName,
				providers,
				imports,
				exports,
				start,
				end,
				length,
				sourceFile,
			});
		}

		return result;
	}

	private static getNsModuleName(classDeclaration: ts.ClassDeclaration) {
		return classDeclaration.name?.getText() as string;
	}

	private static getNsModuleDecoratorValue(
		classDeclaration: ts.ClassDeclaration,
		typeChecker: ts.TypeChecker,
		tsNsLs: NsLanguageService,
	) {
		const [decoratorValue] =
			tsquery.query<ts.ObjectLiteralExpression>(
				classDeclaration,
				`CallExpression:has(Identifier[name="NsModule"]) > ObjectLiteralExpression`,
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

		const providers = providersRaw?.initializer
			? NsModuleParser.parseProviders(
					providersRaw.initializer as ts.ArrayLiteralExpression,
					tsNsLs,
				)
			: [];
		const imports = importsRaw?.initializer
			? NsModuleParser.parseImports(
					importsRaw.initializer as ts.ArrayLiteralExpression,
					tsNsLs,
				)
			: [];
		const exports = exportsRaw?.initializer
			? NsModuleParser.parseExports(
					exportsRaw.initializer as ts.ArrayLiteralExpression,
					providers,
					typeChecker,
					tsNsLs,
				)
			: [];

		return {
			imports,
			exports,
			providers,
		};
	}

	private static parseImports(
		imports: ts.ArrayLiteralExpression,
		tsNsLs: NsLanguageService,
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
		tsNsLs: NsLanguageService,
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
		tsNsLs: NsLanguageService,
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
				const provider = NsModuleParser.parseUseProvider(child, tsNsLs);

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
		tsNsLs: NsLanguageService,
	): ProviderType | null {
		const provideNameNode = findPropertyInObject(provider, "provide");
		const provideUseClassNode = findPropertyInObject(provider, "useClass");
		const provideUseValueNode = findPropertyInObject(provider, "useValue");
		const provideUseFactoryNode = findPropertyInObject(provider, "useFactory");
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

		return {
			provide,
			provideType,
			declaration: providerTypeLink,
			start,
			end,
			length,
		};
	}
}
