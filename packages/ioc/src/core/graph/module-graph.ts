import {
	type Edge,
	EdgeTypeEnum,
	type GraphError,
	type GraphSegment,
	type InjectionToken,
	type LazyModule,
	MODULE_TOKEN_WATERMARK,
	MODULE_WATERMARK,
	type ModuleContainerInterface,
	type ModuleGraphInterface,
	type Node,
	NodeTypeEnum,
	PROPERTY_DEPS_METADATA,
	PROPERTY_OPTIONAL_DEPS_METADATA,
	type Provider,
	SELF_DECLARED_DEPS_METADATA,
	SELF_DECLARED_OPTIONAL_DEPS_METADATA,
	type Type,
	type UnloadResult,
} from "../../interfaces";
import type { ForwardRef } from "../../utils/forward-ref";
import { isForwardRef } from "../../utils/forward-ref";
import {
	getDependencyToken,
	getModuleLabel,
	getProviderToken,
	isModule,
} from "../../utils/helpers";
import { AnalyzeLazyModule } from "./analyze-lazy-module";
import { AnalyzeModule } from "./analyze-module";
import type { AnalyzeProvider } from "./analyze-provider";
import {
	isAnalyzeClassProvider,
	isAnalyzeFactoryProvider,
	isAnalyzeFunctionProvider,
} from "./helpers";
import type { AnalyzeClassProvider } from "./providers/analyze-class-provider";
import type { AnalyzeFactoryProvider } from "./providers/analyze-factory-provider";
import type { AnalyzeFunctionProvider } from "./providers/analyze-function-provider";
import { ProviderFactory } from "./providers/provider-factory";

/**
 * Helper function to safely convert InjectionToken to string for error messages
 */
function tokenToString(token: InjectionToken): string {
	return typeof token === "function" ? token.name : String(token);
}

export class ModuleGraph implements ModuleGraphInterface {
	private _nodes: Map<InjectionToken, Node> = new Map();
	private _edges: Map<InjectionToken, Edge[]> = new Map();
	private _globalModules: Map<InjectionToken, ModuleContainerInterface> =
		new Map();
	/** Module token -> its own declared provider tokens. */
	private readonly _moduleProviders: Map<string, Set<InjectionToken>> =
		new Map();
	/**
	 * Module token -> the other module tokens that need it alive: every
	 * module that imports it, plus every module owning a provider that
	 * depends (via a resolved `DEPENDENCY` edge, including one resolved
	 * through a `@Global()` module) on one of its providers.
	 */
	private readonly _moduleReferrers: Map<string, Set<string>> = new Map();
	private readonly _errors: GraphError[] = [];
	/**
	 * While a segment compiles, its errors are collected here instead of in
	 * `_errors`, so they are never mixed with (or mistaken for) errors of the
	 * eager graph or of another segment.
	 */
	private _errorSink: GraphError[] | null = null;

	constructor(
		private readonly _root: ModuleContainerInterface,
		private readonly _internalRoots: ModuleContainerInterface[] = [],
	) {}

	public get nodes() {
		return this._nodes;
	}

	public get edges() {
		return this._edges;
	}

	public get errors() {
		return this._errors;
	}

	public get rootToken(): string {
		return this._root.token;
	}

	public get internalRootTokens(): string[] {
		return this._internalRoots.map((root) => root.token);
	}

	/** Records a graph error in the active sink, or in the shared list. */
	private pushError(error: GraphError) {
		(this._errorSink ?? this._errors).push(error);
	}

	/**
	 * Compiles the eager graph. Internal roots are added before the user root so
	 * `_globalModules` already contains the internal modules when user providers
	 * are checked by `isProviderExported`.
	 */
	public async compile() {
		const moduleTokens: string[] = [];
		const providerTokens: InjectionToken[] = [];

		for (const root of [...this._internalRoots, this._root]) {
			const added = await this.addModules(root, false);

			moduleTokens.push(...added.moduleTokens);
			providerTokens.push(...added.providerTokens);
		}

		await this.addDependencies(providerTokens);
		await this.detectCircularDependencies(providerTokens);
		await this.detectCircularImports(moduleTokens);
	}

