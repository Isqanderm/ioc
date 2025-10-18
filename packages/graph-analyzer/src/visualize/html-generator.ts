import type { GraphOutput } from "../interfaces/graph-output.interface";
import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";
import { JsonFormatter } from "./json-formatter";

/**
 * Options for HTML generation
 */
export interface HtmlGeneratorOptions {
	/** IDE protocol for clickable file links (default: 'vscode') */
	ideProtocol?: "vscode" | "webstorm" | "idea" | "custom";
	/** Custom IDE URL template (e.g., 'vscode://file/{path}:{line}:{column}') */
	customIdeUrl?: string;
	/** Title for the HTML page (default: 'Dependency Graph') */
	title?: string;
	/** Whether to use dark theme (default: false) */
	darkTheme?: boolean;
}

/**
 * Generates interactive HTML visualizations of dependency graphs
 *
 * Creates a self-contained HTML file with an interactive graph using Cytoscape.js.
 * The graph includes modules and providers with clickable nodes, zoom/pan capabilities,
 * and detailed information panels.
 *
 * @example
 * ```typescript
 * const generator = new HtmlGenerator(modulesGraph, 'src/main.ts', {
 *   ideProtocol: 'vscode',
 *   title: 'My App Dependencies',
 *   darkTheme: true
 * });
 *
 * const html = generator.generate();
 * fs.writeFileSync('graph.html', html);
 * ```
 */
export class HtmlGenerator {
	private readonly formatter: JsonFormatter;

	constructor(
		readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
		private readonly entryPoint: string,
		private readonly options: HtmlGeneratorOptions = {},
	) {
		this.formatter = new JsonFormatter(graph, entryPoint);
	}

	/**
	 * Generate the complete HTML document
	 *
	 * @returns Complete HTML string ready to be written to a file
	 */
	generate(): string {
		const graphData = this.formatter.format();
		const cytoscapeData = this.convertToCytoscapeFormat(graphData);

		return this.generateHtmlTemplate(graphData, cytoscapeData);
	}

	/**
	 * Convert GraphOutput to Cytoscape.js format with compound nodes
	 */
	private convertToCytoscapeFormat(graphData: GraphOutput): {
		nodes: unknown[];
		edges: unknown[];
		providerMap: Record<string, string>;
		moduleMap: Record<string, string>;
	} {
		const nodes: unknown[] = [];
		const edges: unknown[] = [];

		// Create a set of existing module names for validation
		const existingModules = new Set(
			graphData.modules.map((module) => module.name),
		);

		// Add module nodes (these will be parent/compound nodes)
		for (const module of graphData.modules) {
			nodes.push({
				data: {
					id: `module-${module.name}`,
					label: module.name,
					type: "module",
					path: module.path,
					isGlobal: module.isGlobal,
					imports: module.imports,
					exports: module.exports,
					providers: module.providers,
				},
				classes: ["module", module.isGlobal ? "global" : ""],
			});

			// Add edges for module imports (only for modules that exist in the graph)
			for (const importedModule of module.imports) {
				// Only create edge if the target module exists in the graph
				if (existingModules.has(importedModule)) {
					edges.push({
						data: {
							id: `edge-${module.name}-${importedModule}`,
							source: `module-${module.name}`,
							target: `module-${importedModule}`,
							type: "import",
						},
						classes: ["import"],
					});
				}
			}
		}

		// Create a map of provider tokens to their full node IDs for dependency resolution
		const providerMap = new Map<string, string>();
		for (const provider of graphData.providers) {
			const nodeId = `provider-${provider.module}-${provider.token}`;
			providerMap.set(provider.token, nodeId);
		}

		// Create a map of module names to their node IDs for export resolution
		const moduleMap = new Map<string, string>();
		for (const module of graphData.modules) {
			const nodeId = `module-${module.name}`;
			moduleMap.set(module.name, nodeId);
		}

		// Add provider nodes as children of their parent modules
		for (const provider of graphData.providers) {
			const nodeId = `provider-${provider.module}-${provider.token}`;

			// Check if provider has dependencies without explicit @Inject decorators
			const hasMissingDecorators =
				provider.dependencies?.some(
					(dep) => dep.hasExplicitDecorator === false,
				) ?? false;

			const classes = ["provider", provider.type.toLowerCase()];
			if (hasMissingDecorators) {
				classes.push("missing-decorator");
			}

			nodes.push({
				data: {
					id: nodeId,
					label: provider.token,
					type: "provider",
					providerType: provider.type,
					module: provider.module,
					scope: provider.scope,
					dependencies: provider.dependencies,
					value: provider.value,
					factory: provider.factory,
					useClass: provider.useClass,
					hasMissingDecorators,
					// Set parent to create compound node structure
					parent: `module-${provider.module}`,
				},
				classes,
			});

			// Note: We no longer need "provides" edges since providers are children of modules

			// Add edges for provider dependencies (only for providers that exist in the graph)
			if (provider.dependencies && provider.dependencies.length > 0) {
				for (const dep of provider.dependencies) {
					if (dep.token) {
						// Find the provider node for this dependency
						const depNodeId = providerMap.get(dep.token);
						// Only create edge if the target provider exists in the graph
						if (depNodeId) {
							edges.push({
								data: {
									id: `edge-${nodeId}-${depNodeId}`,
									source: nodeId,
									target: depNodeId,
									type: "dependency",
									optional: dep.optional,
								},
								classes: ["dependency", dep.optional ? "optional" : ""],
							});
						}
					}
				}
			}
		}

		// Convert Maps to plain objects for JSON serialization
		const providerMapObject: Record<string, string> = {};
		providerMap.forEach((nodeId, token) => {
			providerMapObject[token] = nodeId;
		});

		const moduleMapObject: Record<string, string> = {};
		moduleMap.forEach((nodeId, name) => {
			moduleMapObject[name] = nodeId;
		});

		return {
			nodes,
			edges,
			providerMap: providerMapObject,
			moduleMap: moduleMapObject,
		};
	}

