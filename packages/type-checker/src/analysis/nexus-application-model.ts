import type { NexusClass, NexusSourceSpan } from "./nexus-semantic-model";

/**
 * Semantic representation of a Nexus application rooted at an explicit class.
 *
 * `classes` contains each reachable Nexus class exactly once, in deterministic
 * breadth-first traversal order. TypeScript AST nodes are intentionally absent
 * from the public model.
 */
export type NexusApplication = {
	/** Source location of the class supplied to the application analyzer. */
	entryPoint: NexusSourceSpan;
	/** Reachable Nexus classes, deduplicated by TypeScript semantic identity. */
	classes: readonly NexusClass[];
};
