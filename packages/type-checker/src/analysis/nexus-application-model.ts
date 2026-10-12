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
	/** The root scope first (`rootId` = the entry class), then one scope per
	 * statically resolvable `@Module({ children })` entry, discovered breadth
	 * first. An application without `children` has exactly one scope whose
	 * `classIds` lists every class in `classes`. */
	scopes: readonly NexusScope[];
};

/**
 * A container scope: the application root, or a child container created
 * with `createChild()` from a module listed in some module's `children`.
 * A dependency that the scope's own module tree cannot provide falls back
 * to what the declaring module sees in the parent scope (see
 * `NexusResolvedDependency.fromParentScope`).
 */
export type NexusScope = {
	/** Root module class id of this scope (the app root, or a child module). */
	rootId: string;
	/** Module class id that declares this child scope; undefined for the app root scope. */
	declaredInId?: string;
	/** Parent scope's rootId; undefined for the app root scope. */
	parentRootId?: string;
	/** Ids of classes reachable from this scope's root via imports. */
	classIds: readonly string[];
};