	/**
	 * Compiles the part of the graph reachable from `root` that is not already
	 * registered, attributing it to the `lazyModule` placeholder node.
	 *
	 * The pass is atomic: if it produces any error the segment is rolled back
	 * (every node, edge, global registration and LAZY placeholder it created is
	 * removed) and the placeholder stays unloaded. On success the placeholder is
	 * marked loaded. A placeholder that already existed before the segment
	 * started is never removed.
	 *
	 * The segment's errors are collected in a segment-local sink and never
	 * reach `this.errors`, so they cannot be attributed to the eager graph or
	 * to another segment. The caller (`Container.load`) runs one segment at a
	 * time, which is what makes the sink and the graph mutations safe under
	 * concurrent loads of different refs.
	 */
	public async compileSegment(
		root: ModuleContainerInterface,
		lazyModule: LazyModule,
	): Promise<GraphSegment> {
		const createdPlaceholder = !this._nodes.has(lazyModule.id);

		if (createdPlaceholder) {
			this.addNode(lazyModule.id, new AnalyzeLazyModule(lazyModule));
		}

		const errors: GraphError[] = [];
		const previousSink = this._errorSink;
		this._errorSink = errors;

		try {
			const added = await this.addModules(root, true);

			await this.addDependencies(added.providerTokens);
			await this.detectCircularDependencies(added.providerTokens);
			await this.detectCircularImports(added.moduleTokens);

			if (errors.length > 0) {
				this.removeTokens([
					...added.moduleTokens,
					...added.providerTokens,
					...added.lazyTokens,
					...(createdPlaceholder ? [lazyModule.id] : []),
				]);
			} else {
				(this._nodes.get(lazyModule.id) as AnalyzeLazyModule).markLoaded(
					root.token,
				);
			}

			return {
				lazyModule,
				moduleContainer: root,
				moduleTokens: added.moduleTokens,
				providerTokens: added.providerTokens,
				errors,
			};
		} finally {
			this._errorSink = previousSink;
		}
	}

	/**
	 * Rolls back a segment that failed validation: removes every node, edge
	 * and global registration it created (module, provider and LAZY
	 * placeholder tokens are all passed in together). Also purges
	 * `_moduleProviders`/`_moduleReferrers` index entries for `tokens` via
	 * `purgeModuleIndexes` — without this, a referrer entry recorded by
	 * `addModuleImports` before the rollback (pointing at a module token
	 * that no longer exists) would survive and could later be mistaken by
	 * `rescueCandidates` for a live outside referrer of a module reused by a
	 * different, successful segment.
	 */
	private removeTokens(tokens: InjectionToken[]) {
		this.purgeModuleIndexes(tokens);

		for (const token of tokens) {
			this._nodes.delete(token);
			this._edges.delete(token);
			this._globalModules.delete(token);
		}
	}

	/**
	 * Unloads a loaded lazy segment. Scoped to the segment's own subgraph,
	 * not the whole live graph: collects everything reachable from the
	 * segment's root (pruned at any module in `protectedRoots` — the eager
	 * root, internal roots, and every *other* currently loaded segment's
	 * root), then rescues back anything a survivor still needs. Returns the
	 * modules and providers that were actually destroyed; a no-op (empty
	 * result) if the ref is not currently loaded.
	 */
	public unloadSegment(
		lazyModule: LazyModule,
		protectedRoots: Set<string>,
	): UnloadResult {
		const placeholder = this._nodes.get(lazyModule.id) as
			| AnalyzeLazyModule
			| undefined;

		if (
			!placeholder ||
			!placeholder.loaded ||
			placeholder.moduleToken === null
		) {
			return { destroyedModules: [], destroyedProviders: [] };
		}

		const candidates = this.collectCandidates(
			placeholder.moduleToken,
			protectedRoots,
		);
		const alive = this.rescueCandidates(candidates);

		const destroyedModules: string[] = [];
		const destroyedProviders: InjectionToken[] = [];

		for (const moduleToken of candidates) {
			if (alive.has(moduleToken)) {
				continue;
			}
			destroyedModules.push(moduleToken);
			for (const providerToken of this._moduleProviders.get(moduleToken) ??
				[]) {
				destroyedProviders.push(providerToken);
			}
		}

		this.removeModuleTokens(destroyedModules, destroyedProviders);
		placeholder.markUnloaded();

		return { destroyedModules, destroyedProviders };
	}

