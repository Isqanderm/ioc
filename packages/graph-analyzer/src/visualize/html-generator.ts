import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";
import type { GraphOutput } from "../interfaces/graph-output.interface";
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
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
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
	} {
		const nodes: unknown[] = [];
		const edges: unknown[] = [];

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

			// Add edges for module imports
			for (const importedModule of module.imports) {
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

		// Add provider nodes as children of their parent modules
		for (const provider of graphData.providers) {
			const nodeId = `provider-${provider.module}-${provider.token}`;
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
					// Set parent to create compound node structure
					parent: `module-${provider.module}`,
				},
				classes: ["provider", provider.type.toLowerCase()],
			});

			// Note: We no longer need "provides" edges since providers are children of modules

			// Add edges for provider dependencies
			if (provider.dependencies && provider.dependencies.length > 0) {
				for (const dep of provider.dependencies) {
					if (dep.token) {
						// Find the provider node for this dependency
						const depNodeId = `provider-${provider.module}-${dep.token}`;
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

		return { nodes, edges };
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
	 * Generate the complete HTML template
	 */
	private generateHtmlTemplate(
		graphData: GraphOutput,
		cytoscapeData: { nodes: unknown[]; edges: unknown[] },
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
		const bgColor = isDark ? "#1e1e1e" : "#ffffff";
		const textColor = isDark ? "#d4d4d4" : "#333333";
		const borderColor = isDark ? "#3e3e3e" : "#e0e0e0";
		const panelBg = isDark ? "#252526" : "#f5f5f5";

		return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: ${bgColor};
            color: ${textColor};
            overflow: hidden;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        header {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid ${borderColor};
            background: ${panelBg};
        }

        header h1 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
        }

        .metadata {
            display: flex;
            gap: 1.5rem;
            font-size: 0.875rem;
            color: ${isDark ? "#888" : "#666"};
        }

        .metadata code {
            background: ${isDark ? "#3e3e3e" : "#e8e8e8"};
            padding: 0.125rem 0.375rem;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }

        .controls {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid ${borderColor};
            display: flex;
            gap: 2rem;
            align-items: center;
            background: ${panelBg};
        }

        .control-group {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }

        .control-group label {
            font-weight: 500;
            font-size: 0.875rem;
        }

        button {
            padding: 0.5rem 1rem;
            border: 1px solid ${borderColor};
            background: ${bgColor};
            color: ${textColor};
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s;
        }

        button:hover {
            background: ${isDark ? "#3e3e3e" : "#e8e8e8"};
        }

        button.active {
            background: ${isDark ? "#0e639c" : "#007acc"};
            color: white;
            border-color: ${isDark ? "#0e639c" : "#007acc"};
        }

        input[type="text"] {
            padding: 0.5rem;
            border: 1px solid ${borderColor};
            background: ${bgColor};
            color: ${textColor};
            border-radius: 4px;
            font-size: 0.875rem;
            min-width: 250px;
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
            width: 350px;
            border-left: 1px solid ${borderColor};
            background: ${panelBg};
            padding: 1.5rem;
            overflow-y: auto;
        }

        .info-panel h3 {
            margin-bottom: 1rem;
            font-size: 1.125rem;
        }

        .info-panel .placeholder {
            color: ${isDark ? "#888" : "#666"};
            font-style: italic;
        }

        .info-item {
            margin-bottom: 1rem;
        }

        .info-item label {
            display: block;
            font-weight: 600;
            margin-bottom: 0.25rem;
            font-size: 0.875rem;
            color: ${isDark ? "#888" : "#666"};
        }

        .info-item .value {
            font-size: 0.9375rem;
        }

        .info-item code {
            background: ${isDark ? "#3e3e3e" : "#e8e8e8"};
            padding: 0.125rem 0.375rem;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.875rem;
        }

        .info-item a {
            color: ${isDark ? "#4fc3f7" : "#007acc"};
            text-decoration: none;
        }

        .info-item a:hover {
            text-decoration: underline;
        }

        .badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-right: 0.5rem;
        }

        .badge.module { background: #90caf9; color: #000; }
        .badge.provider { background: #a5d6a7; color: #000; }
        .badge.class { background: #90caf9; color: #000; }
        .badge.usevalue { background: #a5d6a7; color: #000; }
        .badge.usefactory { background: #ffab91; color: #000; }
        .badge.useclass { background: #fff59d; color: #000; }
        .badge.global { background: #ce93d8; color: #000; }

        .dependency-list {
            list-style: none;
            padding-left: 0;
        }

        .dependency-list li {
            padding: 0.25rem 0;
            font-size: 0.875rem;
        }

        .dependency-list li::before {
            content: "→ ";
            color: ${isDark ? "#888" : "#666"};
        }

        .node-link {
            color: ${isDark ? "#4fc3f7" : "#007acc"};
            text-decoration: none;
            cursor: pointer;
            transition: color 0.2s ease;
        }

        .node-link:hover {
            color: ${isDark ? "#81d4fa" : "#005a9e"};
            text-decoration: underline;
        }

        .node-link code {
            color: inherit;
        }
        `;
	}

	/**
	 * Generate JavaScript code
	 */
	private generateScript(
		graphData: GraphOutput,
		cytoscapeData: { nodes: unknown[]; edges: unknown[] },
	): string {
		const ideUrlTemplate = this.getIdeUrl("{path}", 1, 1);

		return `
        const graphData = ${JSON.stringify(cytoscapeData, null, 2)};

        // Initialize Cytoscape
        const cy = cytoscape({
            container: document.getElementById('cy'),
            elements: graphData,
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': '12px',
                        'font-weight': '600',
                        'color': '#333',
                        'text-outline-width': 2,
                        'text-outline-color': '#fff',
                        'width': '80px',
                        'height': '80px',
                        'border-width': 2,
                        'border-color': '#666'
                    }
                },
                {
                    // Parent/compound nodes (modules containing providers)
                    selector: ':parent',
                    style: {
                        'text-valign': 'top',
                        'text-halign': 'center',
                        'text-margin-y': -10,
                        'background-opacity': 0.15,
                        'background-color': '#90caf9',
                        'border-width': 3,
                        'border-color': '#42a5f5',
                        'border-opacity': 0.8,
                        'padding': '20px',
                        'shape': 'roundrectangle',
                        'font-size': '14px',
                        'font-weight': 'bold'
                    }
                },
                {
                    selector: ':parent.global',
                    style: {
                        'background-color': '#ce93d8',
                        'border-color': '#ab47bc',
                        'border-width': 4
                    }
                },
                {
                    // Module nodes without children (standalone modules)
                    selector: 'node.module',
                    style: {
                        'background-color': '#90caf9',
                        'shape': 'roundrectangle',
                        'width': '120px',
                        'height': '60px'
                    }
                },
                {
                    selector: 'node.module.global',
                    style: {
                        'background-color': '#ce93d8',
                        'border-width': 3,
                        'border-color': '#9c27b0'
                    }
                },
                {
                    selector: 'node.provider',
                    style: {
                        'shape': 'ellipse',
                        'width': '80px',
                        'height': '80px',
                        'font-size': '10px'
                    }
                },
                {
                    selector: 'node.provider.class',
                    style: {
                        'background-color': '#a5d6a7',
                        'border-color': '#66bb6a'
                    }
                },
                {
                    selector: 'node.provider.usevalue',
                    style: {
                        'background-color': '#a5d6a7',
                        'border-color': '#66bb6a'
                    }
                },
                {
                    selector: 'node.provider.usefactory',
                    style: {
                        'background-color': '#ffab91',
                        'border-color': '#ff7043'
                    }
                },
                {
                    selector: 'node.provider.useclass',
                    style: {
                        'background-color': '#fff59d',
                        'border-color': '#ffee58'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle',
                        'arrow-scale': 1.5
                    }
                },
                {
                    selector: 'edge.import',
                    style: {
                        'line-color': '#666',
                        'target-arrow-color': '#666'
                    }
                },
                {
                    selector: 'edge.provides',
                    style: {
                        'line-color': '#4caf50',
                        'target-arrow-color': '#4caf50',
                        'line-style': 'dashed'
                    }
                },
                {
                    selector: 'edge.dependency',
                    style: {
                        'line-color': '#ff9800',
                        'target-arrow-color': '#ff9800'
                    }
                },
                {
                    selector: 'edge.dependency.optional',
                    style: {
                        'line-style': 'dotted'
                    }
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'border-width': 4,
                        'border-color': '#ffd54f',
                        'background-color': '#ffd54f'
                    }
                },
                {
                    selector: ':parent.highlighted',
                    style: {
                        'border-width': 5,
                        'border-color': '#ffc107',
                        'background-opacity': 0.3
                    }
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'width': 4,
                        'line-color': '#ffd54f',
                        'target-arrow-color': '#ffd54f'
                    }
                }
            ],
            layout: {
                name: 'cose',
                animate: true,
                animationDuration: 500,
                nodeRepulsion: 8000,
                idealEdgeLength: 100,
                edgeElasticity: 100,
                nestingFactor: 1.2,
                gravity: 1,
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0,
                // Compound node specific options
                componentSpacing: 100,
                nodeOverlap: 20,
                padding: 30
            }
        });

        // Node click handler
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const data = node.data();

            // Clear previous highlights
            cy.elements().removeClass('highlighted');

            // Highlight clicked node
            node.addClass('highlighted');

            // Highlight connected edges
            node.connectedEdges().addClass('highlighted');

            // Show node details
            showNodeDetails(data);
        });

        // Node hover handler
        cy.on('mouseover', 'node', function(evt) {
            const node = evt.target;
            node.style('cursor', 'pointer');
        });

        // View mode controls
        document.getElementById('view-all').addEventListener('click', function() {
            setActiveButton(this);
            cy.elements().show();
            cy.fit();
        });

        document.getElementById('view-modules').addEventListener('click', function() {
            setActiveButton(this);
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
            // Show parent modules (to see grouping) and provider nodes
            cy.nodes(':parent').show();
            cy.nodes('[type="provider"]').show();
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
                cy.elements().show();
                cy.elements().removeClass('highlighted');
                return;
            }

            cy.elements().removeClass('highlighted');

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
                // Remove previous highlights
                cy.elements().removeClass('highlighted');

                // Highlight the target node and its edges
                node.addClass('highlighted');
                node.connectedEdges().addClass('highlighted');

                // Animate pan and zoom to the node
                cy.animate({
                    center: { eles: node },
                    zoom: 1.5,
                    duration: 500,
                    easing: 'ease-in-out-cubic'
                });

                // Show node details
                showNodeDetails(node.data());
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
                                const nodeId = 'provider-' + prov;
                                const exists = cy.getElementById(nodeId).length > 0;
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
                                    const nodeId = 'provider-' + exp;
                                    const exists = cy.getElementById(nodeId).length > 0;
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
                    \${data.dependencies && data.dependencies.length > 0 ? \`
                        <div class="info-item">
                            <label>Dependencies (\${data.dependencies.length})</label>
                            <ul class="dependency-list">
                                \${data.dependencies.map(dep => {
                                    const token = dep.token || 'Unknown';
                                    const nodeId = 'provider-' + token;
                                    const exists = cy.getElementById(nodeId).length > 0;
                                    const link = exists
                                        ? '<a href="#" class="node-link" data-node-id="' + nodeId + '">' + token + '</a>'
                                        : token;
                                    return '<li>' + link + (dep.optional ? ' <em>(optional)</em>' : '') + '</li>';
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

