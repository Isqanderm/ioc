import * as ts from "typescript";
import type { NexusAnalyzer } from "./nexus-analyzer";
import type {
	NexusApplicationGraph,
	NexusResolvedDependency,
	NexusUnresolvedDependency,
} from "./nexus-application-graph-model";
import type { NexusApplication, NexusScope } from "./nexus-application-model";
import type {
	NexusClass,
	NexusProvider,
	NexusToken,
} from "./nexus-semantic-model";

/** Stable identity for a dependency token: a string token key, or the
 * underlying `ts.Symbol` for class/symbol tokens. `undefined` means the
 * token cannot be statically matched (e.g. an arbitrary expression). */
type TokenIdentity = string | ts.Symbol;

function getTokenIdentity(
	token: NexusToken | undefined,
): TokenIdentity | undefined {
	if (!token) return undefined;
	switch (token.kind) {
		case "string":
			return `string:${token.value}`;
		case "reference":
			return token.symbol;
		case "symbol":
			return token.declaration;
		case "expression":
			return undefined;
		default:
			return undefined;
	}
}

type VisibleProvider = { provider: NexusProvider; owner: NexusClass };
type VisibleProviders = Map<TokenIdentity, VisibleProvider>;

/** Per-scope lookup tables: a module's visibility depends on the scope's
 * `@Global()` modules, and class ownership on the scope's modules. */
type ScopeContext = {
	classes: readonly NexusClass[];
	globalModules: readonly NexusClass[];
	providingModulesByClassSymbol: Map<ts.Symbol, NexusClass[]>;
	visibleProvidersByModule: Map<ts.Symbol, VisibleProviders>;
};

function isModuleClass(
	item: NexusClass,
): item is NexusClass & { module: NonNullable<NexusClass["module"]> } {
	return item.module !== undefined;
}

function isSymbolIdentity(identity: TokenIdentity): identity is ts.Symbol {
	return typeof identity !== "string";
}

/** Resolves a `NexusApplication` into a module-scoped dependency graph. */
export class NexusApplicationGraphBuilder {
	public constructor(private readonly analyzer: NexusAnalyzer) {}

	/**
	 * Resolves every dependency scope by scope, in `application.scopes`
	 * order. Within a scope, a class's dependency resolves against what its
	 * module (or the modules providing it) can see: own providers, imports'
	 * exports and that scope's `@Global()` modules. If that fails and the
	 * scope is a child scope, it resolves against what the declaring module
	 * sees in the parent scope, recursively up the chain; a match found that
	 * way is `fromParentScope: true`. A local provider therefore always wins
	 * over a parent one, and encapsulated (unexported) providers stay hidden.
	 *
	 * For an application without `children` there is one scope holding every
	 * class, so the output is the same as a single-scope resolution.
	 */
	public build(application: NexusApplication): NexusApplicationGraph {
		const moduleClasses = application.classes.filter(isModuleClass);
		const moduleBySymbol = this.indexModulesBySymbol(moduleClasses);
		const classesById = new Map(
			application.classes.map((item) => [item.id, item]),
		);
		const scopesByRootId = new Map(
			application.scopes.map((scope) => [scope.rootId, scope]),
		);
		const contexts = new Map<string, ScopeContext>();
		const contextFor = (scope: NexusScope): ScopeContext => {
			let context = contexts.get(scope.rootId);
			if (!context) {
				context = this.createScopeContext(scope, classesById);
				contexts.set(scope.rootId, context);
			}
			return context;
		};
		const visibleIn = (
			context: ScopeContext,
			moduleClass: NexusClass,
		): VisibleProviders => {
			const symbol = this.classSymbol(moduleClass);
			const cached = symbol && context.visibleProvidersByModule.get(symbol);
			if (cached) return cached;
			const visible = this.resolveVisibleProviders(
				moduleClass,
				moduleBySymbol,
				context.globalModules,
			);
			if (symbol) context.visibleProvidersByModule.set(symbol, visible);
			return visible;
		};

		const resolved: NexusResolvedDependency[] = [];
		const unresolved: NexusUnresolvedDependency[] = [];

		for (const scope of application.scopes) {
			const context = contextFor(scope);

			for (const nexusClass of context.classes) {
				const lookups = this.resolveScopesFor(
					nexusClass,
					context.providingModulesByClassSymbol,
					(moduleClass) => visibleIn(context, moduleClass),
				);

				// In a child scope, a non-module class nothing in the scope
				// provides was only reached through a dependency token: it is
				// created by whichever scope provides it, and its own
				// dependencies are resolved there.
				if (
					scope.declaredInId !== undefined &&
					!nexusClass.module &&
					lookups.length === 0 &&
					this.appearsInOtherScope(nexusClass, scope, application.scopes)
				) {
					continue;
				}

				for (const dependency of nexusClass.dependencies) {
					const identity = getTokenIdentity(dependency.token);
					let match =
						identity !== undefined
							? lookups.map((lookup) => lookup.get(identity)).find(Boolean)
							: undefined;
					let fromParentScope = false;

					if (!match && identity !== undefined) {
						match = this.resolveFromParentScopes(
							scope,
							identity,
							scopesByRootId,
							classesById,
							contextFor,
							visibleIn,
						);
						fromParentScope = match !== undefined;
					}

					if (match) {
						resolved.push({
							class: nexusClass,
							dependencyName: dependency.name,
							provider: match.provider,
							providingModule: match.owner,
							fromParentScope,
						});
					} else if (!dependency.optional) {
						unresolved.push({
							class: nexusClass,
							dependencyName: dependency.name,
							token: dependency.token,
							source: dependency.source,
						});
					}
				}
			}
		}

		return {
			resolved,
			unresolved,
		};
	}

