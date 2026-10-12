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
	NexusUndeclaredDependency,
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
	NexusUndeclaredDependency,
} from "./nexus-semantic-model";

/**
 * Module specifiers recognized as "the Nexus core package" when deciding
 * whether a decorator is a genuine Nexus decorator. `@nexus-ioc/core` is the
 * in-monorepo package name; `nexus-ioc` is the same framework's published
 * unscoped npm package name that real consumer projects import from.
 */
const DEFAULT_NEXUS_CORE_PACKAGES: readonly string[] = [
	"@nexus-ioc/core",
	"nexus-ioc",
];

type ResolvedNexusDecorator = {
	kind: NexusDecoratorKind;
	expression: ts.Expression;
};

export interface NexusAnalyzerOptions {
	/**
	 * Module specifiers treated as the Nexus core package for decorator
	 * recognition. Defaults to {@link DEFAULT_NEXUS_CORE_PACKAGES}.
	 */
	corePackageNames?: readonly string[];
}

const SHORT_CIRCUIT_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
	ts.SyntaxKind.AmpersandAmpersandToken,
	ts.SyntaxKind.BarBarToken,
	ts.SyntaxKind.QuestionQuestionToken,
	ts.SyntaxKind.AmpersandAmpersandEqualsToken,
	ts.SyntaxKind.BarBarEqualsToken,
	ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

function nodeSet(...nodes: (ts.Node | undefined)[]): ReadonlySet<ts.Node> {
	return new Set(nodes.filter((node): node is ts.Node => node !== undefined));
}

/** Shared semantic model used by Nexus IDE, lint and compiler tooling. */
export class NexusAnalyzer {
	private readonly checker: ts.TypeChecker;
	private readonly corePackageNames: ReadonlySet<string>;

	public constructor(
		private readonly program: ts.Program,
		options: NexusAnalyzerOptions = {},
	) {
		this.checker = program.getTypeChecker();
		this.corePackageNames = new Set(
			options.corePackageNames ?? DEFAULT_NEXUS_CORE_PACKAGES,
		);
	}

	public getProgram(): ts.Program {
		return this.program;
	}

	public getTypeChecker(): ts.TypeChecker {
		return this.checker;
	}

