import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GraphOutput } from "../../interfaces/graph-output.interface";
import type { ParseEntryFile } from "../../parser/parse-entry-file";
import type { ParseNsModule } from "../../parser/parse-ns-module";
import { GraphAnalyzer } from "../graph-analyzer";

describe("Provider Scope Analysis Integration", () => {
	const outputDir = "./test-output-scope";

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

	it("should analyze provider scopes in graph output", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
			providers: [
				{
					token: "SingletonService",
					type: "Class",
					dependencies: [],
				},
				{
					token: "RequestService",
					type: "Class",
					scope: "Scope.REQUEST",
					dependencies: [],
				},
				{
					token: "CONFIG",
					type: "UseValue",
					dependencies: [],
				},
			],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "scope-test.json"),
			checkScope: true,
		});

		const output = analyzer.generateJson();

		// Verify scope analysis was performed
		expect(output.analysis).toBeDefined();
		expect(output.analysis?.scopeAnalysis).toBeDefined();

		const scopeAnalysis = output.analysis?.scopeAnalysis;
		expect(scopeAnalysis?.totalProviders).toBe(3);
		expect(scopeAnalysis?.singletonProviders).toBe(2);
		expect(scopeAnalysis?.requestProviders).toBe(1);
		expect(scopeAnalysis?.scopeMismatches).toHaveLength(0);
	});

	it("should detect scope mismatches", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
			providers: [
				{
					token: "SingletonService",
					type: "Class",
					dependencies: [
						{
							type: "constructor",
							index: 0,
							token: "RequestService",
							tokenType: "class",
							optional: false,
							hasExplicitDecorator: false,
						},
					],
				},
				{
					token: "RequestService",
					type: "Class",
					scope: "Scope.REQUEST",
					dependencies: [],
				},
			],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "mismatch-test.json"),
			checkScope: true,
		});

		const output = analyzer.generateJson();

		const scopeAnalysis = output.analysis?.scopeAnalysis;
		expect(scopeAnalysis?.scopeMismatches).toHaveLength(1);
		expect(scopeAnalysis?.scopeMismatches[0]).toMatchObject({
			provider: "SingletonService",
			providerScope: "Singleton",
			dependency: "RequestService",
			dependencyScope: "Request",
			severity: "error",
		});
		expect(scopeAnalysis?.scopeMismatches[0].suggestions).toHaveLength(3);
	});

	it("should provide detailed provider scope information", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
			providers: [
				{
					token: "UserService",
					type: "Class",
					dependencies: [
						{
							type: "constructor",
							index: 0,
							token: "DatabaseService",
							tokenType: "class",
							optional: false,
							hasExplicitDecorator: false,
						},
					],
				},
				{
					token: "DatabaseService",
					type: "Class",
					dependencies: [],
				},
			],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: path.join(outputDir, "details-test.json"),
			checkScope: true,
		});

		const output = analyzer.generateJson();

		const scopeAnalysis = output.analysis?.scopeAnalysis;
		expect(scopeAnalysis?.providerScopes).toHaveLength(2);

		const userService = scopeAnalysis?.providerScopes.find(
			(p) => p.token === "UserService",
		);
		expect(userService).toBeDefined();
		expect(userService?.scope).toBe("Singleton");
		expect(userService?.type).toBe("Class");
		expect(userService?.dependencies).toContain("DatabaseService");
	});

	it("should not perform scope analysis when checkScope is false", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
			providers: [
				{
					token: "ServiceA",
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
			checkScope: false,
		});

		const output = analyzer.generateJson();

		// Verify no scope analysis when checkScope is false
		expect(output.analysis).toBeUndefined();
	});

	it("should write scope analysis to JSON file", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		graph.set("AppModule", {
			name: "AppModule",
			imports: [],
			providers: [
				{
					token: "ServiceA",
					type: "Class",
					dependencies: [],
				},
			],
			exports: [],
			isGlobal: false,
		} as unknown as ParseNsModule);

		const outputPath = path.join(outputDir, "file-test.json");
		const analyzer = new GraphAnalyzer(graph, "test.ts", {
			outputFormat: "json",
			jsonOutputPath: outputPath,
			checkScope: true,
		});

		analyzer.generateJson();

		// Verify file was written
		expect(fs.existsSync(outputPath)).toBe(true);

		// Read and parse the file
		const fileContent = fs.readFileSync(outputPath, "utf8");
		const parsedOutput: GraphOutput = JSON.parse(fileContent);

		// Verify scope analysis is in the file
		expect(parsedOutput.analysis).toBeDefined();
		expect(parsedOutput.analysis?.scopeAnalysis).toBeDefined();
		expect(parsedOutput.analysis?.scopeAnalysis?.totalProviders).toBe(1);
	});

	it("should combine all analysis features", () => {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		graph.set("entry", {
			name: "AppModule",
		} as unknown as ParseEntryFile);

		// Create a scenario with circular dependency, unused provider, deep hierarchy, and scope mismatch
		graph.set("AppModule", {
			name: "AppModule",
			imports: ["ModuleA"],
			providers: [
				{
					token: "UnusedService",
					type: "Class",
					dependencies: [],
				},
				{
					token: "SingletonService",
					type: "Class",
					dependencies: [
						{
							type: "constructor",
							index: 0,
							token: "RequestService",
							tokenType: "class",
							optional: false,
							hasExplicitDecorator: false,
						},
					],
				},
				{
					token: "RequestService",
					type: "Class",
					scope: "Scope.REQUEST",
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
			checkScope: true,
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
		expect(output.analysis?.scopeAnalysis).toBeDefined();
		expect(output.analysis?.scopeAnalysis?.scopeMismatches).toBeDefined();
		expect(
			output.analysis?.scopeAnalysis?.scopeMismatches.length,
		).toBeGreaterThan(0);
	});
});