	/** Walks from `scope` to its ancestors, looking `identity` up in what
	 * each scope's declaring module sees in its parent scope. */
	private resolveFromParentScopes(
		scope: NexusScope,
		identity: TokenIdentity,
		scopesByRootId: Map<string, NexusScope>,
		classesById: Map<string, NexusClass>,
		contextFor: (scope: NexusScope) => ScopeContext,
		visibleIn: (
			context: ScopeContext,
			moduleClass: NexusClass,
		) => VisibleProviders,
	): VisibleProvider | undefined {
		const seen = new Set<string>();
		let current: NexusScope | undefined = scope;

		while (
			current?.declaredInId !== undefined &&
			current.parentRootId !== undefined &&
			!seen.has(current.rootId)
		) {
			seen.add(current.rootId);
			const parent = scopesByRootId.get(current.parentRootId);
			const declaringModule = classesById.get(current.declaredInId);
			if (!parent || !declaringModule?.module) return undefined;

			const match = visibleIn(contextFor(parent), declaringModule).get(
				identity,
			);
			if (match) return match;
			current = parent;
		}

		return undefined;
	}

	private createScopeContext(
		scope: NexusScope,
		classesById: Map<string, NexusClass>,
	): ScopeContext {
		const classes = scope.classIds.flatMap((id) => {
			const nexusClass = classesById.get(id);
			return nexusClass ? [nexusClass] : [];
		});
		const moduleClasses = classes.filter(isModuleClass);
		return {
			classes,
			globalModules: moduleClasses.filter((item) => item.isGlobal),
			providingModulesByClassSymbol:
				this.indexProvidersByClassSymbol(moduleClasses),
			visibleProvidersByModule: new Map(),
		};
	}

	private appearsInOtherScope(
		nexusClass: NexusClass,
		scope: NexusScope,
		scopes: readonly NexusScope[],
	): boolean {
		return scopes.some(
			(other) => other !== scope && other.classIds.includes(nexusClass.id),
		);
	}

