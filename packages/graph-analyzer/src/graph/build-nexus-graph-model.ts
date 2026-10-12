import type {
	NexusApplication,
	NexusClass,
	NexusProvider,
	NexusToken,
} from "@nexus-ioc/type-checker";
import type {
	GraphModuleNode,
	GraphModuleReference,
	GraphProviderDependency,
	GraphProviderNode,
	GraphScope,
	GraphUndeclaredDependency,
	NexusGraphModel,
} from "./nexus-graph-model";
import { GraphScopeIndex } from "./scope-resolution";

/**
 * Builds the `NexusGraphModel` the analyzers in this package operate on,
 * from `@nexus-ioc/type-checker`'s semantic `NexusApplication`. Every node
 * is keyed by `NexusClass.id`/`NexusToken.id` (a stable `file:line:col`),
 * not by rendered name — two classes named alike in different files never
 * collide here.
 *
 * `application.classes[0]` is always the entry point's own class (see
 * `NexusApplicationAnalyzer.analyze`, which seeds and processes it first).
 */
export function buildNexusGraphModel(
	application: NexusApplication,
): NexusGraphModel {
	const classesById = indexClassesById(application.classes);

	const modules = new Map<string, GraphModuleNode>();
	for (const nexusClass of application.classes) {
		if (!nexusClass.module) continue;

		modules.set(nexusClass.id, {
			name: moduleName(nexusClass),
			id: nexusClass.id,
			path: nexusClass.source.fileName,
			isGlobal: nexusClass.isGlobal,
			imports: nexusClass.module.imports.map((entry) =>
				buildModuleReference(entry.module, classesById),
			),
			exports: nexusClass.module.exports.map((entry) =>
				buildModuleReference(entry.token, classesById),
			),
			providers: nexusClass.module.providers.map((provider) =>
				buildProviderNode(provider, classesById),
			),
		});
	}

	const graphModel: NexusGraphModel = {
		entryModuleId: application.classes[0]?.id ?? "",
		modules,
	};

	const scopes = application.scopes ?? [];
	if (scopes.length > 1) {
		applyScopes(graphModel, application, classesById);
	}

	return graphModel;
}

/**
 * Adds child-scope information to a graph built from an application that
 * declares `children`: `scopes`, each module's `scope` and `children`, and
 * `crossScope` on dependencies a child-scope provider gets from an ancestor
 * scope. A module present in several scopes is tagged with the first one.
 */
function applyScopes(
	graphModel: NexusGraphModel,
	application: NexusApplication,
	classesById: Map<string, NexusClass>,
): void {
	const { modules } = graphModel;
	graphModel.scopes = application.scopes.map((scope): GraphScope => {
		const graphScope: GraphScope = {
			rootId: scope.rootId,
			moduleIds: scope.classIds.filter((id) => modules.has(id)),
		};
		if (scope.declaredInId !== undefined) {
			graphScope.declaredInId = scope.declaredInId;
		}
		if (scope.parentRootId !== undefined) {
			graphScope.parentRootId = scope.parentRootId;
		}
		return graphScope;
	});

	for (const scope of graphModel.scopes) {
		for (const moduleId of scope.moduleIds) {
			const module = modules.get(moduleId);
			if (module && module.scope === undefined) module.scope = scope.rootId;
		}
	}

	for (const nexusClass of application.classes) {
		const module = modules.get(nexusClass.id);
		const children = (nexusClass.module?.children ?? []).filter(
			(child) => child.module !== undefined,
		);
		if (module && children.length > 0) {
			module.children = children.map((child) =>
				buildModuleReference(child.module, classesById),
			);
		}
	}

	const scopeIndex = new GraphScopeIndex(graphModel);
	for (const module of modules.values()) {
		const scope = module.scope;
		if (scope === undefined) continue;
		for (const provider of module.providers) {
			for (const dependency of provider.dependencies) {
				if (!dependency.tokenId) continue;
				const providingScope = scopeIndex.providingScope(
					scope,
					dependency.tokenId,
				);
				if (providingScope !== undefined && providingScope !== scope) {
					dependency.crossScope = true;
				}
			}
		}
	}
}

