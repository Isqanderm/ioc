import * as ts from "typescript";
import type { NexusAnalyzer } from "./nexus-analyzer";
import type {
	NexusApplicationGraph,
	NexusResolvedDependency,
	NexusUnresolvedDependency,
} from "./nexus-application-graph-model";
import type { NexusApplication } from "./nexus-application-model";
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

function isSymbolIdentity(identity: TokenIdentity): identity is ts.Symbol {
	return typeof identity !== "string";
}

/** Resolves a `NexusApplication` into a module-scoped dependency graph. */
export class NexusApplicationGraphBuilder {
	public constructor(private readonly analyzer: NexusAnalyzer) {}

	public build(application: NexusApplication): NexusApplicationGraph {
		const moduleClasses = application.classes.filter(
			(
				item,
			): item is NexusClass & { module: NonNullable<NexusClass["module"]> } =>
				item.module !== undefined,
		);
		const moduleBySymbol = this.indexModulesBySymbol(moduleClasses);
		const globalModules = moduleClasses.filter((item) => item.isGlobal);

		const visibleProvidersByModule = new Map<
			ts.Symbol,
			Map<TokenIdentity, { provider: NexusProvider; owner: NexusClass }>
		>();
		for (const moduleClass of moduleClasses) {
			const symbol = this.classSymbol(moduleClass);
			if (!symbol) continue;
			visibleProvidersByModule.set(
				symbol,
				this.resolveVisibleProviders(
					moduleClass,
					moduleBySymbol,
					globalModules,
				),
			);
		}

		const providingModulesByClassSymbol =
			this.indexProvidersByClassSymbol(moduleClasses);

		const resolved: NexusResolvedDependency[] = [];
		const unresolved: NexusUnresolvedDependency[] = [];

		for (const nexusClass of application.classes) {
			const scopes = this.resolveScopesFor(
				nexusClass,
				providingModulesByClassSymbol,
				visibleProvidersByModule,
				moduleBySymbol,
				globalModules,
			);

			for (const dependency of nexusClass.dependencies) {
				const identity = getTokenIdentity(dependency.token);
				const match =
					identity !== undefined
						? scopes.map((scope) => scope.get(identity)).find(Boolean)
						: undefined;

				if (match) {
					resolved.push({
						class: nexusClass,
						dependencyName: dependency.name,
						provider: match.provider,
						providingModule: match.owner,
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

		return {
			resolved,
			unresolved,
		};
	}

	private resolveScopesFor(
		nexusClass: NexusClass,
		providingModulesByClassSymbol: Map<ts.Symbol, NexusClass[]>,
		visibleProvidersByModule: Map<
			ts.Symbol,
			Map<TokenIdentity, { provider: NexusProvider; owner: NexusClass }>
		>,
		moduleBySymbol: Map<ts.Symbol, NexusClass>,
		globalModules: readonly NexusClass[],
	): Map<TokenIdentity, { provider: NexusProvider; owner: NexusClass }>[] {
		if (nexusClass.module) {
			const symbol = this.classSymbol(nexusClass);
			const cached = symbol && visibleProvidersByModule.get(symbol);
			return [
				cached ??
					this.resolveVisibleProviders(
						nexusClass,
						moduleBySymbol,
						globalModules,
					),
			];
		}

		const symbol = this.classSymbol(nexusClass);
		const owningModules = symbol
			? (providingModulesByClassSymbol.get(symbol) ?? [])
			: [];

		return owningModules.map((owner) => {
			const ownerSymbol = this.classSymbol(owner);
			const cached = ownerSymbol && visibleProvidersByModule.get(ownerSymbol);
			return (
				cached ??
				this.resolveVisibleProviders(owner, moduleBySymbol, globalModules)
			);
		});
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