	private resolveScopesFor(
		nexusClass: NexusClass,
		providingModulesByClassSymbol: Map<ts.Symbol, NexusClass[]>,
		visibleIn: (moduleClass: NexusClass) => VisibleProviders,
	): VisibleProviders[] {
		if (nexusClass.module) {
			return [visibleIn(nexusClass)];
		}

		const symbol = this.classSymbol(nexusClass);
		const owningModules = symbol
			? (providingModulesByClassSymbol.get(symbol) ?? [])
			: [];

		return owningModules.map((owner) => visibleIn(owner));
	}

	private indexModulesBySymbol(
		moduleClasses: readonly NexusClass[],
	): Map<ts.Symbol, NexusClass> {
		const map = new Map<ts.Symbol, NexusClass>();
		for (const moduleClass of moduleClasses) {
			const symbol = this.classSymbol(moduleClass);
			if (symbol) map.set(symbol, moduleClass);
		}
		return map;
	}

	/** Maps a provided class's symbol to every module that registers it. */
	private indexProvidersByClassSymbol(
		moduleClasses: readonly NexusClass[],
	): Map<ts.Symbol, NexusClass[]> {
		const map = new Map<ts.Symbol, NexusClass[]>();

		for (const moduleClass of moduleClasses) {
			for (const provider of moduleClass.module?.providers ?? []) {
				const providedSymbol = this.classProviderSymbol(provider);
				if (!providedSymbol) continue;

				const owners = map.get(providedSymbol) ?? [];
				owners.push(moduleClass);
				map.set(providedSymbol, owners);
			}
		}

		return map;
	}

	/** The symbol of the class a provider's token resolves to, if any — the
	 * `useClass` target for a `"useClass"` provider, otherwise whatever
	 * `provide` itself points at. This runs for every provider kind
	 * (`useValue`/`useFactory` included): a `useValue`/`useFactory` provider
	 * whose `provide` happens to be a class reference still yields that
	 * class's symbol here. It builds a rough "which modules mention this
	 * class" ownership index, not a strict class-instantiation check. */
	private classProviderSymbol(provider: NexusProvider): ts.Symbol | undefined {
		const token =
			provider.kind === "useClass" ? provider.useClass : provider.provide;
		return token?.kind === "reference" ? token.symbol : undefined;
	}

	private resolveOwnProviderMap(
		moduleClass: NexusClass,
	): Map<TokenIdentity, NexusProvider> {
		const map = new Map<TokenIdentity, NexusProvider>();
		for (const provider of moduleClass.module?.providers ?? []) {
			const identity = getTokenIdentity(provider.provide);
			if (identity !== undefined) map.set(identity, provider);
		}
		return map;
	}

	private resolveExportedProviders(
		moduleClass: NexusClass,
		moduleBySymbol: Map<ts.Symbol, NexusClass>,
		visiting: Set<ts.Symbol> = new Set(),
	): Map<TokenIdentity, { provider: NexusProvider; owner: NexusClass }> {
		const symbol = this.classSymbol(moduleClass);
		if (symbol) {
			if (visiting.has(symbol)) return new Map();
			visiting.add(symbol);
		}

		try {
			const ownProviders = this.resolveOwnProviderMap(moduleClass);
			const result = new Map<
				TokenIdentity,
				{ provider: NexusProvider; owner: NexusClass }
			>();

			for (const exportEntry of moduleClass.module?.exports ?? []) {
				const identity = getTokenIdentity(exportEntry.token);
				if (identity === undefined) continue;

				const ownMatch = ownProviders.get(identity);
				if (ownMatch) {
					result.set(identity, { provider: ownMatch, owner: moduleClass });
					continue;
				}

				if (isSymbolIdentity(identity)) {
					const referencedModule = moduleBySymbol.get(identity);
					if (referencedModule) {
						for (const [nestedIdentity, entry] of this.resolveExportedProviders(
							referencedModule,
							moduleBySymbol,
							visiting,
						)) {
							result.set(nestedIdentity, entry);
						}
						continue;
					}
				}

				// Not one of the module's own providers, and not a whole-module
				// pass-through re-export (the export entry's identity doesn't name
				// one of this module's `imports`). It may still be an individual
				// token the module re-exports after receiving it from one of its
				// own imports (e.g. `CoreModule` imports `DatabaseModule` and
				// re-exports the `"DATABASE"` token itself, not `DatabaseModule`).
				// Search the module's imports for a match, preserving the true
				// original owner rather than attributing it to `moduleClass`.
				for (const importEntry of moduleClass.module?.imports ?? []) {
					const importIdentity = getTokenIdentity(importEntry.module);
					if (
						importIdentity === undefined ||
						!isSymbolIdentity(importIdentity)
					) {
						continue;
					}

					const importedModule = moduleBySymbol.get(importIdentity);
					if (!importedModule) continue;

					const nestedExports = this.resolveExportedProviders(
						importedModule,
						moduleBySymbol,
						visiting,
					);
					const nestedMatch = nestedExports.get(identity);
					if (nestedMatch) {
						result.set(identity, nestedMatch);
						break;
					}
				}
			}

			return result;
		} finally {
			// Un-mark on backtrack: `visiting` guards against re-entering a
			// module that is an *ancestor* in the current recursion path (an
			// import cycle), not one already fully resolved earlier as a
			// sibling — e.g. two different export entries on the same module
			// both resolving through the same imported module must each see
			// it as unvisited.
			if (symbol) visiting.delete(symbol);
		}
	}

