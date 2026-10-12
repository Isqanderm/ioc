import type { GraphScope, NexusGraphModel } from "./nexus-graph-model";

/**
 * Scope lookups over `NexusGraphModel.scopes`. A token needed in a child
 * scope is created by the nearest scope (the scope itself first, then its
 * ancestors) that registers a provider for it — the runtime's "local first,
 * then through the parent link" rule, approximated by "registered anywhere
 * in the scope" rather than by full module visibility.
 */
export class GraphScopeIndex {
	private readonly scopesByRootId = new Map<string, GraphScope>();
	private readonly providerIdsByScope = new Map<string, Set<string>>();

	public constructor(graphModel: NexusGraphModel) {
		for (const scope of graphModel.scopes ?? []) {
			this.scopesByRootId.set(scope.rootId, scope);
			const providerIds = new Set<string>();
			for (const moduleId of scope.moduleIds) {
				for (const provider of graphModel.modules.get(moduleId)?.providers ??
					[]) {
					providerIds.add(provider.id);
				}
			}
			this.providerIdsByScope.set(scope.rootId, providerIds);
		}
	}

	/** `rootId` of the nearest scope, starting at `scopeRootId`, that
	 * registers `tokenId`; `undefined` when no scope on the chain does. */
	public providingScope(
		scopeRootId: string,
		tokenId: string,
	): string | undefined {
		const seen = new Set<string>();
		let current = this.scopesByRootId.get(scopeRootId);
		while (current && !seen.has(current.rootId)) {
			seen.add(current.rootId);
			if (this.providerIdsByScope.get(current.rootId)?.has(tokenId)) {
				return current.rootId;
			}
			current =
				current.parentRootId !== undefined
					? this.scopesByRootId.get(current.parentRootId)
					: undefined;
		}
		return undefined;
	}
}
