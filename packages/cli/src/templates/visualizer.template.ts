export class VisualizerTemplate {
	public generate() {
		return `
      import * as path from "node:path";
      import { StaticGraphVisualizer } from "nexus-ioc-graph-visualizer";

      const visualizer = new StaticGraphVisualizer(
        path.join(__dirname, "bootstrap.ts"),
        { tsConfigPath: path.join(__dirname, "tsconfig.json") },
      );

      visualizer.renderPng(path.join(__dirname, "graph.png"));
    `;
	}
}