	/** A module's own `IMPORT` targets, plus the declaring modules of
	 * whatever its own providers depend on in another module. Shared by
	 * candidate collection, rescue propagation and teardown cleanup. */
	private moduleDependencies(moduleToken: string): string[] {
		const dependencies: string[] = [];

		for (const edge of this.getEdge(moduleToken)) {
			if (edge.type === EdgeTypeEnum.IMPORT) {
				dependencies.push(edge.source as string);
			}
		}

		for (const providerToken of this._moduleProviders.get(moduleToken) ?? []) {
			for (const edge of this.getEdge(providerToken)) {
				if (edge.type !== EdgeTypeEnum.DEPENDENCY || edge.metadata.unreached) {
					continue;
				}
				const dependency = this._nodes.get(edge.target);
				if (dependency?.type === NodeTypeEnum.PROVIDER) {
					dependencies.push(
						(dependency as AnalyzeProvider).moduleContainer.token,
					);
				}
			}
		}

		return dependencies;
	}

	private collectCandidates(
		rootToken: string,
		protectedRoots: Set<string>,
	): Set<string> {
		const candidates = new Set<string>();
		const queue: string[] = [rootToken];

		while (queue.length) {
			const moduleToken = queue.shift() as string;

			if (protectedRoots.has(moduleToken) || candidates.has(moduleToken)) {
				continue;
			}

			candidates.add(moduleToken);
			queue.push(...this.moduleDependencies(moduleToken));
		}

		return candidates;
	}

	/**
	 * A candidate survives if something outside the candidate set still
	 * needs it (a "seed"), or if it is only reachable through a candidate
	 * that survives. A plain per-node check for the first case alone is not
	 * enough — see the "rescues a module only reachable through a surviving
	 * sibling candidate" test.
	 */
	private rescueCandidates(candidates: Set<string>): Set<string> {
		const alive = new Set<string>();
		const queue: string[] = [];

		for (const moduleToken of candidates) {
			const referrers = this._moduleReferrers.get(moduleToken);
			const hasOutsideReferrer =
				referrers &&
				[...referrers].some((referrer) => !candidates.has(referrer));

			if (hasOutsideReferrer) {
				queue.push(moduleToken);
			}
		}

		while (queue.length) {
			const moduleToken = queue.shift() as string;

			if (alive.has(moduleToken)) {
				continue;
			}

			alive.add(moduleToken);
			queue.push(
				...this.moduleDependencies(moduleToken).filter((token) =>
					candidates.has(token),
				),
			);
		}

		return alive;
	}

	private removeModuleTokens(
		moduleTokens: string[],
		providerTokens: InjectionToken[],
	) {
		// Drop stale referrer entries, and the modules' own index entries,
		// before deleting the edges they were derived from, so a module that
		// stays alive never keeps a phantom referrer from a module that no
		// longer exists.
		//
		// Note: this only removes edges from the maps keyed by the destroyed
		// tokens themselves, not from every place a destroyed token might
		// still appear as an edge *target* elsewhere — e.g. an
		// `unreached: true` DEPENDENCY edge left on a surviving provider, or
		// a LAZY placeholder edge whose declaring module was destroyed.
		// That's safe for resolution (`Resolver.resolveProvider` already
		// returns `undefined` for a missing node), but graph-introspection
		// consumers (like `graph-analyzer`) can still see these as orphaned
		// edge references.
		this.purgeModuleIndexes(moduleTokens);

		for (const providerToken of providerTokens) {
			this._nodes.delete(providerToken);
			this._edges.delete(providerToken);
		}

		for (const moduleToken of moduleTokens) {
			this._nodes.delete(moduleToken);
			this._edges.delete(moduleToken);
			this._globalModules.delete(moduleToken);
		}
	}

