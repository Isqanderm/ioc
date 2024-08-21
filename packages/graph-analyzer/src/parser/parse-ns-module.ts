import { ast, query } from "@phenomnomnominal/tsquery";
import * as ts from "typescript";
import type { ProvidersInterface } from "../interfaces/providers.interface";
import { ParseImports } from "./parse-imports";
import type { ParseTsConfig } from "./parse-ts-config";
import { ProvidersParser } from "./provider/providers-parser";

type NsModuleArgs = {
	imports: string[];
	exports: string[];
	providers: string[];
};

export class ParseNsModule {
	private readonly classNodeWithModuleDecoratorModule =
		`ClassDeclaration:has(Decorator:has(CallExpression:has(Identifier[name="NsModule"])))`;
	private readonly ast: ReturnType<typeof ast>;
	private readonly _imports: string[] = [];
	private readonly _providers: ProvidersInterface[] = [];
	private readonly _exports: string[] = [];
	private readonly _deps: string[] = [];
	private readonly _modules = new Map<string, NsModuleArgs>();

	constructor(
		private readonly sourceFile: ts.SourceFile,
		private readonly currentFilePath: string,
		private readonly tsConfig: ParseTsConfig,
	) {
		this.ast = ast(sourceFile.text);
	}

	private findNsModulesImports(imports: string[]) {
		return new ParseImports(
			this.sourceFile,
			this.currentFilePath,
			this.tsConfig,
		).findAllNsModuleImports(imports);
	}

	private findClassWithNsModule() {
		const nodes = query(this.ast, this.classNodeWithModuleDecoratorModule);

		for (const node of nodes) {
			if (ts.isClassDeclaration(node)) {
				const moduleName = node.name?.text;

				if (!moduleName) {
					throw new Error("Module name can`t be empty");
				}

				if (ts.canHaveDecorators(node)) {
					const decorators = ts.getDecorators(node) || [];

					for (const decorator of decorators) {
						if (ts.isCallExpression(decorator.expression)) {
							const expression = decorator.expression;

							if (
								ts.isIdentifier(expression.expression) &&
								expression.expression.text === "NsModule"
							) {
								const args = expression.arguments;

								if (args.length && ts.isObjectLiteralExpression(args[0])) {
									const properties = args[0] as ts.ObjectLiteralExpression;

									const nsModuleArguments =
										this.parseNsModuleProperties(properties);

									this._imports.push(...nsModuleArguments.imports);
									this._providers.push(
										...this.parseProviders(nsModuleArguments.providers),
									);
									this._exports.push(...nsModuleArguments.exports);
									this._deps.push(
										...this.findNsModulesImports(nsModuleArguments.imports),
									);

									this._modules.set(moduleName, nsModuleArguments);
								}
							}
						}
					}
				}
			}
		}
	}

	private parseNsModuleProperties(properties: ts.ObjectLiteralExpression) {
		const args: NsModuleArgs = {
			imports: [],
			exports: [],
			providers: [],
		};

		for (const property of properties.properties) {
			if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
				const nodes = (
					property.initializer as ts.ArrayLiteralExpression
				).elements.map((element) => {
					return element.getText();
				});

				if (property.name.text === "imports") {
					args.imports.push(...nodes);
				} else if (property.name.text === "providers") {
					args.providers.push(...nodes);
				} else if (property.name.text === "exports") {
					args.exports.push(...nodes);
				}
			}
		}

		return args;
	}

	private parseProviders(providers: string[]) {
		return new ProvidersParser(providers).parse();
	}

	public parse() {
		this.findClassWithNsModule();
	}

	get imports(): string[] {
		return this._imports;
	}

	get modules(): Map<string, NsModuleArgs> {
		return this._modules;
	}

	get providers() {
		return this._providers;
	}

	get exports() {
		return this._exports;
	}

	get deps() {
		return this._deps;
	}
}
