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
	optional: boolean;
}

export interface GraphProviderNode {
	/** Rendered identity of the provider's `provide` token. */
	token: string;
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
	/** Rendered identity of the `useClass` token, for `UseClass` providers. */
	useClass?: string;
}

export interface GraphModuleNode {
	name: string;
	path: string;
	isGlobal: boolean;
	/** Names of modules imported by this module. */
	imports: string[];
	/** Rendered identities of tokens this module exports. */
	exports: string[];
	providers: GraphProviderNode[];
}

export interface NexusGraphModel {
	entryModuleName: string;
	modules: Map<string, GraphModuleNode>;
}
