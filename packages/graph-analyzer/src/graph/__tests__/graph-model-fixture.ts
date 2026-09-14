import type {
	GraphModuleNode,
	GraphProviderNode,
	NexusGraphModel,
} from "../nexus-graph-model";

/**
 * Convenience builder for hand-written `NexusGraphModel` fixtures in unit
 * tests, so each analyzer's tests stay independent of `ts.Program` and
 * `@nexus-ioc/type-checker` — only `buildNexusGraphModel`'s own tests need
 * a real program.
 */
export function buildGraphModel(
	entryModuleName: string,
	modules: Record<string, Partial<GraphModuleNode>>,
): NexusGraphModel {
	const map = new Map<string, GraphModuleNode>();

	for (const [name, module] of Object.entries(modules)) {
		map.set(name, {
			name,
			path: module.path ?? `/app/${name}.ts`,
			isGlobal: module.isGlobal ?? false,
			imports: module.imports ?? [],
			exports: module.exports ?? [],
			providers: module.providers ?? [],
		});
	}

	return { entryModuleName, modules: map };
}

export function provider(
	token: string,
	overrides: Partial<GraphProviderNode> = {},
): GraphProviderNode {
	return {
		token,
		type: "Class",
		dependencies: [],
		...overrides,
	};
}
