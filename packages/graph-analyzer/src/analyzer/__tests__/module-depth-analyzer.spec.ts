import { describe, expect, it } from "vitest";
import type { ParseEntryFile } from "../../parser/parse-entry-file";
import type { ParseNsModule } from "../../parser/parse-ns-module";
import { ModuleDepthAnalyzer } from "../module-depth-analyzer";

describe("ModuleDepthAnalyzer", () => {
	describe("Basic Depth Calculation", () => {
		it("should calculate depth for a simple linear hierarchy", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["ModuleA"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleA", {
				name: "ModuleA",
				imports: ["ModuleB"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				name: "ModuleB",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
			const analysis = analyzer.analyze();

			expect(analysis.hasDepthAnalysis).toBe(true);
			expect(analysis.maxDepth).toBe(2);
			expect(analysis.totalModules).toBe(3);

			// Check individual module depths
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["ModuleA", "ModuleB"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleA", {
				name: "ModuleA",
				imports: ["ModuleC"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				name: "ModuleB",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleC", {
				name: "ModuleC",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
			const analysis = analyzer.analyze();

			expect(analysis.maxDepth).toBe(2);
			expect(analysis.totalModules).toBe(4);

			// Check depth levels
			const level0 = analysis.depthLevels.find((l) => l.level === 0);
			const level1 = analysis.depthLevels.find((l) => l.level === 1);
			const level2 = analysis.depthLevels.find((l) => l.level === 2);

			expect(level0?.modules).toContain("AppModule");
			expect(level1?.modules).toContain("ModuleA");
			expect(level1?.modules).toContain("ModuleB");
			expect(level2?.modules).toContain("ModuleC");
		});

		it("should handle shared dependencies correctly", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["ModuleA", "ModuleB"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleA", {
				name: "ModuleA",
				imports: ["SharedModule"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				name: "ModuleB",
				imports: ["SharedModule"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("SharedModule", {
				name: "SharedModule",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["ModuleA", "ModuleB", "ModuleC"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleA", {
				name: "ModuleA",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				name: "ModuleB",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleC", {
				name: "ModuleC",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
			const analysis = analyzer.analyze();

			const appModule = analysis.moduleDetails.find(
				(m) => m.name === "AppModule",
			);
			expect(appModule?.directImports).toBe(3);
			expect(appModule?.fanOut).toBe(3);
		});

		it("should calculate transitive dependencies correctly", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["ModuleA"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleA", {
				name: "ModuleA",
				imports: ["ModuleB"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				name: "ModuleB",
				imports: ["ModuleC"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleC", {
				name: "ModuleC",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["SharedModule"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleA", {
				name: "ModuleA",
				imports: ["SharedModule"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				name: "ModuleB",
				imports: ["SharedModule"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("SharedModule", {
				name: "SharedModule",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			// Create a deep hierarchy: AppModule -> M1 -> M2 -> M3 -> M4 -> M5 -> M6
			const modules = ["AppModule", "M1", "M2", "M3", "M4", "M5", "M6"];
			for (let i = 0; i < modules.length; i++) {
				const imports = i < modules.length - 1 ? [modules[i + 1]] : [];
				graph.set(modules[i], {
					name: modules[i],
					imports,
					providers: [],
					exports: [],
					isGlobal: false,
				} as unknown as ParseNsModule);
			}

			const analyzer = new ModuleDepthAnalyzer(graph, 5);
			const analysis = analyzer.analyze();

			expect(analysis.maxDepth).toBe(6);
			expect(analysis.deepModules.length).toBeGreaterThan(0);

			// M5 (depth 5) and M6 (depth 6) should be flagged as deep
			const deepModuleNames = analysis.deepModules.map((m) => m.name);
			expect(deepModuleNames).toContain("M5");
			expect(deepModuleNames).toContain("M6");
		});

		it("should use custom threshold for deep module detection", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["M1"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("M1", {
				name: "M1",
				imports: ["M2"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("M2", {
				name: "M2",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			// With threshold of 2, M2 (depth 2) should be flagged
			const analyzer = new ModuleDepthAnalyzer(graph, 2);
			const analysis = analyzer.analyze();

			expect(analysis.deepModuleThreshold).toBe(2);
			expect(analysis.deepModules.length).toBe(1);
			expect(analysis.deepModules[0].name).toBe("M2");
		});
	});

	describe("Statistics", () => {
		it("should calculate average depth correctly", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["M1", "M2"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("M1", {
				name: "M1",
				imports: ["M3"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("M2", {
				name: "M2",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("M3", {
				name: "M3",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
			const analysis = analyzer.analyze();

			// Depths: AppModule=0, M1=1, M2=1, M3=2
			// Average = (0 + 1 + 1 + 2) / 4 = 1.0
			expect(analysis.averageDepth).toBe(1.0);
		});

		it("should group modules by depth level correctly", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["M1", "M2"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("M1", {
				name: "M1",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("M2", {
				name: "M2",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			const analyzer = new ModuleDepthAnalyzer(graph);
			const analysis = analyzer.analyze();

			expect(analysis.hasDepthAnalysis).toBe(false);
			expect(analysis.maxDepth).toBe(0);
			expect(analysis.averageDepth).toBe(0);
			expect(analysis.totalModules).toBe(0);
			expect(analysis.moduleDetails).toHaveLength(0);
		});

		it("should handle single module", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
			const analysis = analyzer.analyze();

			expect(analysis.hasDepthAnalysis).toBe(true);
			expect(analysis.maxDepth).toBe(0);
			expect(analysis.averageDepth).toBe(0);
			expect(analysis.totalModules).toBe(1);
		});

		it("should handle modules with no entry point", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("ModuleA", {
				name: "ModuleA",
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ModuleDepthAnalyzer(graph);
			const analysis = analyzer.analyze();

			// Without entry point, no modules should be analyzed
			expect(analysis.moduleDetails).toHaveLength(0);
		});
	});
});
