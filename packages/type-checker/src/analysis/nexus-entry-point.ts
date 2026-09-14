import * as ts from "typescript";

/**
 * Finds the class referenced as a bare identifier argument of a call
 * expression anywhere in the given file — the shape of a framework
 * bootstrap call such as `NexusApplicationsServer.create(AppModule)`,
 * `const app = NexusFactory.create(AppModule)`, or the same wrapped in an
 * `async function bootstrap() { ... }`. This is deliberately not tied to one
 * specific bootstrap API name: it looks for *any* call whose argument list
 * contains an identifier that resolves to a class declaration, since
 * `type-checker` should not encode assumptions about a particular runtime's
 * bootstrap surface.
 *
 * The search never descends into a `ClassDeclaration`'s own subtree (its
 * decorators and members), so it isn't fooled by unrelated class-reference
 * call arguments there — most notably decorator calls like
 * `@Inject(SomeClass)`, which are far more common in a real file than the
 * bootstrap call itself and would otherwise match first.
 *
 * Returns `undefined` (never throws) when no such call is found, or the
 * resolved symbol isn't a class — the caller decides what to do next.
 */
export function findApplicationEntryPoint(
	program: ts.Program,
	entryFileName: string,
): ts.ClassDeclaration | undefined {
	const sourceFile = program.getSourceFile(entryFileName);
	if (!sourceFile) return undefined;

	const checker = program.getTypeChecker();
	let found: ts.ClassDeclaration | undefined;

	const visit = (node: ts.Node): void => {
		if (found || ts.isClassDeclaration(node)) return;

		if (ts.isCallExpression(node)) {
			for (const argument of node.arguments) {
				if (!ts.isIdentifier(argument)) continue;

				const symbol = checker.getSymbolAtLocation(argument);
				const resolved = resolveToClass(symbol, checker);
				if (resolved) {
					found = resolved;
					return;
				}
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return found;
}

function resolveToClass(
	symbol: ts.Symbol | undefined,
	checker: ts.TypeChecker,
): ts.ClassDeclaration | undefined {
	if (!symbol) return undefined;

	let current = symbol;
	if ((current.flags & ts.SymbolFlags.Alias) !== 0) {
		current = checker.getAliasedSymbol(current);
	}

	const declaration = current.valueDeclaration ?? current.declarations?.[0];
	return declaration && ts.isClassDeclaration(declaration)
		? declaration
		: undefined;
}
