/**
 * String-keyed intermediate representation of a Nexus IoC application graph,
 * built from `@nexus-ioc/type-checker`'s `NexusApplication`/`NexusApplicationGraph`.
 * The four analyzers in this package operate on this shape rather than on
 * `ts.Program`/`ts.Symbol` directly, keeping their algorithms (DFS, BFS)
 * independent of the underlying semantic-analysis layer.
 */

export interface GraphProviderDependency {
	/** Rendered identity of the dependency's token. */
	token: string;
	/** Internal-only collision-free identity of the resolved dependency
	 * (`NexusToken.id`-derived), when resolvable — never serialized to
	 * public JSON. Analyzers must match dependencies by this, not `token`. */
	tokenId?: string;
	optional: boolean;
	/** Set (to `true`) only when the provider lives in a child scope and the
	 * dependency is provided by an ancestor scope instead of its own.
	 *
	 * Approximate: "provided" means some module of the scope registers the
	 * token, not that the token is visible to the provider's module under
	 * imports/exports rules (this model has no `ts.Program` to apply them).
	 * For the visibility-correct answer use `@nexus-ioc/type-checker`'s
	 * `NexusResolvedDependency.fromParentScope`. */
	crossScope?: boolean;
}

/** A constructor parameter or property whose type resolves to a class but
 * carries no `@Inject` — a likely-missing-decorator diagnostic, not a real
 * dependency edge. Mirrors `@nexus-ioc/type-checker`'s
 * `NexusUndeclaredDependency`, rendered down to display strings. */
export interface GraphUndeclaredDependency {
	location: "constructor" | "property";
	name: string;
	/** Rendered identity of the inferred class type. */
	token: string;
	isInferredTypeInjectable: boolean;
}

export interface GraphProviderNode {
	/** Rendered identity of the provider's `provide` token. */
	token: string;
	/** Internal-only collision-free identity of this provider's `provide`
	 * token — never serialized to public JSON. Analyzers must match
	 * providers by this, not `token`. */
	id: string;
	type: "Class" | "UseValue" | "UseFactory" | "UseClass";
	/** Rendered scope token, if the provider declares one (e.g. "Transient"). */
	scope?: string;
	/**
	 * Every dependency this provider's resolution can cycle through:
	 * constructor/property-injected dependencies of the underlying class for
	 * `Class`/`UseClass` providers, and `inject` tokens for `UseFactory`
	 * providers. Merging both into one list is what lets circular-dependency
	 * detection cover constructor-injection cycles *and* factory-inject
	 * cycles, which neither prior implementation did on its own.
	 */
	dependencies: GraphProviderDependency[];
	/** Constructor parameters/properties that look like dependencies but have
	 * no `@Inject` — see `GraphUndeclaredDependency`. */
	undeclaredDependencies: GraphUndeclaredDependency[];
	/** Rendered identity of the `useClass` token, for `UseClass` providers. */
	useClass?: string;
}

/** A reference to a module or exported token from `GraphModuleNode.imports`/
 * `exports`. `path` disambiguates same-named modules/tokens declared in
 * different files — the reason renderers can resolve edges correctly even
 * when `name` collides. `id` is internal-only (never serialized to public
 * JSON); the public `ModuleInfo.imports`/`exports` shape is `{name, path}`. */
export interface GraphModuleReference {
	/** Internal-only collision-free identity — never serialized to public JSON. */
	id: string;
	name: string;
	path?: string;
}

export interface GraphModuleNode {
	name: string;
	/** Internal-only collision-free identity of this module (this node's key
	 * in `NexusGraphModel.modules`) — never serialized to public JSON. */
	id: string;
	path: string;
	isGlobal: boolean;
	/** Modules imported by this module. */
	imports: GraphModuleReference[];
	/** Tokens this module exports. */
	exports: GraphModuleReference[];
	providers: GraphProviderNode[];
	/** `rootId` of the (first) scope this module belongs to. Present only
	 * when the application has child scopes (`NexusGraphModel.scopes`). */
	scope?: string;
	/** Statically resolved `@Module({ children })` entries. Present only when
	 * non-empty. Children are not imports: they open a child scope. */
	children?: GraphModuleReference[];
}

/** A container scope: the application root, or a child module's scope.
 * Mirrors `@nexus-ioc/type-checker`'s `NexusScope`, restricted to modules. */
export interface GraphScope {
	rootId: string;
	/** Module id that declares this child scope; absent for the root scope. */
	declaredInId?: string;
	/** Parent scope's `rootId`; absent for the root scope. */
	parentRootId?: string;
	/** Ids of the modules in this scope, in discovery order. */
	moduleIds: string[];
}

export interface NexusGraphModel {
	entryModuleId: string;
	/** Keyed by `GraphModuleNode.id`, not `name` — two modules named alike in
	 * different files never collide here. */
	modules: Map<string, GraphModuleNode>;
	/** Root scope first, then each child scope. Present only when the
	 * application declares at least one child scope via `children`; a
	 * single-scope application leaves it `undefined`. */
	scopes?: GraphScope[];
}
