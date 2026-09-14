import { describe, expect, it } from "vitest";
import { buildGraphModel } from "../../graph/__tests__/graph-model-fixture";
import { ModuleDepthAnalyzer } from "../module-depth-analyzer";

describe("ModuleDepthAnalyzer", () => {
	describe("Basic Depth Calculation", () => {
		it("should calculate depth for a simple linear hierarchy", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["ModuleA"] },
				ModuleA: { imports: ["ModuleB"] },
				ModuleB: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			expect(analysis.hasDepthAnalysis).toBe(true);
			expect(analysis.maxDepth).toBe(2);
			expect(analysis.totalModules).toBe(3);

			const appModule = analysis.moduleDetails.find(
				(m) => m.name === "AppModule",
			);
			const moduleA = analysis.moduleDetails.find((m) => m.name === "ModuleA");
			const moduleB = analysis.moduleDetails.find((m) => m.name === "ModuleB");

			expect(appModule?.depth).toBe(0);
			expect(moduleA?.depth).toBe(1);
			expect(moduleB?.depth).toBe(2);
		});

		it("should calculate depth for a branching hierarchy", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["ModuleA", "ModuleB"] },
				ModuleA: { imports: ["ModuleC"] },
				ModuleB: { imports: [] },
				ModuleC: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			expect(analysis.maxDepth).toBe(2);
			expect(analysis.totalModules).toBe(4);

			const level0 = analysis.depthLevels.find((l) => l.level === 0);
			const level1 = analysis.depthLevels.find((l) => l.level === 1);
			const level2 = analysis.depthLevels.find((l) => l.level === 2);

			expect(level0?.modules).toContain("AppModule");
			expect(level1?.modules).toContain("ModuleA");
			expect(level1?.modules).toContain("ModuleB");
			expect(level2?.modules).toContain("ModuleC");
		});

		it("should handle shared dependencies correctly", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["ModuleA", "ModuleB"] },
				ModuleA: { imports: ["SharedModule"] },
				ModuleB: { imports: ["SharedModule"] },
				SharedModule: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			// SharedModule should be at depth 2 (first encountered via ModuleA or ModuleB)
			const sharedModule = analysis.moduleDetails.find(
				(m) => m.name === "SharedModule",
			);
			expect(sharedModule?.depth).toBe(2);
		});
	});

	describe("Complexity Metrics", () => {
		it("should calculate direct imports correctly", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["ModuleA", "ModuleB", "ModuleC"] },
				ModuleA: { imports: [] },
				ModuleB: { imports: [] },
				ModuleC: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			const appModule = analysis.moduleDetails.find(
				(m) => m.name === "AppModule",
			);
			expect(appModule?.directImports).toBe(3);
			expect(appModule?.fanOut).toBe(3);
		});

		it("should calculate transitive dependencies correctly", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["ModuleA"] },
				ModuleA: { imports: ["ModuleB"] },
				ModuleB: { imports: ["ModuleC"] },
				ModuleC: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			const appModule = analysis.moduleDetails.find(
				(m) => m.name === "AppModule",
			);
			const moduleA = analysis.moduleDetails.find((m) => m.name === "ModuleA");
			const moduleB = analysis.moduleDetails.find((m) => m.name === "ModuleB");

			// AppModule depends on ModuleA, ModuleB, ModuleC (3 transitive)
			expect(appModule?.transitiveDependencies).toBe(3);
			// ModuleA depends on ModuleB, ModuleC (2 transitive)
			expect(moduleA?.transitiveDependencies).toBe(2);
			// ModuleB depends on ModuleC (1 transitive)
			expect(moduleB?.transitiveDependencies).toBe(1);
		});

		it("should calculate fan-in correctly", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["SharedModule"] },
				ModuleA: { imports: ["SharedModule"] },
				ModuleB: { imports: ["SharedModule"] },
				SharedModule: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			const sharedModule = analysis.moduleDetails.find(
				(m) => m.name === "SharedModule",
			);
			// SharedModule is imported by AppModule, ModuleA, ModuleB (fan-in = 3)
			expect(sharedModule?.fanIn).toBe(3);
		});
	});

	describe("Deep Module Detection", () => {
		it("should identify modules exceeding depth threshold", () => {
			// Create a deep hierarchy: AppModule -> M1 -> M2 -> M3 -> M4 -> M5 -> M6
			const names = ["AppModule", "M1", "M2", "M3", "M4", "M5", "M6"];
			const modules: Record<string, { imports: string[] }> = {};
			for (let i = 0; i < names.length; i++) {
				modules[names[i]] = {
					imports: i < names.length - 1 ? [names[i + 1]] : [],
				};
			}
			const graphModel = buildGraphModel("AppModule", modules);

			const analyzer = new ModuleDepthAnalyzer(graphModel, 5);
			const analysis = analyzer.analyze();

			expect(analysis.maxDepth).toBe(6);
			expect(analysis.deepModules.length).toBeGreaterThan(0);

			// M5 (depth 5) and M6 (depth 6) should be flagged as deep
			const deepModuleNames = analysis.deepModules.map((m) => m.name);
			expect(deepModuleNames).toContain("M5");
			expect(deepModuleNames).toContain("M6");
		});

		it("should use custom threshold for deep module detection", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["M1"] },
				M1: { imports: ["M2"] },
				M2: { imports: [] },
			});

			// With threshold of 2, M2 (depth 2) should be flagged
			const analyzer = new ModuleDepthAnalyzer(graphModel, 2);
			const analysis = analyzer.analyze();

			expect(analysis.deepModuleThreshold).toBe(2);
			expect(analysis.deepModules.length).toBe(1);
			expect(analysis.deepModules[0].name).toBe("M2");
		});
	});

	describe("Statistics", () => {
		it("should calculate average depth correctly", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["M1", "M2"] },
				M1: { imports: ["M3"] },
				M2: { imports: [] },
				M3: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			// Depths: AppModule=0, M1=1, M2=1, M3=2
			// Average = (0 + 1 + 1 + 2) / 4 = 1.0
			expect(analysis.averageDepth).toBe(1.0);
		});

		it("should group modules by depth level correctly", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["M1", "M2"] },
				M1: { imports: [] },
				M2: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			expect(analysis.depthLevels).toHaveLength(2);

			const level0 = analysis.depthLevels.find((l) => l.level === 0);
			const level1 = analysis.depthLevels.find((l) => l.level === 1);

			expect(level0?.count).toBe(1);
			expect(level0?.modules).toEqual(["AppModule"]);

			expect(level1?.count).toBe(2);
			expect(level1?.modules).toContain("M1");
			expect(level1?.modules).toContain("M2");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty graph", () => {
			const graphModel = buildGraphModel("", {});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			expect(analysis.hasDepthAnalysis).toBe(false);
			expect(analysis.maxDepth).toBe(0);
			expect(analysis.averageDepth).toBe(0);
			expect(analysis.totalModules).toBe(0);
			expect(analysis.moduleDetails).toHaveLength(0);
		});

		it("should handle single module", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			expect(analysis.hasDepthAnalysis).toBe(true);
			expect(analysis.maxDepth).toBe(0);
			expect(analysis.averageDepth).toBe(0);
			expect(analysis.totalModules).toBe(1);
		});

		it("should handle modules with no entry point", () => {
			const graphModel = buildGraphModel("", {
				ModuleA: { imports: [] },
			});

			const analyzer = new ModuleDepthAnalyzer(graphModel);
			const analysis = analyzer.analyze();

			// Without entry point, no modules should be analyzed
			expect(analysis.moduleDetails).toHaveLength(0);
		});
	});
});
