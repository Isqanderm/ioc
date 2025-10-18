import * as ts from "typescript";
import { JsonFormatter } from "../json-formatter";
import { ParseEntryFile } from "../../parser/parse-entry-file";
import { ParseNsModule } from "../../parser/parse-ns-module";
import { ParseTsConfig } from "../../parser/parse-ts-config";

describe("JsonFormatter", () => {
	function createMockGraph(): Map<string, ParseNsModule | ParseEntryFile> {
		const graph = new Map<string, ParseNsModule | ParseEntryFile>();

		// Create mock entry file
		const entryFile = {
			name: "AppModule",
			imports: ["AppModule"],
			exports: [],
			deps: [],
			filePath: "/test/entry.ts",
		} as unknown as ParseEntryFile;

		// Create mock module
		const mockModule = {
			name: "AppModule",
			imports: ["UserModule"],
			exports: ["UserService"],
			providers: [
				{
					token: "UserService",
					type: "Class",
					scope: "Singleton",
					dependencies: [
						{
							type: "constructor",
							index: 0,
							token: "DatabaseService",
							tokenType: "class",
							optional: false,
						},
					],
				},
				{
					token: "CONFIG",
					type: "UseValue",
					value: "test-config",
					dependencies: [],
				},
			],
			deps: [],
			isGlobal: false,
			filePath: "/test/app.module.ts",
		} as unknown as ParseNsModule;

		const userModule = {
			name: "UserModule",
			imports: [],
			exports: [],
			providers: [
				{
					token: "DatabaseService",
					type: "Class",
					dependencies: [],
				},
			],
			deps: [],
			isGlobal: true,
			filePath: "/test/user.module.ts",
		} as unknown as ParseNsModule;

		graph.set("entry", entryFile);
		graph.set("AppModule", mockModule);
		graph.set("UserModule", userModule);

		return graph;
	}

	describe("format", () => {
		it("should format graph as GraphOutput", () => {
			const graph = createMockGraph();
			const formatter = new JsonFormatter(graph, "/test/entry.ts");

			const output = formatter.format();

			expect(output).toHaveProperty("modules");
			expect(output).toHaveProperty("providers");
			expect(output).toHaveProperty("metadata");
		});

		it("should include correct metadata", () => {
			const graph = createMockGraph();
			const formatter = new JsonFormatter(graph, "/test/entry.ts");

			const output = formatter.format();

			expect(output.metadata).toMatchObject({
				entryPoint: "/test/entry.ts",
				rootModule: "AppModule",
				version: "1.0.0",
				totalModules: 2,
				totalProviders: 3,
			});
			expect(output.metadata.analyzedAt).toBeDefined();
		});

		it("should format modules correctly", () => {
			const graph = createMockGraph();
			const formatter = new JsonFormatter(graph, "/test/entry.ts");

			const output = formatter.format();

			expect(output.modules).toHaveLength(2);

			const appModule = output.modules.find((m) => m.name === "AppModule");
			expect(appModule).toMatchObject({
				name: "AppModule",
				path: "/test/app.module.ts",
				imports: ["UserModule"],
				exports: ["UserService"],
				providers: ["UserService", "CONFIG"],
				isGlobal: false,
			});

			const userModule = output.modules.find((m) => m.name === "UserModule");
			expect(userModule).toMatchObject({
				name: "UserModule",
				path: "/test/user.module.ts",
				imports: [],
				exports: [],
				providers: ["DatabaseService"],
				isGlobal: true,
			});
		});

		it("should format providers correctly", () => {
			const graph = createMockGraph();
			const formatter = new JsonFormatter(graph, "/test/entry.ts");

			const output = formatter.format();

			expect(output.providers).toHaveLength(3);

			const userService = output.providers.find(
				(p) => p.token === "UserService",
			);
			expect(userService).toMatchObject({
				token: "UserService",
				type: "Class",
				module: "AppModule",
				scope: "Singleton",
			});
			expect(userService?.dependencies).toHaveLength(1);
			expect(userService?.dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "DatabaseService",
				tokenType: "class",
				optional: false,
			});

			const config = output.providers.find((p) => p.token === "CONFIG");
			expect(config).toMatchObject({
				token: "CONFIG",
				type: "UseValue",
				module: "AppModule",
				value: "test-config",
			});
		});

		it("should handle empty graph", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();
			const entryFile = {
				name: null,
				imports: [],
				exports: [],
				deps: [],
			} as unknown as ParseEntryFile;
			graph.set("entry", entryFile);

			const formatter = new JsonFormatter(graph, "/test/entry.ts");

			expect(() => formatter.format()).toThrow("Empty entry module");
		});
	});

	describe("formatAsString", () => {
		it("should format graph as JSON string", () => {
			const graph = createMockGraph();
			const formatter = new JsonFormatter(graph, "/test/entry.ts");

			const jsonString = formatter.formatAsString();

			expect(typeof jsonString).toBe("string");
			expect(() => JSON.parse(jsonString)).not.toThrow();

			const parsed = JSON.parse(jsonString);
			expect(parsed).toHaveProperty("modules");
			expect(parsed).toHaveProperty("providers");
			expect(parsed).toHaveProperty("metadata");
		});

		it("should respect indent parameter", () => {
			const graph = createMockGraph();
			const formatter = new JsonFormatter(graph, "/test/entry.ts");

			const jsonString = formatter.formatAsString(4);

			expect(jsonString).toContain("    "); // 4 spaces
		});
	});
});

