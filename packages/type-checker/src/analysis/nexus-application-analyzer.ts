import * as ts from "typescript";
import type { NexusAnalyzer } from "./nexus-analyzer";
import type { NexusApplication } from "./nexus-application-model";
import type {
	NexusClass,
	NexusSourceSpan,
	NexusToken,
} from "./nexus-semantic-model";

/** Performs whole-application semantic analysis from a Nexus root class. */
export class NexusApplicationAnalyzer {
	public constructor(private readonly analyzer: NexusAnalyzer) {}

	/**
	 * Discovers reachable Nexus classes in deterministic breadth-first order.
	 *
	 * Class identity is based on TypeScript symbols, so import aliases and
	 * re-exports resolve to the same semantic class. A visited set also makes
	 * circular dependency traversal terminate without duplicates.
	 *
	 * Only `NexusToken.reference` tokens resolving to a class declaration are
	 * traversable. String, symbol, expression, and non-class reference tokens
	 * remain dependency metadata but do not become application nodes.
	 */
	public analyze(entryPoint: ts.ClassDeclaration): NexusApplication {
		const classes: NexusClass[] = [];
		const visited = new Set<ts.Symbol>();
		const pending: ts.ClassDeclaration[] = [entryPoint];
		const entryPointSymbol = this.getClassSymbol(entryPoint);

		if (entryPointSymbol) {
			visited.add(entryPointSymbol);
		}

		let index = 0;
		while (index < pending.length) {
			const node = pending[index++];
			const nexusClass = this.analyzer.getClass(node);
			classes.push(nexusClass);

			for (const dependency of nexusClass.dependencies) {
				this.enqueue(dependency.token, pending, visited);
			}

			for (const moduleImport of nexusClass.module?.imports ?? []) {
				this.enqueue(moduleImport.module, pending, visited);
			}

			for (const provider of nexusClass.module?.providers ?? []) {
				this.enqueue(provider.provide, pending, visited);
				this.enqueue(provider.useClass, pending, visited);
			}
		}

		return {
			entryPoint: this.getSourceSpan(entryPoint),
			classes,
		};
	}

	private enqueue(
		token: NexusToken | undefined,
		pending: ts.ClassDeclaration[],
		visited: Set<ts.Symbol>,
	): void {
		const next = this.resolveClassFromToken(token);
		if (!next) return;

		const symbol = this.getClassSymbol(next);
		if (!symbol || visited.has(symbol)) return;

		visited.add(symbol);
		pending.push(next);
	}

	private resolveClassFromToken(
		token: NexusToken | undefined,
	): ts.ClassDeclaration | undefined {
		if (token?.kind !== "reference") return undefined;

		const declaration =
			token.symbol.valueDeclaration ?? token.symbol.declarations?.[0];
		return declaration && ts.isClassDeclaration(declaration)
			? declaration
			: undefined;
	}

	private getClassSymbol(node: ts.ClassDeclaration): ts.Symbol | undefined {
		return node.name
			? this.analyzer.getTypeChecker().getSymbolAtLocation(node.name)
			: undefined;
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
}

export function createNexusApplicationAnalyzer(
	analyzer: NexusAnalyzer,
): NexusApplicationAnalyzer {
	return new NexusApplicationAnalyzer(analyzer);
}
