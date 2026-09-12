import type { NexusClass, NexusSourceSpan } from "./nexus-semantic-model";

/**
 * Semantic representation of a Nexus application rooted at an explicit class.
 *
 * `entryPoint` is the source span of the exact class declaration supplied to
 * `NexusApplicationAnalyzer.analyze()`.
 *
 * `classes` contains every reachable Nexus class exactly once, discovered in
 * deterministic breadth-first order. Reachability is based on traversable
 * `NexusToken.reference` dependencies that resolve to class declarations.
 * TypeScript AST nodes are intentionally absent from the public model.
 */
export type NexusApplication = {
	/** Source location of the class supplied to the application analyzer. */
	entryPoint: NexusSourceSpan;
	/** Reachable Nexus classes, deduplicated by TypeScript semantic identity. */
	classes: readonly NexusClass[];
};
