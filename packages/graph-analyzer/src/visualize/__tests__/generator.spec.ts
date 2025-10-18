import * as child_process from "node:child_process";
import * as fs from "node:fs";
import { GraphGenerator } from "../generator";

// Mock child_process and fs modules
vi.mock("node:child_process");
vi.mock("node:fs");

describe("GraphGenerator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Constructor", () => {
		it("should create instance with json and output path", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [],
					dependencies: [],
				},
			};

			const generator = new GraphGenerator(json, "./output/graph.png");
			
			expect(generator).toBeInstanceOf(GraphGenerator);
		});
	});

	describe("scan method", () => {
		it("should call spawnSync with correct arguments", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [],
					dependencies: [],
				},
			};

			const spawnSyncMock = vi.fn().mockReturnValue({
				error: null,
			});
			vi.mocked(child_process).spawnSync = spawnSyncMock;
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			expect(spawnSyncMock).toHaveBeenCalledWith(
				"dot",
				["-Tpng", "-o", "./output/graph.png"],
				expect.objectContaining({
					encoding: "utf-8",
				})
			);
		});

		it("should create output directory if it doesn't exist", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [],
					dependencies: [],
				},
			};

			const mkdirSyncMock = vi.fn();
			vi.mocked(fs).mkdirSync = mkdirSyncMock;
			vi.mocked(child_process).spawnSync = vi.fn().mockReturnValue({ error: null });

			const generator = new GraphGenerator(json, "./output/subdir/graph.png");
			generator.scan();

			expect(mkdirSyncMock).toHaveBeenCalledWith(
				expect.stringContaining("output"),
				{ recursive: true }
			);
		});

		it("should handle error from dot command", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [],
					dependencies: [],
				},
			};

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			vi.mocked(child_process).spawnSync = vi.fn().mockReturnValue({
				error: new Error("dot command not found"),
			});
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error running dot command:",
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});

		it("should log success message when graph is generated", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [],
					dependencies: [],
				},
			};

			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			vi.mocked(child_process).spawnSync = vi.fn().mockReturnValue({ error: null });
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Graph visualized as")
			);

			consoleLogSpy.mockRestore();
		});
	});

	describe("Graph Generation", () => {
		it("should generate graph with module nodes", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [],
					dependencies: [],
				},
				UserModule: {
					name: "UserModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [],
					dependencies: [],
				},
			};

			let dotInput = "";
			vi.mocked(child_process).spawnSync = vi.fn().mockImplementation((cmd, args, options) => {
				dotInput = options.input;
				return { error: null };
			});
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			expect(dotInput).toContain("AppModule");
			expect(dotInput).toContain("UserModule");
			expect(dotInput).toContain("digraph G");
		});

		it("should generate graph with provider nodes", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [
						{
							token: "UserService",
							type: "Class",
						},
					],
					dependencies: [],
				},
			};

			let dotInput = "";
			vi.mocked(child_process).spawnSync = vi.fn().mockImplementation((cmd, args, options) => {
				dotInput = options.input;
				return { error: null };
			});
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			expect(dotInput).toContain("UserService");
			expect(dotInput).toContain("Class");
		});

		it("should generate graph with import edges", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: ["UserModule"],
					exports: [],
					isGlobal: false,
					providers: [],
					dependencies: [],
				},
			};

			let dotInput = "";
			vi.mocked(child_process).spawnSync = vi.fn().mockImplementation((cmd, args, options) => {
				dotInput = options.input;
				return { error: null };
			});
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			expect(dotInput).toContain("AppModule");
			expect(dotInput).toContain("UserModule");
			expect(dotInput).toContain("->");
		});

		it("should color providers by type", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [
						{ token: "Service", type: "Class" },
						{ token: "CONFIG", type: "UseValue" },
						{ token: "FACTORY", type: "UseFactory" },
						{ token: "IMPL", type: "UseClass" },
					],
					dependencies: [],
				},
			};

			let dotInput = "";
			vi.mocked(child_process).spawnSync = vi.fn().mockImplementation((cmd, args, options) => {
				dotInput = options.input;
				return { error: null };
			});
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			expect(dotInput).toContain("lightblue"); // Class
			expect(dotInput).toContain("lightgreen"); // UseValue
			expect(dotInput).toContain("lightcoral"); // UseFactory
			expect(dotInput).toContain("lightyellow"); // UseClass
		});

		it("should handle providers with special characters in token", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [
						{ token: 'API_URL"test', type: "UseValue" },
					],
					dependencies: [],
				},
			};

			let dotInput = "";
			vi.mocked(child_process).spawnSync = vi.fn().mockImplementation((cmd, args, options) => {
				dotInput = options.input;
				return { error: null };
			});
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			// Should escape quotes in token
			expect(dotInput).toContain('\\"');
		});

		it("should handle empty providers array", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: [],
					exports: [],
					isGlobal: false,
					providers: [],
					dependencies: [],
				},
			};

			let dotInput = "";
			vi.mocked(child_process).spawnSync = vi.fn().mockImplementation((cmd, args, options) => {
				dotInput = options.input;
				return { error: null };
			});
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			expect(dotInput).toContain("AppModule");
			expect(dotInput).toContain("digraph G");
		});

		it("should handle multiple modules with complex relationships", () => {
			const json = {
				AppModule: {
					name: "AppModule",
					imports: ["UserModule", "PostModule"],
					exports: [],
					isGlobal: false,
					providers: [
						{ token: "AppService", type: "Class" },
					],
					dependencies: [],
				},
				UserModule: {
					name: "UserModule",
					imports: ["DatabaseModule"],
					exports: ["UserService"],
					isGlobal: false,
					providers: [
						{ token: "UserService", type: "Class" },
					],
					dependencies: [],
				},
			};

			let dotInput = "";
			vi.mocked(child_process).spawnSync = vi.fn().mockImplementation((cmd, args, options) => {
				dotInput = options.input;
				return { error: null };
			});
			vi.mocked(fs).mkdirSync = vi.fn();

			const generator = new GraphGenerator(json, "./output/graph.png");
			generator.scan();

			expect(dotInput).toContain("AppModule");
			expect(dotInput).toContain("UserModule");
			expect(dotInput).toContain("PostModule");
			expect(dotInput).toContain("DatabaseModule");
		});
	});
});