	/**
	 * Get IDE URL for a file path
	 */
	private getIdeUrl(filePath: string, line = 1, column = 1): string {
		const protocol = this.options.ideProtocol || "vscode";

		if (this.options.customIdeUrl) {
			return this.options.customIdeUrl
				.replace("{path}", filePath)
				.replace("{line}", String(line))
				.replace("{column}", String(column));
		}

		switch (protocol) {
			case "vscode":
				return `vscode://file/${filePath}:${line}:${column}`;
			case "webstorm":
			case "idea":
				return `idea://open?file=${filePath}&line=${line}&column=${column}`;
			default:
				return `vscode://file/${filePath}:${line}:${column}`;
		}
	}

	/**
	 * Generate warning section for providers with missing @Inject decorators
	 */
	private generateMissingDecoratorsWarning(graphData: GraphOutput): string {
		const providersWithMissingDecorators = graphData.providers.filter(
			(provider) =>
				provider.dependencies?.some(
					(dep) => dep.hasExplicitDecorator === false,
				),
		);

		if (providersWithMissingDecorators.length === 0) {
			return "";
		}

		const providersList = providersWithMissingDecorators
			.map((provider) => {
				const missingDeps =
					provider.dependencies?.filter(
						(dep) => dep.hasExplicitDecorator === false,
					) || [];
				return `<li><strong>${provider.token}</strong> (${provider.module}): ${missingDeps.map((d) => d.token).join(", ")}</li>`;
			})
			.join("");

		return `
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 1.25rem 1.5rem; margin-top: 1.25rem; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.15);">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                    <span style="font-size: 1.75rem;">⚠️</span>
                    <strong style="color: #dc2626; font-size: 1.15rem; font-weight: 700;">Missing @Inject Decorators Detected</strong>
                </div>
                <p style="color: #991b1b; margin-bottom: 1rem; font-size: 0.95rem; line-height: 1.6;">
                    <strong>${providersWithMissingDecorators.length}</strong> provider(s) have dependencies without explicit @Inject decorators.
                    This may cause runtime errors in production. Affected providers:
                </p>
                <ul style="color: #991b1b; font-size: 0.9rem; margin-left: 1.5rem; line-height: 1.8;">
                    ${providersList}
                </ul>
            </div>
        `;
	}

