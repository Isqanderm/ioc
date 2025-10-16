import { describe, expect, it } from "vitest";
import { VisualizerTemplate } from "../../src/templates/visualizer.template";

describe("VisualizerTemplate", () => {
	describe("generate", () => {
		it("should generate a visualizer template", () => {
			const template = new VisualizerTemplate();
			const result = template.generate();

			expect(result).toContain(
				'import { NexusApplicationsServer } from "@nexus-ioc/core/dist/server"',
			);
			expect(result).toContain(
				"import { GraphScannerVisualizer } from 'nexus-ioc-graph-visualizer'",
			);
			expect(result).toContain('import { AppModule } from "./app.module"');
			expect(result).toContain(
				"const visualizer = new GraphScannerVisualizer('graph.png')",
			);
			expect(result).toContain("async function bootstrap()");
			expect(result).toContain("NexusApplicationsServer.create(AppModule)");
			expect(result).toContain(".addScannerPlugin(visualizer)");
			expect(result).toContain(".bootstrap()");
			expect(result).toContain("bootstrap()");
		});

		it("should generate valid TypeScript code", () => {
			const template = new VisualizerTemplate();
			const result = template.generate();

			// Check for proper function structure
			expect(result).toMatch(/async function bootstrap\(\)/);
			expect(result).toMatch(/bootstrap\(\);/);
			// Check for visualizer initialization
			expect(result).toMatch(/new GraphScannerVisualizer\('graph\.png'\)/);
		});
	});
});
