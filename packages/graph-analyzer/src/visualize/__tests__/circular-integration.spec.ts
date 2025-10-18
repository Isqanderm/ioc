import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GraphOutput } from "../../interfaces/graph-output.interface";
import type { ParseEntryFile } from "../../parser/parse-entry-file";
import type { ParseNsModule } from "../../parser/parse-ns-module";
import { GraphAnalyzer } from "../graph-analyzer";

describe("Circular Dependency Detection Integration", () => {
	const outputDir = "./test-output";

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

	it("should detect module circular dependencies in graph output", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create circular module dependency: AppModule -> ModuleA -> ModuleB -> AppModule
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
			imports: ["AppModule"],
			providers: [],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "circular-test.json"),
			checkCircular: true,
		});

		const output = analyzer.generateJson();

		// Verify circular dependency was detected
		expect(output.analysis).toBeDefined();
		expect(output.analysis?.circularDependencies).toBeDefined();
		expect(output.analysis?.circularDependencies?.length).toBeGreaterThan(0);

		// Verify the cycle includes the expected modules
		const cycle = output.analysis?.circularDependencies?.[0];
		expect(cycle?.type).toBe("module");
		expect(cycle?.severity).toBe("error");
		expect(cycle?.cycle).toContain("AppModule");
		expect(cycle?.cycle).toContain("ModuleA");
		expect(cycle?.cycle).toContain("ModuleB");
	});

	it("should detect provider circular dependencies in graph output", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create circular provider dependency: ServiceA -> ServiceB -> ServiceA
		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
			providers: [
				{
					token: "ServiceA",
					type: "Class",
					dependencies: [
						{
							type: "constructor",
							index: 0,
							token: "ServiceB",
							tokenType: "class",
							optional: false,
						},
					],
				},
				{
					token: "ServiceB",
					type: "Class",
					dependencies: [
						{
							type: "constructor",
							index: 0,
							token: "ServiceA",
							tokenType: "class",
							optional: false,
						},
					],
				},
			],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "circular-provider-test.json"),
			checkCircular: true,
		});

		const output = analyzer.generateJson();

		// Verify circular dependency was detected
		expect(output.analysis).toBeDefined();
		expect(output.analysis?.circularDependencies).toBeDefined();
		expect(output.analysis?.circularDependencies?.length).toBeGreaterThan(0);

		// Verify the cycle includes the expected providers
		const cycle = output.analysis?.circularDependencies?.[0];
		expect(cycle?.type).toBe("provider");
		expect(cycle?.severity).toBe("error");
		expect(cycle?.cycle).toContain("ServiceA");
		expect(cycle?.cycle).toContain("ServiceB");
	});

	it("should not include analysis field when no circular dependencies exist", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create linear dependency chain (no cycles)
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
			jsonOutputPath: path.join(outputDir, "no-circular-test.json"),
			checkCircular: true,
		});

		const output = analyzer.generateJson();

		// Verify no analysis field when no circular dependencies
		expect(output.analysis).toBeUndefined();
	});

	it("should not perform circular dependency detection when checkCircular is false", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create circular module dependency
		graph.set("AppModule", {
			name: "AppModule",
			imports: ["ModuleA"],
			providers: [],
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
			jsonOutputPath: path.join(outputDir, "no-check-test.json"),
			checkCircular: false,
		});

		const output = analyzer.generateJson();

		// Verify no analysis field when checkCircular is false
		expect(output.analysis).toBeUndefined();
	});

	it("should write circular dependency information to JSON file", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create circular module dependency
		graph.set("AppModule", {
			name: "AppModule",
			imports: ["ModuleA"],
			providers: [],
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

		const outputPath = path.join(outputDir, "file-test.json");
		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: outputPath,
			checkCircular: true,
		});

		analyzer.generateJson();

		// Verify file was written
		expect(fs.existsSync(outputPath)).toBe(true);

		// Read and parse the file
		const fileContent = fs.readFileSync(outputPath, "utf8");
		const parsedOutput: GraphOutput = JSON.parse(fileContent);

		// Verify circular dependency information is in the file
		expect(parsedOutput.analysis).toBeDefined();
		expect(parsedOutput.analysis?.circularDependencies).toBeDefined();
		expect(parsedOutput.analysis?.circularDependencies?.length).toBeGreaterThan(
			0,
		);
	});
});
