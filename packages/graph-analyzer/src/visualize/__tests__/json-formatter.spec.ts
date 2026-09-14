import {
	buildGraphModel,
	provider,
} from "../../graph/__tests__/graph-model-fixture";
import type {
	GraphModuleNode,
	NexusGraphModel,
} from "../../graph/nexus-graph-model";
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
				imports: [{ name: "UserModule", path: "/test/user.module.ts" }],
				exports: [{ name: "UserService", path: undefined }],
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
				module: { name: "AppModule", path: "/test/app.module.ts" },
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
				module: { name: "AppModule", path: "/test/app.module.ts" },
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
				module: { name: "AppModule", path: "/app/AppModule.ts" },
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
				module: { name: "AppModule", path: "/app/AppModule.ts" },
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

		it("does not lose or confuse two modules that share a display name", () => {
			// Hand-built model (not via buildGraphModel's name-as-id shorthand):
			// two distinct "SharedModule" declarations in different files, each
			// imported by AppModule under the same display name.
			const sharedA: GraphModuleNode = {
				name: "SharedModule",
				id: "/a/shared.module.ts:1:1",
				path: "/a/shared.module.ts",
				isGlobal: false,
				imports: [],
				exports: [],
				providers: [provider("ServiceA")],
			};
			const sharedB: GraphModuleNode = {
				name: "SharedModule",
				id: "/b/shared.module.ts:1:1",
				path: "/b/shared.module.ts",
				isGlobal: false,
				imports: [],
				exports: [],
				providers: [provider("ServiceB")],
			};
			const appModule: GraphModuleNode = {
				name: "AppModule",
				id: "/app/app.module.ts:1:1",
				path: "/app/app.module.ts",
				isGlobal: false,
				imports: [
					{ id: sharedA.id, name: sharedA.name, path: sharedA.path },
					{ id: sharedB.id, name: sharedB.name, path: sharedB.path },
				],
				exports: [],
				providers: [],
			};
			const graphModel: NexusGraphModel = {
				entryModuleId: appModule.id,
				modules: new Map([
					[appModule.id, appModule],
					[sharedA.id, sharedA],
					[sharedB.id, sharedB],
				]),
			};

			const formatter = new JsonFormatter(graphModel, "/test/entry.ts");
			const output = formatter.format();

			// Both same-named modules are present — neither dedup nor
			// overwrite-by-name lost one of them.
			expect(
				output.modules.filter((m) => m.name === "SharedModule"),
			).toHaveLength(2);
			expect(output.providers.map((p) => p.token).sort()).toEqual([
				"ServiceA",
				"ServiceB",
			]);
			// AppModule's imports correctly distinguish the two by path.
			const app = output.modules.find((m) => m.name === "AppModule");
			expect(app?.imports.map((i) => i.path).sort()).toEqual([
				"/a/shared.module.ts",
				"/b/shared.module.ts",
			]);
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
