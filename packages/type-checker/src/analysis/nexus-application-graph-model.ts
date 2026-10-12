import type {
	NexusClass,
	NexusProvider,
	NexusSourceSpan,
	NexusToken,
} from "./nexus-semantic-model";

export type NexusResolvedDependency = {
	class: NexusClass;
	dependencyName: string;
	provider: NexusProvider;
	providingModule: NexusClass;
	/** `true` when the class lives in a child scope and the provider was
	 * found through the declaring module's visibility in an ancestor scope. */
	fromParentScope: boolean;
};

export type NexusUnresolvedDependency = {
	class: NexusClass;
	dependencyName: string;
	token: NexusToken | undefined;
	source: NexusSourceSpan;
};

/**
 * Resolved view of a `NexusApplication`: which provider satisfies each
 * dependency, honoring module `imports`/`exports` scoping and `@Global()`
 * modules. Cycle detection is deliberately not part of this model — it is a
 * graph algorithm over these resolved edges, not a fact about the graph
 * itself, and lives in `@nexus-ioc/graph-analyzer` instead.
 */
export type NexusApplicationGraph = {
	resolved: readonly NexusResolvedDependency[];
	unresolved: readonly NexusUnresolvedDependency[];
};
