import * as ts from "typescript";
import type {
	NexusClassModel,
	NexusDecorator,
	NexusDecoratorKind,
	NexusDependency,
	NexusSourceSpan,
	NexusToken,
} from "./nexus-semantic-model";

export type {
	NexusClassModel,
	NexusDecorator,
	NexusDecoratorKind,
	NexusDependency,
	NexusSourceSpan,
	NexusToken,
} from "./nexus-semantic-model";

const NEXUS_CORE_PACKAGE = "@nexus-ioc/core";

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

	public getClassModel(node: ts.ClassDeclaration): NexusClassModel {
		const decorators = this.getDecorators(node);
		const dependencies = this.getInjectedMembers(node);

		return {
			node,
			name: node.name?.text,
			decorators,
			isInjectable: decorators.some((item) => item.kind === "Injectable"),
			isModule: decorators.some(
				(item) => item.kind === "NsModule" || item.kind === "Global",
			),
			isGlobal: decorators.some((item) => item.kind === "Global"),
			dependencies,
		};
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
							declaration,
							expression: declaration.expression,
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
			if (!inject || !ts.isCallExpression(inject.expression)) {
				return;
			}

			const tokenExpression = inject.expression.arguments[0];
			if (!tokenExpression) return;

			const token = this.resolveToken(tokenExpression);

			result.push({
				location,
				parameterName: declaration.name.getText(),
				parameterType: declaration.type,
				token,
				optional: this.hasDecorator(declaration, "Optional"),
				source: this.getSourceSpan(declaration),
				declaration,
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