function moduleName(nexusClass: NexusClass | undefined): string {
	if (!nexusClass) return "";
	return (
		nexusClass.name ??
		`<anonymous:${nexusClass.source.fileName}:${nexusClass.source.start}>`
	);
}

function buildModuleReference(
	token: NexusToken | undefined,
	classesById: Map<string, NexusClass>,
): GraphModuleReference {
	const id = tokenIdentity(token) ?? "";
	return {
		id,
		name: renderToken(token),
		path: classesById.get(id)?.source.fileName,
	};
}

function buildProviderNode(
	provider: NexusProvider,
	classesById: Map<string, NexusClass>,
): GraphProviderNode {
	const implementationToken =
		provider.kind === "useClass" ? provider.useClass : provider.provide;
	const implementationClass = resolveImplementationClass(
		implementationToken,
		classesById,
	);

	return {
		token: renderToken(provider.provide),
		id: tokenIdentity(provider.provide) ?? "",
		type: renderProviderType(provider.kind),
		scope: provider.scope ? renderToken(provider.scope) : undefined,
		useClass:
			provider.kind === "useClass" ? renderToken(provider.useClass) : undefined,
		dependencies:
			provider.kind === "useFactory"
				? provider.factoryInject.map(
						(token): GraphProviderDependency => ({
							token: renderToken(token),
							tokenId: tokenIdentity(token),
							optional: false,
						}),
					)
				: resolveClassDependencies(implementationClass),
		undeclaredDependencies: buildUndeclaredDependencies(implementationClass),
	};
}

function resolveImplementationClass(
	token: NexusToken | undefined,
	classesById: Map<string, NexusClass>,
): NexusClass | undefined {
	if (token?.kind !== "reference") return undefined;
	return classesById.get(token.id);
}

function resolveClassDependencies(
	nexusClass: NexusClass | undefined,
): GraphProviderDependency[] {
	if (!nexusClass) return [];

	return nexusClass.dependencies.map((dependency) => ({
		token: renderToken(dependency.token),
		tokenId: tokenIdentity(dependency.token),
		optional: dependency.optional,
	}));
}

function buildUndeclaredDependencies(
	nexusClass: NexusClass | undefined,
): GraphUndeclaredDependency[] {
	if (!nexusClass) return [];

	return nexusClass.undeclaredDependencies.map((dependency) => ({
		location: dependency.location,
		name: dependency.name,
		token: renderToken(dependency.inferredType),
		isInferredTypeInjectable: dependency.isInferredTypeInjectable,
	}));
}

function renderProviderType(
	kind: NexusProvider["kind"],
): GraphProviderNode["type"] {
	switch (kind) {
		case "class":
			return "Class";
		case "useClass":
			return "UseClass";
		case "useValue":
			return "UseValue";
		case "useFactory":
			return "UseFactory";
	}
}

function renderToken(token: NexusToken | undefined): string {
	if (!token) return "<unknown>";
	switch (token.kind) {
		case "string":
			return token.value;
		case "reference":
			return token.symbol.getName();
		case "symbol":
			return token.declaration ? token.declaration.getName() : "<symbol>";
		case "expression":
			return "<expression>";
	}
}

/**
 * Collision-free identity for a token, as opposed to `renderToken()`'s
 * human-readable label. Analyzers must match/key by this, never by the
 * rendered name — see `NexusGraphModel`'s doc comment.
 */
function tokenIdentity(token: NexusToken | undefined): string | undefined {
	if (!token) return undefined;
	switch (token.kind) {
		case "string":
			return `string:${token.value}`;
		case "reference":
			return token.id;
		case "symbol":
			return token.id ? `symbol:${token.id}` : undefined;
		case "expression":
			return undefined;
	}
}

function indexClassesById(
	classes: readonly NexusClass[],
): Map<string, NexusClass> {
	const map = new Map<string, NexusClass>();
	for (const nexusClass of classes) {
		map.set(nexusClass.id, nexusClass);
	}
	return map;
}
