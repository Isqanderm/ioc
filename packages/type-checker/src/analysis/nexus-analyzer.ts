import * as ts from "typescript";
import type {
	NexusClass,
	NexusDecorator,
	NexusDecoratorKind,
	NexusDependency,
	NexusModule,
	NexusModuleExport,
	NexusModuleImport,
	NexusProvider,
	NexusSourceSpan,
	NexusToken,
} from "./nexus-semantic-model";

export type {
	NexusClass,
	NexusDecorator,
	NexusDecoratorKind,
	NexusDependency,
	NexusModule,
	NexusModuleExport,
	NexusModuleImport,
	NexusProvider,
	NexusSourceSpan,
	NexusToken,
} from "./nexus-semantic-model";

const NEXUS_CORE_PACKAGE = "@nexus-ioc/core";

type ResolvedNexusDecorator = {
	kind: NexusDecoratorKind;
	expression: ts.Expression;
};

/** Shared semantic model used by Nexus IDE, lint and compiler tooling. */
export class NexusAnalyzer {
	private readonly checker: ts.TypeChecker;

	public constructor(private readonly program: ts.Program) {
		this.checker = program.getTypeChecker();
	}

	public getProgram(): ts.Program {
		return this.program;
	}

	public getTypeChecker(): ts.TypeChecker {
		return this.checker;
	}

	public getClass(node: ts.ClassDeclaration): NexusClass {
		const decorators = this.getDecorators(node);
		const dependencies = this.getInjectedMembers(node);

		return {
			name: node.name?.text,
			source: this.getSourceSpan(node),
			decorators,
			dependencies,
			isInjectable: decorators.some((item) => item.kind === "Injectable"),
			isModule: decorators.some(
				(item) => item.kind === "NsModule" || item.kind === "Global",
			),
			isGlobal: decorators.some((item) => item.kind === "Global"),
		};
	}

	/** @deprecated Use getClass() instead. */
	public getClassModel(node: ts.ClassDeclaration): NexusClass {
		return this.getClass(node);
	}

	public getDecorators(node: ts.Node): NexusDecorator[] {
		if (!ts.canHaveDecorators(node)) {
			return [];
		}

		return (ts.getDecorators(node) ?? []).flatMap((declaration) => {
			const kind = this.resolveDecoratorKind(declaration);
			return kind
				? [
						{
							kind,
							source: this.getSourceSpan(declaration),
						},
					]
				: [];
		});
	}

	public hasDecorator(node: ts.Node, kind: NexusDecoratorKind): boolean {
		return this.getDecorators(node).some((item) => item.kind === kind);
	}

	public getInjectedMembers(node: ts.ClassDeclaration): NexusDependency[] {
		const result: NexusDependency[] = [];
		const add = (
			declaration: ts.ParameterDeclaration | ts.PropertyDeclaration,
			location: "constructor" | "property",
		) => {
			const inject = this.getDecorators(declaration).find(
				(item) => item.kind === "Inject",
			);
			if (!inject) {
				return;
			}

			const tokenExpression = this.getInjectTokenExpression(declaration);
			if (!tokenExpression) return;

			result.push({
				location,
				name: declaration.name.getText(),
				token: this.resolveToken(tokenExpression),
				optional: this.hasDecorator(declaration, "Optional"),
				source: this.getSourceSpan(declaration),
			});
		};

		for (const member of node.members) {
			if (ts.isConstructorDeclaration(member)) {
				for (const parameter of member.parameters) {
					add(parameter, "constructor");
				}
			}
			if (ts.isPropertyDeclaration(member)) {
				add(member, "property");
			}
		}

		return result;
	}

	public getModuleProviders(node: ts.ClassDeclaration): NexusProvider[] {
		const metadata = this.getModuleDecoratorArgument(node);
		if (!metadata) return [];

		const array = this.getObjectLiteralArrayProperty(metadata, "providers");
		if (!array) return [];

		return array.elements.flatMap((element) => this.resolveProvider(element));
	}

	public getModule(node: ts.ClassDeclaration): NexusModule | undefined {
		const metadata = this.getModuleDecoratorArgument(node);
		if (!metadata) return undefined;

		return {
			providers: this.getModuleProviders(node),
			imports: this.getModuleImports(metadata),
			exports: this.getModuleExports(metadata),
		};
	}

