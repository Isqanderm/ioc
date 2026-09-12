import * as ts from "typescript/lib/tsserverlibrary";
import { InjectParser, type InjectParameterDeclaration } from "../parsers/inject.parser";
import type { ILogger } from "../types/logger.interface";
import { NoOpLogger } from "../types/logger.interface";

export type NexusDecoratorKind =
	| "Inject"
	| "Injectable"
	| "NsModule"
	| "Optional"
	| "Global";

export type NexusDecorator = {
	kind: NexusDecoratorKind;
	declaration: ts.Decorator;
	expression: ts.Expression;
};

export type NexusClassModel = {
	node: ts.ClassDeclaration;
	name?: string;
	decorators: NexusDecorator[];
	isInjectable: boolean;
	isModule: boolean;
	isGlobal: boolean;
	dependencies: InjectParameterDeclaration[];
};

const NEXUS_CORE_PACKAGE = "@nexus-ioc/core";

/**
 * Semantic facade over the TypeScript program used by Nexus tooling.
 *
 * Consumers should depend on this API instead of re-implementing AST parsing
 * and decorator detection independently in each integration.
 */
export class NexusAnalyzer {
	private readonly checker: ts.TypeChecker;

	public constructor(
		private readonly program: ts.Program,
		private readonly logger: ILogger = new NoOpLogger(),
	) {
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
		return {
			node,
			name: node.name?.text,
			decorators,
			isInjectable: decorators.some((item) => item.kind === "Injectable"),
			isModule: decorators.some((item) => item.kind === "NsModule" || item.kind === "Global"),
			isGlobal: decorators.some((item) => item.kind === "Global"),
			dependencies: InjectParser.execute(node, this.logger),
		};
	}

	public getDecorators(node: ts.Node): NexusDecorator[] {
		if (!ts.canHaveDecorators(node)) {
			return [];
		}

		return (ts.getDecorators(node) ?? [])
			.map((declaration) => {
				const kind = this.resolveDecoratorKind(declaration);
				return kind
					? {
							kind,
							declaration,
							expression: declaration.expression,
						}
					: undefined;
			})
			.filter((item): item is NexusDecorator => item !== undefined);
	}

	public hasDecorator(node: ts.Node, kind: NexusDecoratorKind): boolean {
		return this.getDecorators(node).some((item) => item.kind === kind);
	}

	public getInjectedMembers(node: ts.ClassDeclaration): InjectParameterDeclaration[] {
		return this.getClassModel(node).dependencies;
	}

	private resolveDecoratorKind(
		decorator: ts.Decorator,
	): NexusDecoratorKind | undefined {
		const callee = this.getDecoratorCallee(decorator.expression);
		if (!callee) {
			return undefined;
		}

		const symbol = this.checker.getSymbolAtLocation(callee);
		if (!symbol) {
			return undefined;
		}

		const resolved = this.resolveAlias(symbol);
		const name = resolved.getName();

		if (!this.isNexusCoreSymbol(symbol)) {
			return undefined;
		}

		if (
			name === "Inject" ||
			name === "Injectable" ||
			name === "NsModule" ||
			name === "Optional" ||
			name === "Global"
		) {
			return name;
		}

		return undefined;
	}

	private getDecoratorCallee(expression: ts.Expression): ts.Identifier | undefined {
		if (ts.isIdentifier(expression)) {
			return expression;
		}

		if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
			return expression.expression;
		}

		return undefined;
	}

	private resolveAlias(symbol: ts.Symbol): ts.Symbol {
		let current = symbol;
		const visited = new Set<ts.Symbol>();

		while ((current.flags & ts.SymbolFlags.Alias) !== 0 && !visited.has(current)) {
			visited.add(current);
			const next = this.checker.getAliasedSymbol(current);
			if (next === current) {
				break;
			}
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
				if (importDeclaration?.moduleSpecifier && ts.isStringLiteral(importDeclaration.moduleSpecifier)) {
					return importDeclaration.moduleSpecifier.text === NEXUS_CORE_PACKAGE;
				}
			}

			if ((current.flags & ts.SymbolFlags.Alias) === 0) {
				break;
			}

			const next = this.checker.getAliasedSymbol(current);
			if (next === current) {
				break;
			}
			current = next;
		}

		return false;
	}

	private findImportDeclaration(node: ts.Node): ts.ImportDeclaration | undefined {
		let current: ts.Node | undefined = node;
		while (current) {
			if (ts.isImportDeclaration(current)) {
				return current;
			}
			current = current.parent;
		}
		return undefined;
	}
}

export function createNexusAnalyzer(
	program: ts.Program,
	logger?: ILogger,
): NexusAnalyzer {
	return new NexusAnalyzer(program, logger);
}
