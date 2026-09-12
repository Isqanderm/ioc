import * as ts from "typescript";
import type { NexusAnalyzer } from "./nexus-analyzer";
import type { NexusApplication } from "./nexus-application-model";
import type { NexusClass, NexusToken } from "./nexus-semantic-model";

/** Performs whole-application semantic analysis from a Nexus root class. */
export class NexusApplicationAnalyzer {
	public constructor(private readonly analyzer: NexusAnalyzer) {}

	public analyze(entryPoint: ts.ClassDeclaration): NexusApplication {
		const classes: NexusClass[] = [];
		const visited = new Set<ts.Symbol>();
		const pending: ts.ClassDeclaration[] = [entryPoint];

		while (pending.length > 0) {
			const node = pending.shift();
			if (!node) continue;

			const nexusClass = this.analyzer.getClass(node);
			classes.push(nexusClass);

			for (const dependency of nexusClass.dependencies) {
				const next = this.resolveClassFromToken(dependency.token);
				if (!next) continue;

				const symbol = next.name ? this.getClassSymbol(next) : undefined;
				if (!symbol || visited.has(symbol)) continue;
				visited.add(symbol);
				pending.push(next);
			}
		}

		return {
			entryPoint: this.getSourceSpan(entryPoint),
			classes,
		};
	}

	private resolveClassFromToken(token: NexusToken | undefined): ts.ClassDeclaration | undefined {
		if (!token || token.kind !== "reference") return undefined;

		const declaration = token.symbol.valueDeclaration ?? token.symbol.declarations?.[0];
		return declaration && ts.isClassDeclaration(declaration) ? declaration : undefined;
	}

	private getClassSymbol(node: ts.ClassDeclaration): ts.Symbol | undefined {
		return node.name ? this.analyzer.getTypeChecker().getSymbolAtLocation(node.name) : undefined;
	}

	private getSourceSpan(node: ts.Node) {
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
