import type * as ts from "typescript";

export type NexusSourceSpan = {
	fileName: string;
	start: number;
	end: number;
	length: number;
};

export type NexusToken =
	| {
			kind: "string";
			value: string;
			source: NexusSourceSpan;
	  }
	| {
			kind: "symbol";
			declaration?: ts.Symbol;
			/** Stable `file:line:col` identity of `declaration`'s own declaration
			 * site, not the site this token was written at. `undefined` only when
			 * `declaration` itself is `undefined` or has no declaration (e.g. an
			 * ambient/global symbol). */
			id?: string;
			source: NexusSourceSpan;
	  }
	| {
			kind: "reference";
			symbol: ts.Symbol;
			/** Stable `file:line:col` identity of `symbol`'s declaration site, not
			 * the site this token was written at — two references to the same
			 * class (however imported/aliased/re-exported) always share this id.
			 * Always present: a `"reference"` token's symbol always resolves to a
			 * class declaration (see `NexusApplicationAnalyzer.resolveClassFromToken`). */
			id: string;
			source: NexusSourceSpan;
	  }
	| {
			kind: "expression";
			source: NexusSourceSpan;
	  };

export type NexusDependency = {
	location: "constructor" | "property";
	name: string;
	/** Position among constructor parameters. Only set for `location: "constructor"`. */
	index?: number;
	token?: NexusToken;
	optional: boolean;
	source: NexusSourceSpan;
};

/** A constructor parameter or property whose declared type resolves to a
 * class, but which carries no `@Inject` decorator. Such members never
 * become real dependency edges — the Nexus runtime container only ever
 * resolves explicitly `@Inject`-ed dependencies — but surfacing them lets
 * tooling warn about a likely-missing `@Inject()`. */
export type NexusUndeclaredDependency = {
	location: "constructor" | "property";
	name: string;
	/** Position among constructor parameters. Only set for `location: "constructor"`. */
	index?: number;
	/** The resolved class type, as a `"reference"` token. */
	inferredType: NexusToken;
	/** Whether the resolved class itself carries `@Injectable`/`@NsModule` —
	 * a stronger signal that omitting `@Inject` here is a mistake, though not
	 * a requirement for inclusion in this list. */
	isInferredTypeInjectable: boolean;
	source: NexusSourceSpan;
};

export type NexusDecoratorKind =
	| "Inject"
	| "Injectable"
	| "NsModule"
	| "Optional"
	| "Global";

export type NexusDecorator = {
	kind: NexusDecoratorKind;
	source: NexusSourceSpan;
};

export type NexusClass = {
	name?: string;
	/** Stable `file:line:col` identity of this class's own declaration site.
	 * Unlike `name`, always unique — two classes named the same in different
	 * files (or the same file) never share an `id`. Use this, not `name`, as
	 * a map/graph key. */
	id: string;
	source: NexusSourceSpan;
	decorators: readonly NexusDecorator[];
	dependencies: readonly NexusDependency[];
	/** Constructor parameters and properties whose type resolves to a class
	 * but which have no `@Inject` — likely-missing-decorator diagnostics, not
	 * real dependency edges. */
	undeclaredDependencies: readonly NexusUndeclaredDependency[];
	isInjectable: boolean;
	isModule: boolean;
	isGlobal: boolean;
	module?: NexusModule;
};

export type NexusProviderKind =
	| "class"
	| "useClass"
	| "useValue"
	| "useFactory";

export type NexusProvider = {
	kind: NexusProviderKind;
	provide: NexusToken;
	useClass?: NexusToken;
	factoryInject: readonly NexusToken[];
	scope?: NexusToken;
	source: NexusSourceSpan;
};

export type NexusModuleImport = {
	module: NexusToken;
	isDynamic: boolean;
	source: NexusSourceSpan;
};

export type NexusModuleExport = {
	token: NexusToken;
	source: NexusSourceSpan;
};

export type NexusModule = {
	providers: readonly NexusProvider[];
	imports: readonly NexusModuleImport[];
	exports: readonly NexusModuleExport[];
};
