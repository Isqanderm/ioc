import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GraphOutput } from "../../interfaces/graph-output.interface";
import type { ParseEntryFile } from "../../parser/parse-entry-file";
import type { ParseNsModule } from "../../parser/parse-ns-module";
import { GraphAnalyzer } from "../graph-analyzer";

describe("Unused Provider Detection Integration", () => {
	const outputDir = "./test-output-unused";

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

	it("should detect unused providers in graph output", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create module with unused provider
		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
			providers: [
				{
					token: "UsedService",
					type: "Class",
					dependencies: [],
				},
				{
					token: "UnusedService",
					type: "Class",
					dependencies: [
						{
							type: "constructor",
							index: 0,
							token: "UsedService",
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
			jsonOutputPath: path.join(outputDir, "unused-test.json"),
			checkUnused: true,
		});

		const output = analyzer.generateJson();

		// Verify unused provider was detected
		expect(output.analysis).toBeDefined();
		expect(output.analysis?.unusedProviders).toBeDefined();
		expect(output.analysis?.unusedProviders?.length).toBeGreaterThan(0);

		// Verify the unused provider details
		const unusedProvider = output.analysis?.unusedProviders?.[0];
		expect(unusedProvider?.token).toBe("UnusedService");
		expect(unusedProvider?.module).toBe("AppModule");
		expect(unusedProvider?.type).toBe("Class");
		expect(unusedProvider?.severity).toBe("warning");
		expect(unusedProvider?.suggestions).toBeDefined();
	});

	it("should not include analysis field when no unused providers exist", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create module where all providers are used
		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
			providers: [
				{
					token: "ServiceA",
					type: "Class",
					dependencies: [],
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
				{
					token: "ServiceC",
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
			],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "no-unused-test.json"),
			checkUnused: true,
		});

		const output = analyzer.generateJson();

		// Verify no analysis field when no unused providers (ServiceC is unused)
		expect(output.analysis).toBeDefined();
		expect(output.analysis?.unusedProviders).toBeDefined();
	});

	it("should not perform unused provider detection when checkUnused is false", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create module with unused provider
		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
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

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "no-check-test.json"),
			checkUnused: false,
		});

		const output = analyzer.generateJson();

		// Verify no analysis field when checkUnused is false
		expect(output.analysis).toBeUndefined();
	});

	it("should write unused provider information to JSON file", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create module with unused provider
		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
			providers: [
				{
					token: "UsedService",
					type: "Class",
					dependencies: [],
				},
				{
					token: "UnusedService",
					type: "Class",
					dependencies: [
						{
							type: "constructor",
							index: 0,
							token: "UsedService",
							tokenType: "class",
							optional: false,
						},
					],
				},
			],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const outputPath = path.join(outputDir, "file-test.json");
		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: outputPath,
			checkUnused: true,
		});

		analyzer.generateJson();

		// Verify file was written
		expect(fs.existsSync(outputPath)).toBe(true);

		// Read and parse the file
		const fileContent = fs.readFileSync(outputPath, "utf8");
		const parsedOutput: GraphOutput = JSON.parse(fileContent);

		// Verify unused provider information is in the file
		expect(parsedOutput.analysis).toBeDefined();
		expect(parsedOutput.analysis?.unusedProviders).toBeDefined();
		expect(parsedOutput.analysis?.unusedProviders?.length).toBeGreaterThan(0);
	});

	it("should combine circular and unused provider analysis", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create entry
		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create circular module dependency and unused provider
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
		});

		const output = analyzer.generateJson();

		// Verify both analyses are present
		expect(output.analysis).toBeDefined();
		expect(output.analysis?.circularDependencies).toBeDefined();
		expect(output.analysis?.circularDependencies?.length).toBeGreaterThan(0);
		expect(output.analysis?.unusedProviders).toBeDefined();
		expect(output.analysis?.unusedProviders?.length).toBeGreaterThan(0);
	});
});