	/**
	 * Generate the complete HTML template
	 */
	private generateHtmlTemplate(
		graphData: GraphOutput,
		cytoscapeData: {
			nodes: unknown[];
			edges: unknown[];
			providerMap: Record<string, string>;
			moduleMap: Record<string, string>;
		},
	): string {
		const title = this.options.title || "Dependency Graph";
		const isDark = this.options.darkTheme || false;

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
    <style>
        ${this.generateStyles(isDark)}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${title}</h1>
            <div class="metadata">
                <span>Entry Point: <code>${graphData.metadata.entryPoint}</code></span>
                <span>Modules: <strong>${graphData.metadata.totalModules}</strong></span>
                <span>Providers: <strong>${graphData.metadata.totalProviders}</strong></span>
                <span>Analyzed: ${new Date(graphData.metadata.analyzedAt).toLocaleString()}</span>
            </div>
            ${this.generateMissingDecoratorsWarning(graphData)}
        </header>
        
        <div class="controls">
            <div class="control-group">
                <label>View Mode:</label>
                <button id="view-all" class="active">All</button>
                <button id="view-modules">Modules Only</button>
                <button id="view-providers">Providers Only</button>
            </div>
            <div class="control-group">
                <label>Search:</label>
                <input type="text" id="search" placeholder="Search modules or providers..." />
            </div>
            <div class="control-group">
                <button id="reset-zoom">Reset View</button>
                <button id="fit-graph">Fit to Screen</button>
            </div>
        </div>

        <div class="main-content">
            <div id="cy"></div>
            <div id="info-panel" class="info-panel">
                <h3>Node Information</h3>
                <p class="placeholder">Click on a node to see details</p>
                <div id="node-details" style="display: none;"></div>
            </div>
        </div>
    </div>

    <script>
        ${this.generateScript(graphData, cytoscapeData)}
    </script>
</body>
</html>`;
	}

	/**
	 * Generate CSS styles
	 */
	private generateStyles(isDark: boolean): string {
		// Enhanced color palette for better accessibility and visual appeal
		const bgColor = isDark ? "#1a1a1a" : "#f8f9fa";
		const textColor = isDark ? "#e0e0e0" : "#2c3e50";
		const borderColor = isDark ? "#404040" : "#dee2e6";
		const panelBg = isDark ? "#242424" : "#ffffff";
		const accentColor = isDark ? "#3b82f6" : "#2563eb";
		const accentHover = isDark ? "#60a5fa" : "#1d4ed8";
		const mutedText = isDark ? "#9ca3af" : "#6b7280";
		const cardBg = isDark ? "#2d2d2d" : "#ffffff";
		const shadowColor = isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.1)";

		return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            background: ${bgColor};
            color: ${textColor};
            overflow: hidden;
            line-height: 1.6;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        header {
            padding: 1.5rem 2rem;
            border-bottom: 2px solid ${borderColor};
            background: ${panelBg};
            box-shadow: 0 2px 8px ${shadowColor};
        }

        header h1 {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
            color: ${textColor};
            letter-spacing: -0.025em;
        }

        .metadata {
            display: flex;
            gap: 2rem;
            font-size: 0.9rem;
            color: ${mutedText};
            flex-wrap: wrap;
        }

        .metadata span {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .metadata strong {
            color: ${accentColor};
            font-weight: 600;
        }

        .metadata code {
            background: ${isDark ? "#1a1a1a" : "#f1f3f5"};
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Courier New', monospace;
            font-size: 0.85rem;
            border: 1px solid ${borderColor};
        }

        .controls {
            padding: 1.25rem 2rem;
            border-bottom: 1px solid ${borderColor};
            display: flex;
            gap: 2.5rem;
            align-items: center;
            background: ${panelBg};
            flex-wrap: wrap;
        }

        .control-group {
            display: flex;
            gap: 0.75rem;
            align-items: center;
        }

        .control-group label {
            font-weight: 600;
            font-size: 0.9rem;
            color: ${mutedText};
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-size: 0.75rem;
        }

        button {
            padding: 0.625rem 1.25rem;
            border: 1px solid ${borderColor};
            background: ${cardBg};
            color: ${textColor};
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px ${shadowColor};
        }

        button:hover {
            background: ${isDark ? "#3a3a3a" : "#f1f3f5"};
            transform: translateY(-1px);
            box-shadow: 0 2px 6px ${shadowColor};
        }

        button:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px ${shadowColor};
        }

        button.active {
            background: ${accentColor};
            color: white;
            border-color: ${accentColor};
            box-shadow: 0 2px 6px ${isDark ? "rgba(59, 130, 246, 0.4)" : "rgba(37, 99, 235, 0.3)"};
        }

        button.active:hover {
            background: ${accentHover};
            border-color: ${accentHover};
        }

        input[type="text"] {
            padding: 0.625rem 1rem;
            border: 1px solid ${borderColor};
            background: ${cardBg};
            color: ${textColor};
            border-radius: 6px;
            font-size: 0.9rem;
            min-width: 300px;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px ${shadowColor};
        }

        input[type="text"]:focus {
            outline: none;
            border-color: ${accentColor};
            box-shadow: 0 0 0 3px ${isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(37, 99, 235, 0.1)"};
        }

        input[type="text"]::placeholder {
            color: ${mutedText};
        }

        .main-content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        #cy {
            flex: 1;
            background: ${bgColor};
        }

        .info-panel {
            width: 380px;
            border-left: 2px solid ${borderColor};
            background: ${panelBg};
            padding: 2rem;
            overflow-y: auto;
            box-shadow: -2px 0 8px ${shadowColor};
        }

        .info-panel h3 {
            margin-bottom: 1.5rem;
            font-size: 1.25rem;
            font-weight: 700;
            color: ${textColor};
            letter-spacing: -0.025em;
        }

        .info-panel .placeholder {
            color: ${mutedText};
            font-style: italic;
            text-align: center;
            padding: 2rem 0;
        }

        .info-item {
            margin-bottom: 1.5rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid ${borderColor};
        }

        .info-item:last-child {
            border-bottom: none;
        }

        .info-item label {
            display: block;
            font-weight: 700;
            margin-bottom: 0.5rem;
            font-size: 0.85rem;
            color: ${mutedText};
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .info-item .value {
            font-size: 1rem;
            line-height: 1.6;
        }

        .info-item code {
            background: ${isDark ? "#1a1a1a" : "#f1f3f5"};
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Courier New', monospace;
            font-size: 0.875rem;
            border: 1px solid ${borderColor};
            word-break: break-all;
        }

        .info-item a {
            color: ${accentColor};
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s ease;
        }

        .info-item a:hover {
            color: ${accentHover};
            text-decoration: underline;
        }

        .badge {
            display: inline-block;
            padding: 0.375rem 0.75rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            margin-right: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            box-shadow: 0 1px 3px ${shadowColor};
        }

        .badge.module { background: #3b82f6; color: white; }
        .badge.provider { background: #10b981; color: white; }
        .badge.class { background: #3b82f6; color: white; }
        .badge.usevalue { background: #10b981; color: white; }
        .badge.usefactory { background: #f59e0b; color: white; }
        .badge.useclass { background: #eab308; color: #1a1a1a; }
        .badge.global { background: #a855f7; color: white; }

        .dependency-list {
            list-style: none;
            padding-left: 0;
        }

        .dependency-list li {
            padding: 0.5rem 0;
            font-size: 0.9rem;
            line-height: 1.6;
        }

        .dependency-list li::before {
            content: "→ ";
            color: ${accentColor};
            font-weight: bold;
            margin-right: 0.25rem;
        }

        .node-link {
            color: ${accentColor};
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s ease;
            font-weight: 500;
        }

        .node-link:hover {
            color: ${accentHover};
            text-decoration: underline;
        }

        .node-link code {
            color: inherit;
        }

        /* Scrollbar styling */
        .info-panel::-webkit-scrollbar {
            width: 8px;
        }

        .info-panel::-webkit-scrollbar-track {
            background: ${isDark ? "#1a1a1a" : "#f1f3f5"};
        }

        .info-panel::-webkit-scrollbar-thumb {
            background: ${isDark ? "#404040" : "#cbd5e0"};
            border-radius: 4px;
        }

        .info-panel::-webkit-scrollbar-thumb:hover {
            background: ${isDark ? "#505050" : "#a0aec0"};
        }
        `;
	}