	private getModuleImports(
		metadata: ts.ObjectLiteralExpression,
	): NexusModuleImport[] {
		const array = this.getObjectLiteralArrayProperty(metadata, "imports");
		if (!array) return [];

		return array.elements.map((element) => ({
			module: this.resolveModuleReference(element),
			isDynamic: ts.isCallExpression(element),
			source: this.getSourceSpan(element),
		}));
	}

	private getModuleExports(
		metadata: ts.ObjectLiteralExpression,
	): NexusModuleExport[] {
		const array = this.getObjectLiteralArrayProperty(metadata, "exports");
		if (!array) return [];

		return array.elements.map((element) => ({
			token: this.resolveToken(element),
			source: this.getSourceSpan(element),
		}));
	}

	/**
	 * Resolves an `imports` array entry to the module class it refers to.
	 *
	 * A bare class reference (`FooModule`) resolves directly. A dynamic-module
	 * call (`FooModule.forRoot(...)`) is resolved through its *return type's*
	 * `module` property, so the edge still points at the concrete module class
	 * rather than the anonymous `DynamicModule` return value.
	 */
	private resolveModuleReference(expression: ts.Expression): NexusToken {
		const type = this.checker.getTypeAtLocation(expression);
		const moduleProperty = type.getProperty("module");

		if (moduleProperty) {
			const moduleType = this.checker.getTypeOfSymbolAtLocation(
				moduleProperty,
				expression,
			);
			const symbol = moduleType.getSymbol();
			if (symbol) {
				return {
					kind: "reference",
					symbol: this.resolveAlias(symbol) ?? symbol,
					source: this.getSourceSpan(expression),
				};
			}
		}

		return this.resolveToken(expression);
	}

	private getModuleDecoratorArgument(
		node: ts.ClassDeclaration,
	): ts.ObjectLiteralExpression | undefined {
		if (!ts.canHaveDecorators(node)) return undefined;

		for (const decorator of ts.getDecorators(node) ?? []) {
			if (this.resolveDecoratorKind(decorator) !== "NsModule") continue;
			if (!ts.isCallExpression(decorator.expression)) continue;

			const [argument] = decorator.expression.arguments;
			if (argument && ts.isObjectLiteralExpression(argument)) return argument;
		}

		return undefined;
	}

	private getObjectLiteralArrayProperty(
		metadata: ts.ObjectLiteralExpression,
		name: "providers" | "imports" | "exports",
	): ts.ArrayLiteralExpression | undefined {
		const property = this.findProperty(metadata, name);
		return property && ts.isArrayLiteralExpression(property.initializer)
			? property.initializer
			: undefined;
	}

	private findProperty(
		object: ts.ObjectLiteralExpression,
		name: string,
	): ts.PropertyAssignment | undefined {
		return object.properties.find(
			(item): item is ts.PropertyAssignment =>
				ts.isPropertyAssignment(item) &&
				ts.isIdentifier(item.name) &&
				item.name.text === name,
		);
	}

	private resolveProvider(element: ts.Expression): NexusProvider[] {
		const source = this.getSourceSpan(element);

		if (!ts.isObjectLiteralExpression(element)) {
			return [
				{
					kind: "class",
					provide: this.resolveToken(element),
					factoryInject: [],
					source,
				},
			];
		}

		const provideProperty = this.findProperty(element, "provide");
		if (!provideProperty) return [];
		const provide = this.resolveToken(provideProperty.initializer);

		const useClassProperty = this.findProperty(element, "useClass");
		const useValueProperty = this.findProperty(element, "useValue");
		const useFactoryProperty = this.findProperty(element, "useFactory");
		const scopeProperty = this.findProperty(element, "scope");
		const scope = scopeProperty
			? this.resolveToken(scopeProperty.initializer)
			: undefined;

		if (useClassProperty) {
			return [
				{
					kind: "useClass",
					provide,
					useClass: this.resolveToken(useClassProperty.initializer),
					factoryInject: [],
					scope,
					source,
				},
			];
		}

		if (useValueProperty) {
			return [{ kind: "useValue", provide, factoryInject: [], source }];
		}

		if (useFactoryProperty) {
			const injectProperty = this.findProperty(element, "inject");
			const factoryInject =
				injectProperty &&
				ts.isArrayLiteralExpression(injectProperty.initializer)
					? injectProperty.initializer.elements.map((item) =>
							this.resolveToken(item),
						)
					: [];

			return [{ kind: "useFactory", provide, factoryInject, scope, source }];
		}

		return [];
	}

