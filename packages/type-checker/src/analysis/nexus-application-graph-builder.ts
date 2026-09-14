import * as ts from "typescript";
import type { NexusAnalyzer } from "./nexus-analyzer";
import type {
	NexusApplicationGraph,
	NexusProviderCycle,
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
			cycles: this.detectCycles(moduleClasses),
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

	/** The symbol of the concrete class a provider instantiates, if any
	 * (`kind: "class"` or `"useClass"` only — `useValue`/`useFactory`
	 * provide a token, not a class). */
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
	): Map<TokenIdentity, NexusProvider> {
		const symbol = this.classSymbol(moduleClass);
		if (symbol) {
			if (visiting.has(symbol)) return new Map();
			visiting.add(symbol);
		}

		const ownProviders = this.resolveOwnProviderMap(moduleClass);
		const result = new Map<TokenIdentity, NexusProvider>();

		for (const exportEntry of moduleClass.module?.exports ?? []) {
			const identity = getTokenIdentity(exportEntry.token);
			if (identity === undefined) continue;

			const ownMatch = ownProviders.get(identity);
			if (ownMatch) {
				result.set(identity, ownMatch);
				continue;
			}

			if (isSymbolIdentity(identity)) {
				const referencedModule = moduleBySymbol.get(identity);
				if (referencedModule) {
					for (const [
						nestedIdentity,
						provider,
					] of this.resolveExportedProviders(
						referencedModule,
						moduleBySymbol,
						visiting,
					)) {
						result.set(nestedIdentity, provider);
					}
				}
			}
		}

		return result;
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

			for (const [exportedIdentity, provider] of this.resolveExportedProviders(
				importedModule,
				moduleBySymbol,
			)) {
				if (!visible.has(exportedIdentity)) {
					visible.set(exportedIdentity, { provider, owner: importedModule });
				}
			}
		}

		for (const globalModule of globalModules) {
			for (const [exportedIdentity, provider] of this.resolveExportedProviders(
				globalModule,
				moduleBySymbol,
			)) {
				if (!visible.has(exportedIdentity)) {
					visible.set(exportedIdentity, { provider, owner: globalModule });
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

	/** Detects `useFactory` `inject` cycles within each module's own provider
	 * registrations. Scoped per module (not merged across the application)
	 * so that two unrelated modules reusing the same token identity can't
	 * shadow one another's providers and silently hide a real cycle. This
	 * means a cycle that spans factory `inject` tokens registered as *own*
	 * providers of two *different* modules is not detected — accepted as
	 * out of scope, since cross-module token reuse for factory injection is
	 * already dubious DI design. */
	private detectCycles(
		moduleClasses: readonly NexusClass[],
	): NexusProviderCycle[] {
		const cycles: NexusProviderCycle[] = [];

		for (const moduleClass of moduleClasses) {
			const providersByIdentity = this.resolveOwnProviderMap(moduleClass);
			const visited = new Set<TokenIdentity>();
			const stack = new Set<TokenIdentity>();

			const visit = (identity: TokenIdentity, path: NexusProvider[]): void => {
				if (stack.has(identity)) {
					const cycleStart = path.findIndex(
						(provider) => getTokenIdentity(provider.provide) === identity,
					);
					const cyclePath = path.slice(cycleStart);
					const closingProvider = providersByIdentity.get(identity);
					cycles.push({
						path: closingProvider ? [...cyclePath, closingProvider] : cyclePath,
					});
					return;
				}
				if (visited.has(identity)) return;

				visited.add(identity);
				stack.add(identity);

				const provider = providersByIdentity.get(identity);
				if (provider) {
					for (const injectToken of provider.factoryInject) {
						const nextIdentity = getTokenIdentity(injectToken);
						if (nextIdentity !== undefined) {
							visit(nextIdentity, [...path, provider]);
						}
					}
				}

				stack.delete(identity);
			};

			for (const identity of providersByIdentity.keys()) {
				if (!visited.has(identity)) visit(identity, []);
			}
		}

		return cycles;
	}
}

export function createNexusApplicationGraphBuilder(
	analyzer: NexusAnalyzer,
): NexusApplicationGraphBuilder {
	return new NexusApplicationGraphBuilder(analyzer);
}