	private resolveVisibleProviders(
		moduleClass: NexusClass,
		moduleBySymbol: Map<ts.Symbol, NexusClass>,
		globalModules: readonly NexusClass[],
	): Map<TokenIdentity, { provider: NexusProvider; owner: NexusClass }> {
		const visible = new Map<
			TokenIdentity,
			{ provider: NexusProvider; owner: NexusClass }
		>();

		for (const [identity, provider] of this.resolveOwnProviderMap(
			moduleClass,
		)) {
			visible.set(identity, { provider, owner: moduleClass });
		}

		for (const importEntry of moduleClass.module?.imports ?? []) {
			const identity = getTokenIdentity(importEntry.module);
			if (identity === undefined || !isSymbolIdentity(identity)) continue;

			const importedModule = moduleBySymbol.get(identity);
			if (!importedModule) continue;

			for (const [exportedIdentity, entry] of this.resolveExportedProviders(
				importedModule,
				moduleBySymbol,
			)) {
				if (!visible.has(exportedIdentity)) {
					visible.set(exportedIdentity, entry);
				}
			}
		}

		for (const globalModule of globalModules) {
			for (const [exportedIdentity, entry] of this.resolveExportedProviders(
				globalModule,
				moduleBySymbol,
			)) {
				if (!visible.has(exportedIdentity)) {
					visible.set(exportedIdentity, entry);
				}
			}
		}

		return visible;
	}

	private classSymbol(nexusClass: NexusClass): ts.Symbol | undefined {
		const sourceFile = this.analyzer
			.getProgram()
			.getSourceFile(nexusClass.source.fileName);
		if (!sourceFile) return undefined;

		const declaration = this.findClassDeclarationAtSpan(
			sourceFile,
			nexusClass.source.start,
		);
		if (!declaration?.name) return undefined;

		return this.analyzer.getTypeChecker().getSymbolAtLocation(declaration.name);
	}

	private findClassDeclarationAtSpan(
		node: ts.Node,
		start: number,
	): ts.ClassDeclaration | undefined {
		if (ts.isClassDeclaration(node) && node.getStart() === start) return node;

		for (const child of node.getChildren()) {
			if (child.getFullStart() > start || child.getEnd() < start) continue;
			const match = this.findClassDeclarationAtSpan(child, start);
			if (match) return match;
		}

		return undefined;
	}
}

export function createNexusApplicationGraphBuilder(
	analyzer: NexusAnalyzer,
): NexusApplicationGraphBuilder {
	return new NexusApplicationGraphBuilder(analyzer);
}