	/**
	 * Purges `_moduleProviders`/`_moduleReferrers` index entries for
	 * `tokens`, and removes each of them from any surviving module's
	 * referrer set. Shared by `removeModuleTokens` (destroying a live
	 * segment) and `removeTokens` (rolling back a failed one).
	 *
	 * `tokens` may freely mix module tokens with provider or LAZY
	 * placeholder tokens: both indexes are keyed by module tokens only, so a
	 * lookup or delete with a non-module key is a harmless no-op.
	 *
	 * Must run before the tokens' own `_edges` entries (and, for a removed
	 * module, its `_moduleProviders` entry) are deleted — `moduleDependencies`
	 * reads both to determine what each token itself depended on.
	 */
	private purgeModuleIndexes(tokens: InjectionToken[]) {
		for (const token of tokens) {
			for (const dependencyModule of this.moduleDependencies(token as string)) {
				this._moduleReferrers.get(dependencyModule)?.delete(token as string);
			}
		}

		for (const token of tokens) {
			this._moduleProviders.delete(token as string);
			this._moduleReferrers.delete(token as string);
		}
	}

	public getNode(token: InjectionToken): Node | undefined {
		return this._nodes.get(token);
	}

	public getEdge(token: InjectionToken) {
		return this._edges.get(token) || [];
	}

	public getAllEdges(): Edge[][] {
		return [...this._edges.values()];
	}

	public getAllNodes(): Node[] {
		return [...this._nodes.values()];
	}

	// modules analyze
	private async addModules(
		root: ModuleContainerInterface,
		strictTokens: boolean,
	): Promise<{
		moduleTokens: string[];
		providerTokens: InjectionToken[];
		lazyTokens: symbol[];
	}> {
		const moduleTokens: string[] = [];
		const providerTokens: InjectionToken[] = [];
		const lazyTokens: symbol[] = [];
		const visited = new Set<InjectionToken>();
		const imports = [root];

		while (imports.length) {
			const importModule = imports.shift();

			if (!importModule || visited.has(importModule.token)) {
				continue;
			}

			visited.add(importModule.token);

			if (this._nodes.has(importModule.token)) {
				// Already part of the graph (eager module or an earlier segment).
				continue;
			}

			const analyzeModule = new AnalyzeModule(importModule);

			await this.addModule(analyzeModule);
			moduleTokens.push(analyzeModule.id);
			lazyTokens.push(...(await this.addModuleImports(analyzeModule)));
			providerTokens.push(
				...(await this.addModuleProviders(analyzeModule, strictTokens)),
			);

			imports.push(...(await analyzeModule.imports));
		}

		return { moduleTokens, providerTokens, lazyTokens };
	}

	private async addModule(analyzeModule: AnalyzeModule) {
		this.addNode(analyzeModule.id, analyzeModule);

		if (analyzeModule.isGlobal) {
			this._globalModules.set(analyzeModule.id, analyzeModule.moduleContainer);
		}
	}

	/**
	 * @returns the ids of the LAZY placeholder nodes this call created, so a
	 * rolled back segment can remove them again. Placeholders that already
	 * existed are not reported and must never be removed.
	 */
	private async addModuleImports(
		analyzeModule: AnalyzeModule,
	): Promise<symbol[]> {
		const createdLazyIds: symbol[] = [];
		const imports = await analyzeModule.edges;

		for (const importEdge of imports) {
			this.addEdge(analyzeModule.id, importEdge);
			this.addModuleReferrer(importEdge.source as string, analyzeModule.id);
		}

		for (const lazyModule of analyzeModule.lazyImports) {
			if (!this._nodes.has(lazyModule.id)) {
				this.addNode(lazyModule.id, new AnalyzeLazyModule(lazyModule));
				createdLazyIds.push(lazyModule.id);
			}
		}

		for (const lazyEdge of analyzeModule.lazyEdges) {
			this.addEdge(analyzeModule.id, lazyEdge);
		}

		return createdLazyIds;
	}