	private getInjectTokenExpression(
		declaration: ts.ParameterDeclaration | ts.PropertyDeclaration,
	): ts.Expression | undefined {
		const decorators = this.getDecoratorsWithExpressions(declaration);
		const inject = decorators.find((item) => item.kind === "Inject");
		if (!inject || !ts.isCallExpression(inject.expression)) return undefined;
		return inject.expression.arguments[0];
	}

	private getDecoratorsWithExpressions(
		node: ts.Node,
	): ResolvedNexusDecorator[] {
		if (!ts.canHaveDecorators(node)) return [];

		return (ts.getDecorators(node) ?? []).flatMap((declaration) => {
			const kind = this.resolveDecoratorKind(declaration);
			return kind
				? [
						{
							kind,
							expression: declaration.expression,
						},
					]
				: [];
		});
	}

	private resolveToken(expression: ts.Expression): NexusToken {
		const source = this.getSourceSpan(expression);

		if (ts.isStringLiteral(expression)) {
			return {
				kind: "string",
				value: expression.text,
				source,
			};
		}

		const symbol = this.checker.getSymbolAtLocation(expression);
		const type = this.checker.getTypeAtLocation(expression);

		if ((type.getFlags() & ts.TypeFlags.ESSymbolLike) !== 0) {
			return {
				kind: "symbol",
				declaration: this.resolveAlias(symbol),
				source,
			};
		}

		if (symbol) {
			return {
				kind: "reference",
				symbol: this.resolveAlias(symbol) ?? symbol,
				source,
			};
		}

		return {
			kind: "expression",
			source,
		};
	}

	private getSourceSpan(node: ts.Node): NexusSourceSpan {
		const start = node.getStart();
		const end = node.getEnd();
		return {
			fileName: node.getSourceFile().fileName,
			start,
			end,
			length: end - start,
		};
	}

	private resolveDecoratorKind(
		decorator: ts.Decorator,
	): NexusDecoratorKind | undefined {
		const callee = this.getDecoratorCallee(decorator.expression);
		if (!callee) return undefined;

		const symbol = this.checker.getSymbolAtLocation(callee);
		if (!symbol || !this.isNexusCoreSymbol(symbol)) return undefined;

		const name = this.resolveAlias(symbol)?.getName();
		return name === "Inject" ||
			name === "Injectable" ||
			name === "NsModule" ||
			name === "Optional" ||
			name === "Global"
			? name
			: undefined;
	}

	private getDecoratorCallee(
		expression: ts.Expression,
	): ts.Identifier | undefined {
		if (ts.isIdentifier(expression)) return expression;
		if (
			ts.isCallExpression(expression) &&
			ts.isIdentifier(expression.expression)
		)
			return expression.expression;
		return undefined;
	}

	private resolveAlias(symbol: ts.Symbol | undefined): ts.Symbol | undefined {
		if (!symbol) return undefined;

		let current = symbol;
		const visited = new Set<ts.Symbol>();
		while (
			(current.flags & ts.SymbolFlags.Alias) !== 0 &&
			!visited.has(current)
		) {
			visited.add(current);
			const next = this.checker.getAliasedSymbol(current);
			if (next === current) break;
			current = next;
		}
		return current;
	}

	private isNexusCoreSymbol(symbol: ts.Symbol): boolean {
		let current: ts.Symbol | undefined = symbol;
		const visited = new Set<ts.Symbol>();
		while (current && !visited.has(current)) {
			visited.add(current);
			for (const declaration of current.declarations ?? []) {
				const importDeclaration = this.findImportDeclaration(declaration);
				if (
					importDeclaration?.moduleSpecifier &&
					ts.isStringLiteral(importDeclaration.moduleSpecifier)
				) {
					return importDeclaration.moduleSpecifier.text === NEXUS_CORE_PACKAGE;
				}
			}
			if ((current.flags & ts.SymbolFlags.Alias) === 0) break;
			const next = this.checker.getAliasedSymbol(current);
			if (next === current) break;
			current = next;
		}
		return false;
	}

	private findImportDeclaration(
		node: ts.Node,
	): ts.ImportDeclaration | undefined {
		let current: ts.Node | undefined = node;
		while (current) {
			if (ts.isImportDeclaration(current)) return current;
			current = current.parent;
		}
		return undefined;
	}
}

export function createNexusAnalyzer(program: ts.Program): NexusAnalyzer {
	return new NexusAnalyzer(program);
}
