import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
	InjectionToken,
	Edge as NexusEdge,
	Node as NexusNode,
	ScannerGraphInterface,
	ScannerPluginInterface,
} from "nexus-ioc";

export interface Node {
	id: string;
	type: "module" | "provider";
	color?: string;
	shape?: string;
}

export interface Edge {
	from: string;
	to: string;
	color?: string;
	label?: string;
}

interface GraphConfig {
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

export class GraphScannerVisualizer implements ScannerPluginInterface {
	protected readonly nodeGroups = new Map<InjectionToken, NexusEdge[]>();
	private readonly config: GraphConfig;

	constructor(
		protected readonly outputPath: string,
		config?: Partial<GraphConfig>,
	) {
		this.config = {
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
			showLegend: true, // Show legend
			...config,
		};
	}

	protected parseGraph(graph: ScannerGraphInterface): string {
		this.initializeNodeGroups(graph);

		const edges: Edge[] = this.createEdges(graph);

		let dot = "digraph G {\n";
		dot += `  graph [ranksep=${this.config.ranksep}, nodesep=${this.config.nodesep}];\n`;

		if (this.config.showLegend) {
			dot += this.createLegend();
		}

		this.nodeGroups.forEach((edges, token) => {
			const moduleNode = graph.getNode(token);
			dot += this.createModuleSubgraph(moduleNode, edges);
		});

		for (const edge of edges) {
			dot += this.createEdge(edge);
		}
		dot += "}";
		return dot;
	}

	async scan(graph: ScannerGraphInterface): Promise<void> {
		const dotGraph = this.parseGraph(graph);

		this.ensureDirectoryExists(this.outputPath);

		const dotProcess = spawnSync("dot", ["-Tpng", "-o", this.outputPath], {
			input: dotGraph,
			encoding: "utf-8",
		});

		if (dotProcess.error) {
			console.error("Error running dot command:", dotProcess.error);
		} else {
			console.log(`Graph visualized as ${this.outputPath}`);
		}
	}

	protected initializeNodeGroups(graph: ScannerGraphInterface): void {
		for (const node of graph.getAllNodes()) {
			if (node.type === "module") {
				this.nodeGroups.set(node.id, []);
			}
		}

		for (const edges of graph.getAllEdges()) {
			for (const edge of edges) {
				if (edge.type === "provider") {
					const moduleEdges = this.nodeGroups.get(edge.target) || [];
					moduleEdges.push(edge);
				}
			}
		}
	}

	protected createEdges(graph: ScannerGraphInterface): Edge[] {
		return graph.getAllEdges().reduce<Edge[]>((acum, subEdges) => {
			const edgesFromTo = subEdges
				.filter((edge) => this.config.showProviders || edge.type !== "provider")
				.map((edge) => {
					const targetNode = graph.getNode(edge.target);
					const sourceNode = graph.getNode(edge.source);
					const color = this.getEdgeColor(edge);

					return {
						from: sourceNode.label,
						to: targetNode.label,
						label: this.config.showLabel ? edge.type : "",
						color,
					};
				});

			acum.push(...edgesFromTo);

			return acum;
		}, []);
	}

	protected getEdgeColor(edge: NexusEdge): string {
		if (edge.type === "import") {
			return edge.metadata.isCircular
				? this.config.circularColor
				: this.config.importColor;
		}

		if (edge.type === "dependency") {
			return edge.metadata.isCircular
				? this.config.circularColor
				: this.config.dependencyColor;
		}

		if (edge.type === "provider") {
			return this.config.providerEdgeColor;
		}

		return "#000000"; // Default color (black)
	}

	protected createModuleSubgraph(
		moduleNode: NexusNode,
		edges: NexusEdge[],
	): string {
		let dot = `  subgraph cluster_${moduleNode.label} {\n`;
		dot += `    label = "${moduleNode.label}";\n`;
		dot += `    "${moduleNode.label}" [label="${moduleNode.label}" style=filled fillcolor="${this.config.moduleColor}" fontcolor="${this.config.moduleFontColor}" shape=box];\n`; // Configurable color and shape for modules, configurable font color
		if (this.config.showProviders) {
			for (const edge of edges) {
				const edgeName =
					typeof edge.source === "function"
						? edge.source.name
						: edge.source.toString();
				dot += `    "${edgeName}" [label="${edgeName}" style=filled fillcolor="${this.config.providerColor}" fontcolor="${this.config.providerFontColor}" shape=ellipse];\n`; // Configurable color and shape for providers, configurable font color
			}
		}
		dot += "  }\n";
		return dot;
	}

	protected createEdge(edge: Edge): string {
		return `  "${edge.to}" -> "${edge.from}" [color="${edge.color}" label="${edge.label}" arrowhead=normal];\n`;
	}

	protected createLegend(): string {
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

	protected ensureDirectoryExists(filePath: string): void {
		const dir = dirname(filePath);
		mkdirSync(dir, { recursive: true });
	}
}
