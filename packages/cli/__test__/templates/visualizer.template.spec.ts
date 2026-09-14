import { describe, expect, it } from "vitest";
import { VisualizerTemplate } from "../../src/templates/visualizer.template";

describe("VisualizerTemplate", () => {
	describe("generate", () => {
		it("should generate a visualizer template", () => {
			const template = new VisualizerTemplate();
			const result = template.generate();

			expect(result).toContain(
				'import { StaticGraphVisualizer } from "nexus-ioc-graph-visualizer"',
			);
			expect(result).toContain(
				'new StaticGraphVisualizer(\n        path.join(__dirname, "bootstrap.ts")',
			);
			expect(result).toContain(
				'tsConfigPath: path.join(__dirname, "tsconfig.json")',
			);
			expect(result).toContain("visualizer.renderPng(");
		});

		it("should generate valid TypeScript code", () => {
			const template = new VisualizerTemplate();
			const result = template.generate();

			expect(result).toMatch(/const visualizer = new StaticGraphVisualizer\(/);
			expect(result).toMatch(/visualizer\.renderPng\(/);
		});
	});
});