	/**
	 * Generate JavaScript code
	 */
	private generateScript(
		_graphData: GraphOutput,
		cytoscapeData: {
			nodes: unknown[];
			edges: unknown[];
			providerMap: Record<string, string>;
			moduleMap: Record<string, string>;
		},
	): string {
		const ideUrlTemplate = this.getIdeUrl("{path}", 1, 1);

		return `
        const graphData = ${JSON.stringify({ nodes: cytoscapeData.nodes, edges: cytoscapeData.edges }, null, 2)};
        const providerMap = ${JSON.stringify(cytoscapeData.providerMap, null, 2)};
        const moduleMap = ${JSON.stringify(cytoscapeData.moduleMap, null, 2)};

        // Initialize Cytoscape
        const cy = cytoscape({
            container: document.getElementById('cy'),
            elements: graphData,

            // User interaction options
            userPanningEnabled: true,
            userZoomingEnabled: true,
            boxSelectionEnabled: false,

            // Panning configuration - require actual drag movement
            panningEnabled: true,

            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': '13px',
                        'font-weight': '700',
                        'color': '#1a1a1a',
                        'text-outline-width': 3,
                        'text-outline-color': '#ffffff',
                        'width': '90px',
                        'height': '90px',
                        'border-width': 3,
                        'border-color': '#64748b',
                        'text-wrap': 'wrap',
                        'text-max-width': '80px'
                    }
                },
                {
                    // Parent/compound nodes (modules containing providers)
                    selector: ':parent',
                    style: {
                        'text-valign': 'top',
                        'text-halign': 'center',
                        'text-margin-y': -12,
                        'background-opacity': 0.08,
                        'background-color': '#3b82f6',
                        'border-width': 3,
                        'border-color': '#2563eb',
                        'border-opacity': 0.6,
                        'padding': '15px',
                        'shape': 'roundrectangle',
                        'font-size': '15px',
                        'font-weight': 'bold',
                        'compound-sizing-wrt-labels': 'include',
                        'min-width': '100px',
                        'min-height': '80px',
                        'color': '#1e40af',
                        'text-outline-width': 2,
                        'text-outline-color': '#ffffff'
                    }
                },
                {
                    selector: ':parent.global',
                    style: {
                        'background-color': '#a855f7',
                        'border-color': '#9333ea',
                        'border-width': 4,
                        'color': '#7e22ce'
                    }
                },
                {
                    // Module nodes without children (standalone modules)
                    selector: 'node.module',
                    style: {
                        'background-color': '#3b82f6',
                        'border-color': '#2563eb',
                        'shape': 'roundrectangle',
                        'width': '140px',
                        'height': '70px',
                        'color': '#ffffff',
                        'text-outline-width': 0,
                        'font-size': '14px'
                    }
                },
                {
                    selector: 'node.module.global',
                    style: {
                        'background-color': '#a855f7',
                        'border-width': 4,
                        'border-color': '#9333ea'
                    }
                },
                {
                    selector: 'node.provider',
                    style: {
                        'shape': 'ellipse',
                        'width': '95px',
                        'height': '95px',
                        'font-size': '12px',
                        'text-wrap': 'wrap',
                        'text-max-width': '85px'
                    }
                },
                {
                    selector: 'node.provider.class',
                    style: {
                        'background-color': '#10b981',
                        'border-color': '#059669',
                        'border-width': 3,
                        'color': '#ffffff',
                        'text-outline-width': 0
                    }
                },
                {
                    selector: 'node.provider.usevalue',
                    style: {
                        'background-color': '#10b981',
                        'border-color': '#059669',
                        'border-width': 3,
                        'color': '#ffffff',
                        'text-outline-width': 0
                    }
                },
                {
                    selector: 'node.provider.usefactory',
                    style: {
                        'background-color': '#f59e0b',
                        'border-color': '#d97706',
                        'border-width': 3,
                        'color': '#ffffff',
                        'text-outline-width': 0
                    }
                },
                {
                    selector: 'node.provider.useclass',
                    style: {
                        'background-color': '#eab308',
                        'border-color': '#ca8a04',
                        'border-width': 3,
                        'color': '#1a1a1a',
                        'text-outline-width': 2,
                        'text-outline-color': '#ffffff'
                    }
                },
                {
                    // Providers with missing @Inject decorators (error state)
                    selector: 'node.provider.missing-decorator',
                    style: {
                        'border-width': 4,
                        'border-color': '#ef4444',
                        'border-style': 'double'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2.5,
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle',
                        'arrow-scale': 1.8,
                        'opacity': 0.85
                    }
                },
                {
                    selector: 'edge.import',
                    style: {
                        'line-color': '#64748b',
                        'target-arrow-color': '#64748b',
                        'width': 2.5
                    }
                },
                {
                    selector: 'edge.provides',
                    style: {
                        'line-color': '#10b981',
                        'target-arrow-color': '#10b981',
                        'line-style': 'dashed',
                        'width': 2.5
                    }
                },
                {
                    selector: 'edge.dependency',
                    style: {
                        'line-color': '#f59e0b',
                        'target-arrow-color': '#f59e0b',
                        'width': 3
                    }
                },
                {
                    selector: 'edge.dependency.optional',
                    style: {
                        'line-style': 'dotted',
                        'opacity': 0.6
                    }
                },
                {
                    selector: 'edge.dimmed',
                    style: {
                        'opacity': 0.1,
                        'z-index': 0
                    }
                },
                {
                    selector: 'node.dimmed',
                    style: {
                        'opacity': 0.3
                    }
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'border-width': 6,
                        'border-color': '#FF8C00', // Bright orange for maximum visibility
                        'background-color': '#FFD700', // Bright gold/yellow
                        'opacity': 1,
                        'z-index': 999, // Bring to front
                        'text-outline-color': '#000',
                        'text-outline-width': 2,
                        'font-weight': 'bold',
                        'font-size': '14px'
                    }
                },
                {
                    selector: ':parent.highlighted',
                    style: {
                        'border-width': 8,
                        'border-color': '#FF8C00', // Bright orange
                        'background-opacity': 0.2,
                        'background-color': '#FFD700',
                        'opacity': 1,
                        'z-index': 998
                    }
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'width': 6, // Thicker edges for better visibility
                        'line-color': '#FF8C00', // Bright orange
                        'target-arrow-color': '#FF8C00',
                        'opacity': 1,
                        'z-index': 999,
                        'arrow-scale': 2 // Larger arrows
                    }
                }
            ],
            layout: {
                name: 'cose',
                animate: true,
                animationDuration: 600,
                animationEasing: 'ease-out',
                nodeRepulsion: 10000,
                idealEdgeLength: 120,
                edgeElasticity: 120,
                nestingFactor: 1.8,
                gravity: 0.8,
                numIter: 1200,
                initialTemp: 250,
                coolingFactor: 0.95,
                minTemp: 1.0,
                // Compound node specific options
                componentSpacing: 120,
                nodeOverlap: 15,
                padding: 25
            }
        });

        // Hide dependency edges by default (show only module structure)
        cy.edges('.dependency').hide();

        // Fix for unwanted panning on click: Track mouse movement to distinguish click from drag
        let mouseDownPos = null;
        let isDragging = false;
        const DRAG_THRESHOLD = 5; // pixels - minimum movement to be considered a drag

        cy.on('mousedown', function(evt) {
            if (evt.target === cy) {
                // Store initial mouse position when clicking on background
                mouseDownPos = { x: evt.position.x, y: evt.position.y };
                isDragging = false;
            }
        });

        cy.on('mousemove', function(evt) {
            if (mouseDownPos) {
                // Calculate distance moved
                const dx = evt.position.x - mouseDownPos.x;
                const dy = evt.position.y - mouseDownPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // If moved more than threshold, it's a drag
                if (distance > DRAG_THRESHOLD) {
                    isDragging = true;
                }
            }
        });

        cy.on('mouseup', function(evt) {
            mouseDownPos = null;
            isDragging = false;
        });

        // Track currently selected node for edge filtering
        let selectedNode = null;

        // Node click handler
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const data = node.data();

            // Store the selected node
            selectedNode = node;

            // Clear previous highlights and dimming
            cy.elements().removeClass('highlighted dimmed');

            if (data.type === 'module') {
                // MODULE SELECTION: Show only edges related to this module

                // Get all edges connected to this module
                const moduleEdges = node.connectedEdges('.import');

                // Hide all edges first, then show only the module's edges
                cy.edges().hide();

                // Show and highlight only the module's import/export edges
                moduleEdges.show().addClass('highlighted');

                // Highlight the selected module
                node.addClass('highlighted');

                // Highlight connected modules
                moduleEdges.connectedNodes('[type="module"]').addClass('highlighted');

                // Dim all other nodes except highlighted ones
                cy.nodes().not('.highlighted').addClass('dimmed');

            } else if (data.type === 'provider') {
                // PROVIDER SELECTION: Show only edges related to this provider

                // Get all dependency edges connected to this provider
                const providerEdges = node.connectedEdges('.dependency');

                // Hide all edges first, then show only the provider's edges
                cy.edges().hide();

                // Show and highlight only the provider's dependency edges
                providerEdges.show().addClass('highlighted');

                // Highlight the selected provider
                node.addClass('highlighted');

                // Highlight connected providers
                providerEdges.connectedNodes('[type="provider"]').addClass('highlighted');

                // Dim all other nodes except highlighted ones
                cy.nodes().not('.highlighted').addClass('dimmed');
            }

            // Show node details
            showNodeDetails(data);
        });

        // Canvas click handler for deselection
        cy.on('tap', function(evt) {
            // Check if the tap was on the background (not on a node or edge)
            // AND it wasn't a drag operation
            if (evt.target === cy && !isDragging) {
                // Reset selection
                selectedNode = null;

                // Clear all highlights and dimming
                cy.elements().removeClass('highlighted dimmed');

                // Restore default view: show all module edges, hide dependency edges
                cy.edges('.import').show();
                cy.edges('.dependency').hide();

                // Ensure all nodes are visible
                cy.nodes().show();

                // Hide details panel or show default message
                document.getElementById('details').innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Click on a node to see details</p>';
            }
        });

        // Node hover handler
        cy.on('mouseover', 'node', function(evt) {
            const node = evt.target;
            node.style('cursor', 'pointer');
        });

        // View mode controls
        document.getElementById('view-all').addEventListener('click', function() {
            setActiveButton(this);
            // Reset selection
            selectedNode = null;
            // Clear highlights and dimming
            cy.elements().removeClass('highlighted dimmed');
            // Show all nodes
            cy.nodes().show();
            // Show import edges, hide dependency edges (default view)
            cy.edges('.import').show();
            cy.edges('.dependency').hide();
            cy.fit();
        });

        document.getElementById('view-modules').addEventListener('click', function() {
            setActiveButton(this);
            // Reset selection
            selectedNode = null;
            // Clear highlights and dimming
            cy.elements().removeClass('highlighted dimmed');
            // Hide provider nodes (children) but keep parent modules visible
            cy.nodes('[type="provider"]').hide();
            cy.edges('.dependency').hide();
            // Show parent modules and import edges
            cy.nodes(':parent').show();
            cy.nodes('[type="module"]').show();
            cy.edges('.import').show();
            cy.fit();
        });

        document.getElementById('view-providers').addEventListener('click', function() {
            setActiveButton(this);
            // Reset selection
            selectedNode = null;
            // Clear highlights and dimming
            cy.elements().removeClass('highlighted dimmed');
            // Show parent modules (to see grouping) and provider nodes
            cy.nodes(':parent').show();
            cy.nodes('[type="provider"]').show();
            // Show all dependency edges in this view
            cy.edges('.dependency').show();
            // Hide import edges but keep module containers visible for context
            cy.edges('.import').hide();
            cy.fit();
        });

        // Reset zoom
        document.getElementById('reset-zoom').addEventListener('click', function() {
            cy.zoom(1);
            cy.center();
        });

        // Fit graph
        document.getElementById('fit-graph').addEventListener('click', function() {
            cy.fit();
        });

        // Search functionality
        document.getElementById('search').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();

            if (!searchTerm) {
                // Reset to default view
                selectedNode = null;
                cy.nodes().show();
                cy.edges('.import').show();
                cy.edges('.dependency').hide();
                cy.elements().removeClass('highlighted dimmed');
                return;
            }

            cy.elements().removeClass('highlighted dimmed');

            const matchingNodes = cy.nodes().filter(function(node) {
                const label = node.data('label').toLowerCase();
                return label.includes(searchTerm);
            });

            if (matchingNodes.length > 0) {
                matchingNodes.addClass('highlighted');
                cy.fit(matchingNodes, 50);
            }
        });

        function setActiveButton(button) {
            document.querySelectorAll('.control-group button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
        }

        function navigateToNode(nodeId) {
            const node = cy.getElementById(nodeId);
            if (node.length > 0) {
                const data = node.data();

                // Store the selected node
                selectedNode = node;

                // Clear previous highlights and dimming
                cy.elements().removeClass('highlighted dimmed');

                if (data.type === 'module') {
                    // MODULE SELECTION: Show only edges related to this module

                    // Get all edges connected to this module
                    const moduleEdges = node.connectedEdges('.import');

                    // Hide all edges first, then show only the module's edges
                    cy.edges().hide();

                    // Show and highlight only the module's import/export edges
                    moduleEdges.show().addClass('highlighted');

                    // Highlight the selected module
                    node.addClass('highlighted');

                    // Highlight connected modules
                    moduleEdges.connectedNodes('[type="module"]').addClass('highlighted');

                    // Dim all other nodes except highlighted ones
                    cy.nodes().not('.highlighted').addClass('dimmed');

                } else if (data.type === 'provider') {
                    // PROVIDER SELECTION: Show only edges related to this provider

                    // Get all dependency edges connected to this provider
                    const providerEdges = node.connectedEdges('.dependency');

                    // Hide all edges first, then show only the provider's edges
                    cy.edges().hide();

                    // Show and highlight only the provider's dependency edges
                    providerEdges.show().addClass('highlighted');

                    // Highlight the selected provider
                    node.addClass('highlighted');

                    // Highlight connected providers
                    providerEdges.connectedNodes('[type="provider"]').addClass('highlighted');

                    // Dim all other nodes except highlighted ones
                    cy.nodes().not('.highlighted').addClass('dimmed');
                }

                // Animate pan and zoom to the node
                cy.animate({
                    center: { eles: node },
                    zoom: 1.5,
                    duration: 500,
                    easing: 'ease-in-out-cubic'
                });

                // Show node details
                showNodeDetails(data);
            }
        }

        function showNodeDetails(data) {
            const placeholder = document.querySelector('.placeholder');
            const detailsDiv = document.getElementById('node-details');

            placeholder.style.display = 'none';
            detailsDiv.style.display = 'block';

            let html = '';

            if (data.type === 'module') {
                html = \`
                    <div class="info-item">
                        <label>Type</label>
                        <div class="value">
                            <span class="badge module">Module</span>
                            \${data.isGlobal ? '<span class="badge global">Global</span>' : ''}
                        </div>
                    </div>
                    <div class="info-item">
                        <label>Name</label>
                        <div class="value"><code>\${data.label}</code></div>
                    </div>
                    <div class="info-item">
                        <label>File Path</label>
                        <div class="value">
                            <a href="${ideUrlTemplate.replace("{path}", "' + data.path + '")}" target="_blank">
                                \${data.path}
                            </a>
                        </div>
                    </div>
                    <div class="info-item">
                        <label>Imports (\${data.imports.length})</label>
                        <ul class="dependency-list">
                            \${data.imports.map(imp => {
                                const nodeId = 'module-' + imp;
                                const exists = cy.getElementById(nodeId).length > 0;
                                return exists
                                    ? '<li><a href="#" class="node-link" data-node-id="' + nodeId + '">' + imp + '</a></li>'
                                    : '<li>' + imp + '</li>';
                            }).join('')}
                        </ul>
                    </div>
                    <div class="info-item">
                        <label>Providers (\${data.providers.length})</label>
                        <ul class="dependency-list">
                            \${data.providers.map(prov => {
                                // Use providerMap to get the correct node ID
                                const nodeId = providerMap[prov];
                                const exists = nodeId && cy.getElementById(nodeId).length > 0;
                                return exists
                                    ? '<li><a href="#" class="node-link" data-node-id="' + nodeId + '">' + prov + '</a></li>'
                                    : '<li>' + prov + '</li>';
                            }).join('')}
                        </ul>
                    </div>
                    \${data.exports.length > 0 ? \`
                        <div class="info-item">
                            <label>Exports (\${data.exports.length})</label>
                            <ul class="dependency-list">
                                \${data.exports.map(exp => {
                                    // Check if export is a provider or a module
                                    let nodeId = providerMap[exp] || moduleMap[exp];
                                    const exists = nodeId && cy.getElementById(nodeId).length > 0;
                                    return exists
                                        ? '<li><a href="#" class="node-link" data-node-id="' + nodeId + '">' + exp + '</a></li>'
                                        : '<li>' + exp + '</li>';
                                }).join('')}
                            </ul>
                        </div>
                    \` : ''}
                \`;
            } else if (data.type === 'provider') {
                html = \`
                    <div class="info-item">
                        <label>Type</label>
                        <div class="value">
                            <span class="badge provider">Provider</span>
                            <span class="badge \${data.providerType.toLowerCase()}">\${data.providerType}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <label>Token</label>
                        <div class="value"><code>\${data.label}</code></div>
                    </div>
                    <div class="info-item">
                        <label>Module</label>
                        <div class="value">
                            \${(() => {
                                const nodeId = 'module-' + data.module;
                                const exists = cy.getElementById(nodeId).length > 0;
                                return exists
                                    ? '<a href="#" class="node-link" data-node-id="' + nodeId + '"><code>' + data.module + '</code></a>'
                                    : '<code>' + data.module + '</code>';
                            })()}
                        </div>
                    </div>
                    \${data.scope ? \`
                        <div class="info-item">
                            <label>Scope</label>
                            <div class="value">\${data.scope}</div>
                        </div>
                    \` : ''}
                    \${data.value !== undefined ? \`
                        <div class="info-item">
                            <label>Value</label>
                            <div class="value"><code>\${data.value}</code></div>
                        </div>
                    \` : ''}
                    \${data.factory ? \`
                        <div class="info-item">
                            <label>Factory</label>
                            <div class="value"><code>\${data.factory}</code></div>
                        </div>
                    \` : ''}
                    \${data.useClass ? \`
                        <div class="info-item">
                            <label>Use Class</label>
                            <div class="value"><code>\${data.useClass}</code></div>
                        </div>
                    \` : ''}
                    \${data.hasMissingDecorators ? \`
                        <div class="info-item" style="background: #ffebee; padding: 0.75rem; border-left: 3px solid #f44336; margin-bottom: 1rem;">
                            <label style="color: #c62828; font-weight: bold;">⚠️ Missing @Inject Decorators</label>
                            <div class="value" style="color: #c62828; font-size: 0.875rem;">
                                Some dependencies are missing explicit @Inject decorators. This may cause runtime errors.
                            </div>
                        </div>
                    \` : ''}
                    \${data.dependencies && data.dependencies.length > 0 ? \`
                        <div class="info-item">
                            <label>Dependencies (\${data.dependencies.length})</label>
                            <ul class="dependency-list">
                                \${data.dependencies.map(dep => {
                                    const token = dep.token || 'Unknown';
                                    // Use providerMap to get the correct node ID
                                    const nodeId = providerMap[token];
                                    const exists = nodeId && cy.getElementById(nodeId).length > 0;
                                    const link = exists
                                        ? '<a href="#" class="node-link" data-node-id="' + nodeId + '">' + token + '</a>'
                                        : token;
                                    const warning = dep.hasExplicitDecorator === false
                                        ? ' <span style="color: #f44336; font-weight: bold;">⚠️ Missing @Inject</span>'
                                        : '';
                                    return '<li>' + link + (dep.optional ? ' <em>(optional)</em>' : '') + warning + '</li>';
                                }).join('')}
                            </ul>
                        </div>
                    \` : ''}
                \`;
            }

            detailsDiv.innerHTML = html;

            // Attach click handlers to node links
            detailsDiv.querySelectorAll('.node-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const nodeId = this.getAttribute('data-node-id');
                    navigateToNode(nodeId);
                });
            });
        }
        `;
	}
}
