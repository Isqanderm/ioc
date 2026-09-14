import type {
	GraphModuleNode,
	GraphProviderNode,
	NexusGraphModel,
} from "../nexus-graph-model";

/**
 * Convenience input shape for a fixture module: plain name strings for
 * `imports`/`exports` (like the pre-`id` `GraphModuleNode` shape), instead
 * of the real `GraphModuleReference[]`. `buildGraphModel()` derives each
 * reference's `id` from its name — safe here because fixture module names
 * are the `modules` record's own keys, already unique within one fixture.
 * Tests that specifically exercise name-collision handling should build a
 * `NexusGraphModel` by hand instead of via this helper.
 */
export interface GraphModuleFixtureInput {
	path?: string;
	isGlobal?: boolean;
	imports?: string[];
	exports?: string[];
	providers?: GraphProviderNode[];
}

/**
 * Convenience builder for hand-written `NexusGraphModel` fixtures in unit
 * tests, so each analyzer's tests stay independent of `ts.Program` and
 * `@nexus-ioc/type-checker` — only `buildNexusGraphModel`'s own tests need
 * a real program.
 */
export function buildGraphModel(
	entryModuleName: string,
	modules: Record<string, GraphModuleFixtureInput>,
): NexusGraphModel {
	const map = new Map<string, GraphModuleNode>();

	for (const [name, module] of Object.entries(modules)) {
		map.set(name, {
			name,
			id: name,
			path: module.path ?? `/app/${name}.ts`,
			isGlobal: module.isGlobal ?? false,
			imports: (module.imports ?? []).map((importedName) => ({
				id: importedName,
				name: importedName,
				path: modules[importedName]?.path ?? `/app/${importedName}.ts`,
			})),
			exports: (module.exports ?? []).map((exportedName) => ({
				id: exportedName,
				name: exportedName,
				path: modules[exportedName]?.path,
			})),
			providers: module.providers ?? [],
		});
	}

	return { entryModuleId: entryModuleName, modules: map };
}

export function provider(
	token: string,
	overrides: Partial<GraphProviderNode> = {},
): GraphProviderNode {
	const { dependencies, ...rest } = overrides;
	return {
		token,
		id: token,
		type: "Class",
		// Defaults `tokenId` to `token` — safe here because fixture tokens are
		// unique strings within one test's fixture, same convention as `id: token`
		// above. Tests exercising real collision handling build fixtures by hand.
		dependencies: (dependencies ?? []).map((dep) => ({
			tokenId: dep.token,
			...dep,
		})),
		undeclaredDependencies: [],
		...rest,
	};
}