	private async addModuleProviders(
		analyzeModule: AnalyzeModule,
		strictTokens: boolean,
	): Promise<InjectionToken[]> {
		const added: InjectionToken[] = [];

		for (const provider of analyzeModule.providers) {
			const analyzeProvider = ProviderFactory(
				provider,
				analyzeModule.moduleContainer,
			);

			if (analyzeProvider === null) {
				continue;
			}

			const existing = this._nodes.get(analyzeProvider.id);

			if (
				strictTokens &&
				existing &&
				existing.type === NodeTypeEnum.PROVIDER &&
				(existing as AnalyzeProvider).moduleContainer.token !==
					analyzeModule.moduleContainer.token
			) {
				this.pushError({
					type: "PROVIDER_TOKEN_CONFLICT",
					token: analyzeProvider.label,
					module: analyzeModule.label,
					existingModule: getModuleLabel(
						(existing as AnalyzeProvider).moduleContainer.metatype,
					),
				});
				continue;
			}

			this.addNode(analyzeProvider.id, analyzeProvider);
			this.addEdge(analyzeModule.id, analyzeProvider.edge);
			this.addModuleProvider(analyzeModule.id, analyzeProvider.id);
			added.push(analyzeProvider.id);
		}

		return added;
	}
	// modules analyze

	// graph helpers
	private addEdge(token: InjectionToken, edge: Edge) {
		const edges: Edge[] = this._edges.get(token) || [];

		edges.push(edge);

		this._edges.set(token, edges);
	}

	private addNode(token: InjectionToken, node: Node) {
		this._nodes.set(token, node);
	}

	private addModuleProvider(
		moduleToken: string,
		providerToken: InjectionToken,
	) {
		const providers = this._moduleProviders.get(moduleToken) ?? new Set();
		providers.add(providerToken);
		this._moduleProviders.set(moduleToken, providers);
	}

	private addModuleReferrer(dependencyModule: string, referrerModule: string) {
		const referrers = this._moduleReferrers.get(dependencyModule) ?? new Set();
		referrers.add(referrerModule);
		this._moduleReferrers.set(dependencyModule, referrers);
	}

	/**
	 * Records that `consumerToken` (a provider) keeps `dependencyToken`'s
	 * declaring module alive, when the two providers are declared in
	 * different modules. Called after every `DEPENDENCY` edge is added,
	 * regardless of how the dependency was resolved (own module, import, or
	 * `@Global()` fallback) — the edge already reflects that, so this needs
	 * no help from `isProviderExported`.
	 */
	private recordCrossModuleReferrer(
		consumerToken: InjectionToken,
		dependencyToken: InjectionToken,
		isExported: boolean,
	) {
		if (!isExported) {
			return;
		}

		const consumer = this._nodes.get(consumerToken);
		const dependency = this._nodes.get(dependencyToken);

		if (
			consumer?.type !== NodeTypeEnum.PROVIDER ||
			dependency?.type !== NodeTypeEnum.PROVIDER
		) {
			return;
		}

		const consumerModule = (consumer as AnalyzeProvider).moduleContainer.token;
		const dependencyModule = (dependency as AnalyzeProvider).moduleContainer
			.token;

		if (consumerModule !== dependencyModule) {
			this.addModuleReferrer(dependencyModule, consumerModule);
		}
	}
	// graph helpers

