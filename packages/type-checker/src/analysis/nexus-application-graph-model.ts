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
};

export type NexusUnresolvedDependency = {
	class: NexusClass;
	dependencyName: string;
	token: NexusToken | undefined;
	source: NexusSourceSpan;
};

export type NexusProviderCycle = {
	path: readonly NexusProvider[];
};

/**
 * Resolved view of a `NexusApplication`: which provider satisfies each
 * dependency, honoring module `imports`/`exports` scoping and `@Global()`
 * modules, plus any provider dependency cycles found in the process.
 */
export type NexusApplicationGraph = {
	resolved: readonly NexusResolvedDependency[];
	unresolved: readonly NexusUnresolvedDependency[];
	cycles: readonly NexusProviderCycle[];
};
