import type {
	CircularDependency,
	GraphOutput,
	ModuleReferenceInfo,
} from "@nexus-ioc/graph-analyzer";

interface DotEdge {
	from: string;
	to: string;
	color?: string;
	label?: string;
}

export interface GraphConfig {
	ranksep: number;
	nodesep: number;
	moduleColor: string;
	moduleFontColor: string;
	providerColor: string;
	providerFontColor: string;
	importColor: string;
	dependencyColor: string;
	circularColor: string;
	providerEdgeColor: string;
	showLabel: boolean;
	showProviders: boolean;
	showLegend: boolean;
}

const DEFAULT_CONFIG: GraphConfig = {
	ranksep: 1,
	nodesep: 1,
	moduleColor: "#ff7f0e", // Bright orange for modules
	moduleFontColor: "#ffffff", // White for module text
	providerColor: "#1f77b4", // Bright blue for providers
	providerFontColor: "#ffffff", // White for provider text
	importColor: "#000", // Black for imports
	dependencyColor: "#2ca02c", // Bright green for dependencies
	circularColor: "#ff0000", // Bright red for circular dependencies
	providerEdgeColor: "#9467bd", // Bright purple for provider edges
	showLabel: false,
	showProviders: true,
	showLegend: true,
};

/**
 * Renders a `GraphOutput` (from `@nexus-ioc/graph-analyzer`) as a Graphviz
 * DOT string — module subgraphs with their providers nested inside, import
 * and dependency edges, and cycle highlighting driven by an optional
 * `CircularDependency[]` (from `CircularDependencyDetector`).
 */
export class DotGraphRenderer {
	private readonly config: GraphConfig;
	private readonly circularModuleEdges = new Set<string>();
	private readonly circularProviderEdges = new Set<string>();

	constructor(
		private readonly graphOutput: GraphOutput,
		config: Partial<GraphConfig> = {},
		circularDependencies: readonly CircularDependency[] = [],
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.indexCircularEdges(circularDependencies);
	}

	private indexCircularEdges(
		circularDependencies: readonly CircularDependency[],
	): void {
		for (const circular of circularDependencies) {
			const set =
				circular.type === "module"
					? this.circularModuleEdges
					: this.circularProviderEdges;

			for (let i = 0; i < circular.cycle.length - 1; i++) {
				set.add(`${circular.cycle[i]}->${circular.cycle[i + 1]}`);
			}
		}
	}

	render(): string {
		let dot = "digraph G {\n";
		dot += `  graph [ranksep=${this.config.ranksep}, nodesep=${this.config.nodesep}];\n`;

		if (this.config.showLegend) {
			dot += this.createLegend();
		}

		for (const module of this.graphOutput.modules) {
			dot += this.createModuleSubgraph(module);
		}

		for (const edge of this.createEdges()) {
			dot += this.createEdge(edge);
		}

		dot += "}";
		return dot;
	}

	private createModuleSubgraph(module: GraphOutput["modules"][number]): string {
		const moduleId = moduleNodeId({ name: module.name, path: module.path });

		let dot = `  subgraph cluster_${sanitizeId(moduleId)} {\n`;
		dot += `    label = "${module.name}";\n`;
		dot += `    "${moduleId}" [label="${module.name}" style=filled fillcolor="${this.config.moduleColor}" fontcolor="${this.config.moduleFontColor}" shape=box];\n`;

		if (this.config.showProviders) {
			for (const providerToken of module.providers) {
				const nodeId = providerNodeId(moduleId, providerToken);
				dot += `    "${nodeId}" [label="${providerToken}" style=filled fillcolor="${this.config.providerColor}" fontcolor="${this.config.providerFontColor}" shape=ellipse];\n`;
			}
		}

		dot += "  }\n";
		return dot;
	}