	// providers dependencies
	private async addDependencies(providerTokens: InjectionToken[]) {
		const visited = new Set<InjectionToken>();

		for (const token of providerTokens) {
			const node = this._nodes.get(token);

			if (!node || node.type !== NodeTypeEnum.PROVIDER || visited.has(token)) {
				continue;
			}

			if (isAnalyzeFactoryProvider(node)) {
				await this.addFactoryProviderDependency(token, node);
			} else if (isAnalyzeClassProvider(node)) {
				await this.addClassProviderDependency(token, node);
			} else if (isAnalyzeFunctionProvider(node)) {
				await this.addClassDependency(token, node);
			}

			visited.add(token);
		}
	}

	private async addClassDependency(
		token: InjectionToken,
		node: AnalyzeFunctionProvider,
	) {
		const constructorDependencies = this.getConstructorDependencies(
			node.metatype,
		);
		const optionalDependency = this.getOptionalConstructorDependencies(
			node.metatype,
		);

		for (const [index, dependency] of constructorDependencies.entries()) {
			const isLazy = isForwardRef(dependency.param);
			const dependencyToken: InjectionToken = isLazy
				? ((
						dependency.param as unknown as ForwardRef
					).forwardRef() as InjectionToken)
				: getDependencyToken(dependency.param);
			const isExported =
				optionalDependency.includes(index) ||
				(await this.isProviderExported(node.moduleContainer, dependencyToken));

			if (!isExported) {
				this.pushError({
					type: "UNREACHED_DEP_CONSTRUCTOR",
					token: node.label,
					dependency: tokenToString(dependencyToken),
					position: dependency.index,
				});
			}

			const newEdge: Edge = {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					lazy: isLazy,
					index: dependency.index,
					inject: "constructor",
				},
			};

			this.addEdge(token, newEdge);
			this.recordCrossModuleReferrer(token, dependencyToken, isExported);
		}

		const propertiesDependencies = this.getPropertiesDependencies(
			node.metatype,
		);
		const optionalProperties = this.getOptionalPropertyDependencies(
			node.metatype,
		);

		for (const dependency of propertiesDependencies) {
			const dependencyToken = getDependencyToken(dependency.type);
			const isExported =
				optionalProperties.includes(dependency.key) ||
				(await this.isProviderExported(node.moduleContainer, dependencyToken));

			if (!isExported) {
				this.pushError({
					type: "UNREACHED_DEP_PROPERTY",
					token: node.label,
					dependency: tokenToString(dependencyToken),
					key: dependency.key,
				});
			}

			const newEdge: Edge = {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					key: dependency.key,
					inject: "property",
				},
			};

