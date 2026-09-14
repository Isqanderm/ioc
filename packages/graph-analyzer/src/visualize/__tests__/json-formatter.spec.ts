import {
	buildGraphModel,
	provider,
} from "../../graph/__tests__/graph-model-fixture";
import type { NexusGraphModel } from "../../graph/nexus-graph-model";
import { JsonFormatter } from "../json-formatter";

describe("JsonFormatter", () => {
	function createMockGraph(): NexusGraphModel {
		return buildGraphModel("AppModule", {
			AppModule: {
				path: "/test/app.module.ts",
				imports: ["UserModule"],
				exports: ["UserService"],
				providers: [
					provider("UserService", {
						scope: "Singleton",
						dependencies: [{ token: "DatabaseService", optional: false }],
					}),
					provider("CONFIG", { type: "UseValue" }),
				],
			},
			UserModule: {
				path: "/test/user.module.ts",
				isGlobal: true,
				providers: [provider("DatabaseService")],
			},
		});
	}

	describe("format", () => {
		it("should format graph as GraphOutput", () => {
			const graphModel = createMockGraph();
			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");

			const output = formatter.format();

			expect(output).toHaveProperty("modules");
			expect(output).toHaveProperty("providers");
			expect(output).toHaveProperty("metadata");
		});

		it("should include correct metadata", () => {
			const graphModel = createMockGraph();
			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");

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
			const graphModel = createMockGraph();
			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");

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
			const graphModel = createMockGraph();
			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");

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
				token: "DatabaseService",
				optional: false,
			});

			const config = output.providers.find((p) => p.token === "CONFIG");
			expect(config).toMatchObject({
				token: "CONFIG",
				type: "UseValue",
				module: "AppModule",
			});
		});

		it("should handle empty graph", () => {
			const graphModel = buildGraphModel("", {});
			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");

			expect(() => formatter.format()).toThrow("Empty entry module");
		});

		it("should include factory-inject tokens as provider dependencies for UseFactory providers", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("LOGGER", {
							type: "UseFactory",
							dependencies: [{ token: "ConfigService", optional: false }],
						}),
					],
				},
			});

			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");
			const output = formatter.format();

			const logger = output.providers.find((p) => p.token === "LOGGER");
			expect(logger).toMatchObject({
				token: "LOGGER",
				type: "UseFactory",
				module: "AppModule",
			});
			expect(logger?.dependencies).toEqual([
				{ token: "ConfigService", optional: false },
			]);
		});

		it("should format UseClass providers correctly", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("UserService", {
							type: "UseClass",
							useClass: "UserServiceImpl",
						}),
					],
				},
			});

			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");
			const output = formatter.format();

			const userService = output.providers.find(
				(p) => p.token === "UserService",
			);
			expect(userService).toMatchObject({
				token: "UserService",
				type: "UseClass",
				module: "AppModule",
				useClass: "UserServiceImpl",
			});
		});

		it("should handle circular module dependencies", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					path: "/test/app.module.ts",
					imports: ["UserModule"],
				},
				UserModule: {
					path: "/test/user.module.ts",
					imports: ["AppModule"], // Circular dependency
				},
			});

			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");
			const output = formatter.format();

			// Should handle circular dependencies without infinite loop
			expect(output.modules).toHaveLength(2);
		});
	});

	describe("formatAsString", () => {
		it("should format graph as JSON string", () => {
			const graphModel = createMockGraph();
			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");

			const jsonString = formatter.formatAsString();

			expect(typeof jsonString).toBe("string");
			expect(() => JSON.parse(jsonString)).not.toThrow();

			const parsed = JSON.parse(jsonString);
			expect(parsed).toHaveProperty("modules");
			expect(parsed).toHaveProperty("providers");
			expect(parsed).toHaveProperty("metadata");
		});

		it("should respect indent parameter", () => {
			const graphModel = createMockGraph();
			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");

			const jsonString = formatter.formatAsString(4);

			expect(jsonString).toContain("    "); // 4 spaces
		});
	});
});