	/**
	 * Maps a bare provider token to its (module-qualified) node id, so
	 * dependency edges — which only carry a bare `token`, not the owning
	 * module — can still resolve to the right node. On a genuine token
	 * collision (two different provider classes named alike within the
	 * same module) the later provider wins; that residual ambiguity is a
	 * known, accepted limitation — see `ProviderInfo.token`'s doc comment.
	 */
	private buildProviderNodeIdByToken(): Map<string, string> {
		const map = new Map<string, string>();
		for (const provider of this.graphOutput.providers) {
			const moduleId = moduleNodeId(provider.module);
			map.set(provider.token, providerNodeId(moduleId, provider.token));
		}
		return map;
	}

	private createEdges(): DotEdge[] {
		const edges: DotEdge[] = [];

		for (const module of this.graphOutput.modules) {
			const fromId = moduleNodeId({ name: module.name, path: module.path });

			for (const importedModule of module.imports) {
				edges.push({
					from: fromId,
					to: moduleNodeId(importedModule),
					label: this.config.showLabel ? "import" : "",
					// Circular-edge lookup stays label-based (not module-qualified):
					// `CircularDependency.cycle` only ever carries display names.
					color: this.circularModuleEdges.has(
						`${module.name}->${importedModule.name}`,
					)
						? this.config.circularColor
						: this.config.importColor,
				});
			}
		}

		if (this.config.showProviders) {
			const providerNodeIdByToken = this.buildProviderNodeIdByToken();

			for (const provider of this.graphOutput.providers) {
				const moduleId = moduleNodeId(provider.module);
				const fromId = providerNodeId(moduleId, provider.token);

				edges.push({
					from: moduleId,
					to: fromId,
					label: this.config.showLabel ? "provider" : "",
					color: this.config.providerEdgeColor,
				});

				for (const dependency of provider.dependencies) {
					edges.push({
						from: fromId,
						to: providerNodeIdByToken.get(dependency.token) ?? dependency.token,
						label: this.config.showLabel ? "dependency" : "",
						// Circular-edge lookup stays label-based, same reasoning as above.
						color: this.circularProviderEdges.has(
							`${provider.token}->${dependency.token}`,
						)
							? this.config.circularColor
							: this.config.dependencyColor,
					});
				}
			}
		}

		return edges;
	}

	private createEdge(edge: DotEdge): string {
		return `  "${edge.to}" -> "${edge.from}" [color="${edge.color}" label="${edge.label}" arrowhead=normal];\n`;
	}

	private createLegend(): string {
		return `
			Legend [shape=none, margin=0, label=<
				<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
					<TR><TD COLSPAN="2"><B>Legend</B></TD></TR>
					<TR><TD>Module</TD><TD BGCOLOR="${this.config.moduleColor}" FONT="white"></TD></TR>
					<TR><TD>Provider</TD><TD BGCOLOR="${this.config.providerColor}" FONT="white"></TD></TR>
					<TR><TD>Import Edge</TD><TD BGCOLOR="${this.config.importColor}"></TD></TR>
					<TR><TD>Dependency Edge</TD><TD BGCOLOR="${this.config.dependencyColor}"></TD></TR>
					<TR><TD>Circular Edge</TD><TD BGCOLOR="${this.config.circularColor}"></TD></TR>
					<TR><TD>Provider Edge</TD><TD BGCOLOR="${this.config.providerEdgeColor}"></TD></TR>
				</TABLE>
			> pos="1,1"];
		`;
	}
}

/**
 * Collision-free DOT node id for a module reference — `path` (present on
 * every `ModuleInfo.imports`/`exports` entry) disambiguates two modules
 * that share a display `name` but live in different files.
 */
function moduleNodeId(ref: ModuleReferenceInfo): string {
	return `${ref.name}@${ref.path ?? ""}`;
}

/** DOT node id for a provider, scoped under its owning module's node id. */
function providerNodeId(moduleId: string, providerToken: string): string {
	return `${moduleId}::${providerToken}`;
}

/** Strips characters DOT doesn't allow in a bare (unquoted) identifier,
 * for use in `subgraph cluster_<id>` names — the surrounding node ids stay
 * quoted DOT strings and don't need this. */
function sanitizeId(id: string): string {
	return id.replace(/[^A-Za-z0-9_]/g, "_");
}

export type { DotEdge };