	public getClass(node: ts.ClassDeclaration): NexusClass {
		const decorators = this.getDecorators(node);
		const { dependencies, undeclaredDependencies } = this.getClassMembers(node);

		return {
			name: node.name?.text,
			id: this.formatPosition(node),
			source: this.getSourceSpan(node),
			decorators,
			dependencies,
			undeclaredDependencies,
			isInjectable: decorators.some((item) => item.kind === "Injectable"),
			isModule: decorators.some(
				(item) => item.kind === "Module" || item.kind === "Global",
			),
			isGlobal: decorators.some((item) => item.kind === "Global"),
			module: this.getModule(node),
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

	/** @deprecated Use getClassMembers() instead. */
	public getInjectedMembers(node: ts.ClassDeclaration): NexusDependency[] {
		return this.getClassMembers(node).dependencies;
	}

	/**
	 * Splits a class's constructor parameters and properties into real
	 * `@Inject`-ed dependencies and likely-missing-decorator diagnostics: a
	 * member whose declared type resolves to a class but carries no
	 * `@Inject` never becomes a dependency edge (the Nexus runtime container
	 * only ever resolves explicit `@Inject`s), but is still surfaced via
	 * `undeclaredDependencies` so tooling can warn about it.
	 */
	public getClassMembers(node: ts.ClassDeclaration): {
		dependencies: NexusDependency[];
		undeclaredDependencies: NexusUndeclaredDependency[];
	} {
		const dependencies: NexusDependency[] = [];
		const undeclaredDependencies: NexusUndeclaredDependency[] = [];

		const add = (
			declaration: ts.ParameterDeclaration | ts.PropertyDeclaration,
			location: "constructor" | "property",
			index: number | undefined,
		) => {
			const inject = this.getDecorators(declaration).find(
				(item) => item.kind === "Inject",
			);

			if (inject) {
				const tokenExpression = this.getInjectTokenExpression(declaration);
				if (!tokenExpression) return;

				dependencies.push({
					location,
					name: declaration.name.getText(),
					index,
					token: this.resolveToken(tokenExpression),
					optional: this.hasDecorator(declaration, "Optional"),
					source: this.getSourceSpan(declaration),
				});
				return;
			}

			if (
				declaration.initializer &&
				this.collectInjectCalls(declaration.initializer).length > 0
			) {
				return;
			}

			const inferred = this.resolveUndeclaredDependencyType(declaration);
			if (!inferred) return;

			undeclaredDependencies.push({
				location,
				name: declaration.name.getText(),
				index,
				inferredType: inferred.token,
				isInferredTypeInjectable: inferred.isInjectable,
				source: this.getSourceSpan(declaration),
			});
		};

		for (const member of node.members) {
			if (ts.isConstructorDeclaration(member)) {
				member.parameters.forEach((parameter, index) => {
					add(parameter, "constructor", index);
				});
			}
			if (ts.isPropertyDeclaration(member)) {
				add(member, "property", undefined);
			}
		}

		dependencies.push(...this.getInjectFunctionDependencies(node));

		return { dependencies, undeclaredDependencies };
	}

	/**
	 * `inject()` calls that run while the container creates an instance of
	 * this class: instance field initializers, constructor parameter defaults
	 * and the constructor body. Methods, accessors, static fields and nested
	 * functions/classes run later (outside the injection context) and are not
	 * reported. Appended after the `@Inject` dependencies, so the output for
	 * a class without `inject()` calls is unchanged.
	 */
	private getInjectFunctionDependencies(
		node: ts.ClassDeclaration,
	): NexusDependency[] {
		const dependencies: NexusDependency[] = [];
		const add = (root: ts.Node, name: string) => {
			for (const call of this.collectInjectCalls(root)) {
				dependencies.push(this.toInjectDependency(call, name));
			}
		};

		for (const member of node.members) {
			if (
				ts.isPropertyDeclaration(member) &&
				member.initializer &&
				!this.isStatic(member)
			) {
				add(member.initializer, member.name.getText());
			}
			if (ts.isConstructorDeclaration(member)) {
				for (const parameter of member.parameters) {
					if (parameter.initializer) {
						add(parameter.initializer, parameter.name.getText());
					}
				}
				if (member.body) add(member.body, "constructor");
			}
		}

		return dependencies;
	}

	private toInjectDependency(
		call: ts.CallExpression,
		name: string,
	): NexusDependency {
		return {
			location: "inject",
			name,
			token: this.resolveToken(call.arguments[0]),
			optional: this.isOptionalInjectCall(call),
			source: this.getSourceSpan(call),
		};
	}

	/** `true` only for a literal `{ optional: true }` second argument. */
	private isOptionalInjectCall(call: ts.CallExpression): boolean {
		const options = call.arguments[1];
		if (!options || !ts.isObjectLiteralExpression(options)) return false;
		const optional = this.findProperty(options, "optional");
		return optional?.initializer.kind === ts.SyntaxKind.TrueKeyword;
	}

	private isStatic(member: ts.ClassElement): boolean {
		return (
			ts.canHaveModifiers(member) &&
			(ts.getModifiers(member) ?? []).some(
				(modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword,
			)
		);
	}

	/**
	 * Collects the `inject()` calls (from the Nexus core package) that run
	 * synchronously when `root` is evaluated, in evaluation order.
	 *
	 * - Nested functions, accessors, methods and class bodies are skipped:
	 *   they run later, outside the injection context. Immediately invoked
	 *   functions are skipped too (a documented simplification).
	 * - The walk stops at the first `await` that is reached unconditionally
	 *   (not inside an `if`/`switch` branch, loop body, `catch`/`finally`,
	 *   `?:` branch or the right side of `&&`/`||`/`??`): everything after it
	 *   runs once the injection context is gone. The awaited operand itself is
	 *   still walked, since it is evaluated before the suspension. An `await`
	 *   inside a conditional construct does not stop the walk, so calls after
	 *   it are reported (they run synchronously when the branch is not taken).
	 */
	private collectInjectCalls(root: ts.Node): ts.CallExpression[] {
		const calls: ts.CallExpression[] = [];
		let stopped = false;

		const visit = (node: ts.Node, conditional: boolean): void => {
			if (stopped) return;
			if (
				ts.isFunctionLike(node) ||
				ts.isClassLike(node) ||
				ts.isClassStaticBlockDeclaration(node)
			) {
				return;
			}

			if (ts.isAwaitExpression(node)) {
				visit(node.expression, conditional);
				if (!conditional) stopped = true;
				return;
			}

			if (ts.isForOfStatement(node) && node.awaitModifier) {
				visit(node.initializer, conditional);
				visit(node.expression, conditional);
				if (!conditional) stopped = true;
				visit(node.statement, true);
				return;
			}

			if (ts.isCallExpression(node) && this.isInjectCall(node)) {
				ts.forEachChild(node, (child) => visit(child, conditional));
				if (!stopped) calls.push(node);
				return;
			}

			const conditionalChildren = this.getConditionalChildren(node);
			ts.forEachChild(node, (child) =>
				visit(child, conditional || conditionalChildren.has(child)),
			);
		};

		visit(root, false);
		return calls;
	}

	/** Children of `node` that may not be evaluated (or not exactly once)
	 * when `node` itself is. */
	private getConditionalChildren(node: ts.Node): ReadonlySet<ts.Node> {
		if (ts.isIfStatement(node)) {
			return nodeSet(node.thenStatement, node.elseStatement);
		}
		if (ts.isConditionalExpression(node)) {
			return nodeSet(node.whenTrue, node.whenFalse);
		}
		if (
			ts.isBinaryExpression(node) &&
			SHORT_CIRCUIT_OPERATORS.has(node.operatorToken.kind)
		) {
			return nodeSet(node.right);
		}
		if (ts.isForStatement(node)) {
			return nodeSet(node.condition, node.incrementor, node.statement);
		}
		if (
			ts.isForOfStatement(node) ||
			ts.isForInStatement(node) ||
			ts.isWhileStatement(node)
		) {
			return nodeSet(node.statement);
		}
		if (ts.isDoStatement(node)) {
			// The body runs at least once; the condition only after it.
			return nodeSet(node.expression);
		}
		if (ts.isSwitchStatement(node)) {
			return nodeSet(node.caseBlock);
		}
		if (ts.isTryStatement(node)) {
			return nodeSet(node.catchClause, node.finallyBlock);
		}
		return nodeSet();
	}

	private isInjectCall(call: ts.CallExpression): boolean {
		if (!ts.isIdentifier(call.expression) || call.arguments.length === 0) {
			return false;
		}
		const symbol = this.checker.getSymbolAtLocation(call.expression);
		if (!symbol || !this.isImportedFromNexusCore(symbol)) return false;
		return this.resolveAlias(symbol)?.getName() === "inject";
	}

	/**
	 * Like {@link isNexusCoreSymbol}, but follows the alias chain one hop at a
	 * time, so a binding re-exported from the core package by a local barrel
	 * (`export { inject } from "@nexus-ioc/core"`) is recognised too.
	 */
	private isImportedFromNexusCore(symbol: ts.Symbol): boolean {
		let current: ts.Symbol | undefined = symbol;
		const visited = new Set<ts.Symbol>();
		while (current && !visited.has(current)) {
			visited.add(current);
			if ((current.flags & ts.SymbolFlags.Alias) === 0) return false;
			for (const declaration of current.declarations ?? []) {
				const specifier = this.findModuleSpecifier(declaration);
				if (specifier && this.corePackageNames.has(specifier)) return true;
			}
			current = this.checker.getImmediateAliasedSymbol(current);
		}
		return false;
	}

	private findModuleSpecifier(node: ts.Node): string | undefined {
		let current: ts.Node | undefined = node;
		while (current) {
			if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) {
				return current.moduleSpecifier &&
					ts.isStringLiteral(current.moduleSpecifier)
					? current.moduleSpecifier.text
					: undefined;
			}
			current = current.parent;
		}
		return undefined;
	}

	/**
	 * Resolves a `@Inject`-less parameter/property's type annotation to a
	 * class declaration, for the `undeclaredDependencies` diagnostic. Only a
	 * `TypeReferenceNode` resolving to an actual class counts — primitives,
	 * `any`, and unresolvable generics are not diagnostic material.
	 */
	private resolveUndeclaredDependencyType(
		declaration: ts.ParameterDeclaration | ts.PropertyDeclaration,
	): { token: NexusToken; isInjectable: boolean } | undefined {
		if (!declaration.type || !ts.isTypeReferenceNode(declaration.type)) {
			return undefined;
		}

		const type = this.checker.getTypeAtLocation(declaration);
		const symbol = this.resolveAlias(type.getSymbol());
		const classDeclaration = symbol?.declarations?.find(
			(item): item is ts.ClassDeclaration => ts.isClassDeclaration(item),
		);
		if (!symbol || !classDeclaration) return undefined;

		return {
			token: this.buildReferenceToken(
				symbol,
				this.getSourceSpan(declaration.type),
			),
			isInjectable: this.getDecorators(classDeclaration).some(
				(item) => item.kind === "Injectable" || item.kind === "Module",
			),
		};
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
	 * rather than the anonymous `DynamicModule` return value. An un-annotated
	 * factory resolves this way via its inferred return type regardless of
	 * body shape; a factory explicitly annotated `: DynamicModule` erases that
	 * inferred literal type, so it falls back to
	 * {@link resolveModuleFromReturnLiteral}.
	 */
	private resolveModuleReference(expression: ts.Expression): NexusToken {
		const type = this.checker.getTypeAtLocation(expression);
		const moduleProperty = type.getProperty("module");

		if (moduleProperty) {
			const moduleType = this.checker.getTypeOfSymbolAtLocation(
				moduleProperty,
				expression,
			);
			const symbol =
				moduleType.getSymbol() ??
				this.resolveIntersectionClassSymbol(moduleType);
			if (symbol) {
				return this.buildReferenceToken(symbol, this.getSourceSpan(expression));
			}
		}

		if (ts.isCallExpression(expression)) {
			const fromReturnLiteral = this.resolveModuleFromReturnLiteral(expression);
			if (fromReturnLiteral) return fromReturnLiteral;
		}

		return this.resolveToken(expression);
	}

	/**
	 * A `DynamicModule`-shaped `module` property is typed as an intersection
	 * (e.g. `Module & { forRoot?: () => DynamicModule }`), so `Type#getSymbol()`
	 * returns `undefined` for it directly. Look through the intersection's
	 * constituents for the concrete module class.
	 */
	private resolveIntersectionClassSymbol(type: ts.Type): ts.Symbol | undefined {
		if (!type.isIntersection()) return undefined;

		for (const constituent of type.types) {
			const symbol = constituent.getSymbol();
			if (symbol && (symbol.flags & ts.SymbolFlags.Class) !== 0) {
				return symbol;
			}
		}

		return undefined;
	}

	/**
	 * Fallback for a dynamic-module call whose factory is explicitly annotated
	 * `: DynamicModule` — that annotation erases the object-literal return
	 * type TypeScript would otherwise infer, so `resolveModuleReference`'s
	 * `module`-property lookup on the return type can't see the concrete
	 * module class. Instead, this inspects the called signature's declaration
	 * body directly: when it is a single, top-level `return <object literal>;`
	 * statement whose object literal has a `module` property, that property's
	 * initializer is resolved as the module reference. Anything more complex
	 * (conditional returns, multiple return statements, computed/spread
	 * values) is a genuine static-analysis limit and is left to fall back to
	 * an `expression`-kind token.
	 */
	private resolveModuleFromReturnLiteral(
		expression: ts.CallExpression,
	): NexusToken | undefined {
		const signature = this.checker.getResolvedSignature(expression);
		const declaration = signature?.declaration;
		if (
			!declaration ||
			!(
				ts.isMethodDeclaration(declaration) ||
				ts.isFunctionDeclaration(declaration) ||
				ts.isFunctionExpression(declaration) ||
				ts.isArrowFunction(declaration)
			)
		) {
			return undefined;
		}

		const body = declaration.body;
		if (!body || !ts.isBlock(body)) return undefined;
		if (body.statements.length !== 1) return undefined;

		const [statement] = body.statements;
		if (!ts.isReturnStatement(statement) || !statement.expression) {
			return undefined;
		}
		if (!ts.isObjectLiteralExpression(statement.expression)) return undefined;

		const moduleProperty = this.findProperty(statement.expression, "module");
		if (!moduleProperty) return undefined;

		const token = this.resolveToken(moduleProperty.initializer);
		return token.kind === "reference" || token.kind === "symbol"
			? token
			: undefined;
	}

	private getModuleDecoratorArgument(
		node: ts.ClassDeclaration,
	): ts.ObjectLiteralExpression | undefined {
		if (!ts.canHaveDecorators(node)) return undefined;

		for (const decorator of ts.getDecorators(node) ?? []) {
			if (this.resolveDecoratorKind(decorator) !== "Module") continue;
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

	/**
	 * Finds an object literal member by name, covering every property-name
	 * shape TypeScript allows: a plain assignment with an identifier,
	 * string-literal or numeric-literal key (`provide: x`, `"provide": x`,
	 * `0: x`), and a shorthand assignment (`{ useValue }`, whose "value" is
	 * the property's own name identifier).
	 */
	private findProperty(
		object: ts.ObjectLiteralExpression,
		name: string,
	): { name: string; initializer: ts.Expression } | undefined {
		for (const item of object.properties) {
			if (
				ts.isPropertyAssignment(item) &&
				(ts.isIdentifier(item.name) ||
					ts.isStringLiteral(item.name) ||
					ts.isNumericLiteral(item.name)) &&
				item.name.text === name
			) {
				return { name, initializer: item.initializer };
			}

			if (ts.isShorthandPropertyAssignment(item) && item.name.text === name) {
				return { name, initializer: item.name };
			}
		}

		return undefined;
	}

	private resolveProvider(element: ts.Expression): NexusProvider[] {
		const source = this.getSourceSpan(element);

		if (ts.isSpreadElement(element)) {
			return [];
		}

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

			const factoryBody = useFactoryProperty.initializer;
			if (
				ts.isArrowFunction(factoryBody) ||
				ts.isFunctionExpression(factoryBody)
			) {
				factoryInject.push(...this.getFactoryInjectCalls(factoryBody));
			}

			return [{ kind: "useFactory", provide, factoryInject, scope, source }];
		}

		return [];
	}

	/** Tokens of the `inject()` calls a `useFactory` function makes before
	 * its first unconditional `await` (parameter defaults, then the body). */
	private getFactoryInjectCalls(
		factory: ts.ArrowFunction | ts.FunctionExpression,
	): NexusToken[] {
		const calls: ts.CallExpression[] = [];
		for (const parameter of factory.parameters) {
			if (parameter.initializer) {
				calls.push(...this.collectInjectCalls(parameter.initializer));
			}
		}
		calls.push(...this.collectInjectCalls(factory.body));
		return calls.map((call) => this.resolveToken(call.arguments[0]));
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
			const resolved = this.resolveAlias(symbol);
			return {
				kind: "symbol",
				declaration: resolved,
				id: resolved ? this.resolveSymbolId(resolved) : undefined,
				source,
			};
		}

		if (symbol) {
			return this.buildReferenceToken(symbol, source);
		}

		return {
			kind: "expression",
			source,
		};
	}

	private buildReferenceToken(
		symbol: ts.Symbol,
		source: NexusSourceSpan,
	): NexusToken {
		const resolved = this.resolveAlias(symbol) ?? symbol;
		return {
			kind: "reference",
			symbol: resolved,
			id: this.resolveSymbolId(resolved),
			source,
		};
	}

	/** Stable `file:line:col` identity of `symbol`'s own declaration site —
	 * not the site it was referenced from. Two references to the same
	 * declaration (however imported/aliased/re-exported) resolve to the same
	 * id, since `resolveAlias` has already collapsed `symbol` to its
	 * canonical form by the time this runs. Falls back to a name-based id
	 * for the rare symbol with no declaration at all (e.g. some ambient/
	 * global symbols). */
	private resolveSymbolId(symbol: ts.Symbol): string {
		const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
		return declaration
			? this.formatPosition(declaration)
			: `unresolved:${symbol.getName()}`;
	}

	private formatPosition(node: ts.Node): string {
		const sourceFile = node.getSourceFile();
		const { line, character } = ts.getLineAndCharacterOfPosition(
			sourceFile,
			node.getStart(),
		);
		return `${sourceFile.fileName}:${line + 1}:${character + 1}`;
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
			name === "Module" ||
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
					return this.corePackageNames.has(
						importDeclaration.moduleSpecifier.text,
					);
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

export function createNexusAnalyzer(
	program: ts.Program,
	options?: NexusAnalyzerOptions,
): NexusAnalyzer {
	return new NexusAnalyzer(program, options);
}