			this.addEdge(token, newEdge);
			this.recordCrossModuleReferrer(token, dependencyToken, isExported);
		}
	}

	private async addClassProviderDependency(
		token: InjectionToken,
		node: AnalyzeClassProvider,
	) {
		const Class = node.useClass;
		const constructorDependencies = this.getConstructorDependencies(Class);
		const optionalDependency = this.getOptionalConstructorDependencies(Class);

		for (const [index, dependency] of constructorDependencies.entries()) {
			const isLazy = isForwardRef(dependency.param);
			const dependencyToken: InjectionToken = isLazy
				? ((
						dependency.param as unknown as ForwardRef
					).forwardRef() as InjectionToken)
				: getDependencyToken(dependency.param);
			const isExported =
				optionalDependency.includes(index) ||
				(await this.isProviderExported(node.moduleContainer, dependencyToken));

			if (!isExported) {
				this.pushError({
					type: "UNREACHED_DEP_CONSTRUCTOR",
					token: node.label,
					dependency: tokenToString(dependencyToken),
					position: dependency.index,
				});
			}

			const newEdge: Edge = {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					lazy: isLazy,
					index: dependency.index,
					inject: "constructor",
				},
			};

			this.addEdge(token, newEdge);
			this.recordCrossModuleReferrer(token, dependencyToken, isExported);
		}

		const propertiesDependencies = this.getPropertiesDependencies(Class);
		const optionalProperty = this.getOptionalPropertyDependencies(Class);

		for (const dependency of propertiesDependencies) {
			const dependencyToken = getDependencyToken(dependency.type);
			const isExported =
				optionalProperty.includes(dependency.key) ||
				(await this.isProviderExported(node.moduleContainer, dependencyToken));

			if (!isExported) {
				this.pushError({
					type: "UNREACHED_DEP_PROPERTY",
					token: node.label,
					dependency: tokenToString(dependencyToken),
					key: dependency.key,
				});
			}

			this.addEdge(token, {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					key: dependency.key,
					inject: "property",
				},
			});
			this.recordCrossModuleReferrer(token, dependencyToken, isExported);
		}
	}

	private async addFactoryProviderDependency(
		token: InjectionToken,
		node: AnalyzeFactoryProvider,
	) {
		const dependencies = node.inject || [];
		let index = 0;

		for (const dependency of dependencies) {
			const isLazy = isForwardRef(dependency);
			const dependencyToken: InjectionToken = isLazy
				? ((dependency as ForwardRef).forwardRef() as InjectionToken)
				: (dependency as InjectionToken);

			const isExported = await this.isProviderExported(
				node.moduleContainer,
				dependencyToken,
			);

			if (!isExported) {
				this.pushError({
					type: "UNREACHED_DEP_FACTORY",
					token: node.label,
					dependency: tokenToString(dependencyToken),
					key: index,
				});
			}

			const factoryDependency: Edge = {
				type: EdgeTypeEnum.DEPENDENCY,
				source: token,
				target: dependencyToken,
				metadata: {
					unreached: !isExported,
					isCircular: false,
					lazy: isLazy,
					index: index++,
					inject: "constructor",
				},
			};

			this.addEdge(token, factoryDependency);
			this.recordCrossModuleReferrer(token, dependencyToken, isExported);
		}
	}
	// providers dependencies

	public async isProviderExported(
		moduleContainer: ModuleContainerInterface,
		dependencyToken: InjectionToken,
	): Promise<boolean> {
		// check globals
		for (const globalModule of this._globalModules.values()) {
			if (
				globalModule.exports.some((provider) => provider === dependencyToken)
			) {
				return true;
			}
		}
		// check globals

		// check internals
		if (
			moduleContainer.providers.some(
				(provider) => getProviderToken(provider) === dependencyToken,
			)
		) {
			return true;
		}

		// externals
		const containerImports = await moduleContainer.imports;
		const visitedModules = new Set<InjectionToken | Type>();
		const queue = containerImports.flatMap(
			(firstLevelContainer) => firstLevelContainer.exports,
		);

		while (queue.length) {
			const currentExportToken = queue.shift();

			if (!currentExportToken || visitedModules.has(currentExportToken)) {
				continue;
			}

			if (currentExportToken === dependencyToken) {
				return true;
			}

			if (
				isModule(currentExportToken) &&
				Reflect.hasMetadata(MODULE_WATERMARK, currentExportToken)
			) {
				const token = Reflect.getMetadata(
					MODULE_TOKEN_WATERMARK,
					currentExportToken,
				);
				if (typeof token === "string") {
					const moduleContainer = this.getNode(token);

					if (moduleContainer && moduleContainer.type === NodeTypeEnum.MODULE) {
						queue.push(...(moduleContainer as AnalyzeModule).exports);
					}
				}
			}

			visitedModules.add(currentExportToken);
		}

		return false;
	}

	private async detectCircularDependencies(
		startTokens: InjectionToken[],
	): Promise<void> {
		const visit = (
			nodeId: InjectionToken,
			path: InjectionToken[],
			visited: Set<InjectionToken>,
			stack: Set<InjectionToken>,
		): boolean => {
			if (stack.has(nodeId)) {
				const cyclePath: [InjectionToken, InjectionToken][] = path.map(
					(node, index) => [node, path[index + 1] || nodeId],
				);

				const from = cyclePath[0];
				const to = cyclePath[cyclePath.length - 1];

				if (from[0] === to[1]) {
					for (const [from, to] of cyclePath) {
						const edges = this._edges.get(from);
						if (edges) {
							const edge = edges.find((e) => e.target === to);
							if (edge) {
								edge.metadata.isCircular = true;
							}
						}
					}

					// Only push CD_PROVIDERS if NO edge in cycle has forwardRef (lazy)
					const hasForwardRef = cyclePath.some(([from, to]) => {
						const edges = this._edges.get(from);
						if (!edges) return false;
						const edge = edges.find(
							(e) => e.target === to && e.type === EdgeTypeEnum.DEPENDENCY,
						);
						return edge?.metadata.lazy === true;
					});

					if (!hasForwardRef) {
						this.pushError({
							type: "CD_PROVIDERS",
							path: cyclePath,
						});
					}
				}
				return true;
			}

			if (visited.has(nodeId)) {
				return false;
			}

			visited.add(nodeId);
			stack.add(nodeId);
			path.push(nodeId);

			const edges = this.getEdge(nodeId) || [];
			for (const edge of edges) {
				visit(edge.target, path, visited, stack);
			}

			stack.delete(nodeId);
			path.pop();
			return false;
		};

		for (const nodeId of new Set(startTokens)) {
			visit(nodeId, [], new Set<InjectionToken>(), new Set<InjectionToken>());
		}
	}

	private async detectCircularImports(startTokens: string[]): Promise<void> {
		const visit = (
			nodeId: InjectionToken,
			path: InjectionToken[],
			visited: Set<InjectionToken>,
			stack: Set<InjectionToken>,
		): void => {
			if (stack.has(nodeId)) {
				const cycleStartIndex = path.indexOf(nodeId);
				const cyclePath = path.slice(cycleStartIndex);

				for (let i = 0; i < cyclePath.length; i++) {
					const from = cyclePath[i];
					const to = cyclePath[cyclePath.length - 1];
					const edges = this._edges.get(from);
					if (edges) {
						const edge = edges.find((e) => e.source === to);

						if (edge && edge.type === EdgeTypeEnum.IMPORT) {
							this.pushError({
								type: "CD_IMPORTS",
								path: cyclePath
									.map((token) => this.getNode(token))
									.filter((node): node is Node => node !== undefined)
									.map((node) => node.label),
							});
							edge.metadata.isCircular = true;
						}
					}
				}
				return;
			}

			if (visited.has(nodeId)) {
				return;
			}

			visited.add(nodeId);
			stack.add(nodeId);
			path.push(nodeId);

			const edges = this.getEdge(nodeId) || [];
			for (const edge of edges) {
				if (edge.type === EdgeTypeEnum.IMPORT) {
					visit(edge.source, path, visited, stack);
				}
			}

			stack.delete(nodeId);
			path.pop();
		};

		for (const nodeId of new Set(startTokens)) {
			visit(nodeId, [], new Set<InjectionToken>(), new Set<InjectionToken>());
		}
	}

	private getConstructorDependencies(
		provider: Type,
	): { index: number; param: Type<unknown> }[] {
		return (
			Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, provider) || []
		).sort((a: { index: number }, b: { index: number }) => a.index - b.index);
	}

	private getOptionalConstructorDependencies(provider: Provider): number[] {
		return (
			Reflect.getMetadata(SELF_DECLARED_OPTIONAL_DEPS_METADATA, provider) || []
		).map(({ index }: { index: number }) => index);
	}

	private getOptionalPropertyDependencies(provider: Provider): string[] {
		return (
			Reflect.getMetadata(PROPERTY_OPTIONAL_DEPS_METADATA, provider) || []
		).map(({ key }: { key: string }) => key);
	}

	private getPropertiesDependencies(
		provider: Provider,
	): { key: string; type: Type<unknown> }[] {
		return Reflect.getMetadata(PROPERTY_DEPS_METADATA, provider) || [];
	}
}
