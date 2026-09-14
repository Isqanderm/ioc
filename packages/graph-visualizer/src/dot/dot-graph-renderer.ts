import type {
	CircularDependency,
	GraphOutput,
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
		let dot = `  subgraph cluster_${module.name} {\n`;
		dot += `    label = "${module.name}";\n`;
		dot += `    "${module.name}" [label="${module.name}" style=filled fillcolor="${this.config.moduleColor}" fontcolor="${this.config.moduleFontColor}" shape=box];\n`;

		if (this.config.showProviders) {
			for (const providerToken of module.providers) {
				dot += `    "${providerToken}" [label="${providerToken}" style=filled fillcolor="${this.config.providerColor}" fontcolor="${this.config.providerFontColor}" shape=ellipse];\n`;
			}
		}

		dot += "  }\n";
		return dot;
	}

	private createEdges(): DotEdge[] {
		const edges: DotEdge[] = [];

		for (const module of this.graphOutput.modules) {
			for (const importedModule of module.imports) {
				edges.push({
					from: module.name,
					to: importedModule,
					label: this.config.showLabel ? "import" : "",
					color: this.circularModuleEdges.has(
						`${module.name}->${importedModule}`,
					)
						? this.config.circularColor
						: this.config.importColor,
				});
			}
		}

		if (this.config.showProviders) {
			for (const provider of this.graphOutput.providers) {
				edges.push({
					from: provider.module,
					to: provider.token,
					label: this.config.showLabel ? "provider" : "",
					color: this.config.providerEdgeColor,
				});

				for (const dependency of provider.dependencies) {
					edges.push({
						from: provider.token,
						to: dependency.token,
						label: this.config.showLabel ? "dependency" : "",
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

export type { DotEdge };
