import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GraphOutput } from "../../interfaces/graph-output.interface";
import type { ParseEntryFile } from "../../parser/parse-entry-file";
import type { ParseNsModule } from "../../parser/parse-ns-module";
import { GraphAnalyzer } from "../graph-analyzer";

describe("Module Depth Analysis Integration", () => {
	const outputDir = "./test-output-depth";

	beforeEach(() => {
		// Create output directory
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}
	});

	afterEach(() => {
		// Clean up output files
		if (fs.existsSync(outputDir)) {
			const files = fs.readdirSync(outputDir);
			for (const file of files) {
				const filePath = path.join(outputDir, file);
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			}
			if (fs.existsSync(outputDir)) {
				fs.rmdirSync(outputDir);
			}
		}
	});

	it("should analyze module depth in graph output", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create a simple hierarchy
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

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "depth-test.json"),
			checkDepth: true,
		});

		const output = analyzer.generateJson();

		// Verify depth analysis was performed
		expect(output.analysis).toBeDefined();
		expect(output.analysis?.depthAnalysis).toBeDefined();

		const depthAnalysis = output.analysis?.depthAnalysis;
		expect(depthAnalysis?.maxDepth).toBe(2);
		expect(depthAnalysis?.totalModules).toBe(3);
		expect(depthAnalysis?.averageDepth).toBe(1);

		// Verify depth levels
		expect(depthAnalysis?.depthLevels).toHaveLength(3);
		expect(depthAnalysis?.depthLevels[0].level).toBe(0);
		expect(depthAnalysis?.depthLevels[0].modules).toContain("AppModule");

		// Verify module details
		expect(depthAnalysis?.moduleDetails).toHaveLength(3);
		const appModule = depthAnalysis?.moduleDetails.find(
			(m) => m.name === "AppModule",
		);
		expect(appModule?.depth).toBe(0);
		expect(appModule?.directImports).toBe(1);
	});

	it("should detect deep modules", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create a deep hierarchy
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

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "deep-modules-test.json"),
			checkDepth: true,
			deepModuleThreshold: 5,
		});

		const output = analyzer.generateJson();

		const depthAnalysis = output.analysis?.depthAnalysis;
		expect(depthAnalysis?.maxDepth).toBe(6);
		expect(depthAnalysis?.deepModules).toBeDefined();
		expect(depthAnalysis?.deepModules.length).toBeGreaterThan(0);

		// M5 and M6 should be flagged as deep
		const deepModuleNames = depthAnalysis?.deepModules.map((m) => m.name);
		expect(deepModuleNames).toContain("M5");
		expect(deepModuleNames).toContain("M6");
	});

	it("should calculate complexity metrics", () => {
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

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "complexity-test.json"),
			checkDepth: true,
		});

		const output = analyzer.generateJson();

		const depthAnalysis = output.analysis?.depthAnalysis;
		const appModule = depthAnalysis?.moduleDetails.find(
			(m) => m.name === "AppModule",
		);
		const sharedModule = depthAnalysis?.moduleDetails.find(
			(m) => m.name === "SharedModule",
		);

		// AppModule has 2 direct imports
		expect(appModule?.directImports).toBe(2);
		expect(appModule?.fanOut).toBe(2);

		// SharedModule is imported by 2 modules
		expect(sharedModule?.fanIn).toBe(2);

		// AppModule has 3 transitive dependencies (ModuleA, ModuleB, SharedModule)
		expect(appModule?.transitiveDependencies).toBe(3);
	});

	it("should not perform depth analysis when checkDepth is false", () => {
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
			imports: [],
			providers: [],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "no-check-test.json"),
			checkDepth: false,
		});

		const output = analyzer.generateJson();

		// Verify no depth analysis when checkDepth is false
		expect(output.analysis).toBeUndefined();
	});

	it("should write depth analysis to JSON file", () => {
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
			imports: [],
			providers: [],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const outputPath = path.join(outputDir, "file-test.json");
		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: outputPath,
			checkDepth: true,
		});

		analyzer.generateJson();

		// Verify file was written
		expect(fs.existsSync(outputPath)).toBe(true);

		// Read and parse the file
		const fileContent = fs.readFileSync(outputPath, "utf8");
		const parsedOutput: GraphOutput = JSON.parse(fileContent);

		// Verify depth analysis is in the file
		expect(parsedOutput.analysis).toBeDefined();
		expect(parsedOutput.analysis?.depthAnalysis).toBeDefined();
		expect(parsedOutput.analysis?.depthAnalysis?.maxDepth).toBe(1);
	});

	it("should combine all analysis features", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create circular dependency and deep hierarchy
		graph.set("AppModule", {
			name: "AppModule",
			imports: ["ModuleA"],
			providers: [
				{
					token: "UnusedService",
					type: "Class",
					dependencies: [],
				},
			],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		graph.set("ModuleA", {
			name: "ModuleA",
			imports: ["AppModule"],
			providers: [],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "combined-test.json"),
			checkCircular: true,
			checkUnused: true,
			checkDepth: true,
		});

		const output = analyzer.generateJson();

		// Verify all analyses are present
		expect(output.analysis).toBeDefined();
		expect(output.analysis?.circularDependencies).toBeDefined();
		expect(output.analysis?.circularDependencies?.length).toBeGreaterThan(0);
		expect(output.analysis?.unusedProviders).toBeDefined();
		expect(output.analysis?.unusedProviders?.length).toBeGreaterThan(0);
		expect(output.analysis?.depthAnalysis).toBeDefined();
		expect(output.analysis?.depthAnalysis?.maxDepth).toBeGreaterThanOrEqual(0);
	});
});
