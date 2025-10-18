import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	findConfigFile,
	generateConfigFile,
	loadConfig,
	loadConfigFile,
} from "../config-loader";

describe("Config Loader", () => {
	const testDir = path.join(__dirname, "test-configs");

	beforeEach(() => {
		// Create test directory
		if (!fs.existsSync(testDir)) {
			fs.mkdirSync(testDir, { recursive: true });
		}
	});

	afterEach(() => {
		// Clean up test directory
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("loadConfigFile", () => {
		it("should load JSON configuration file", () => {
			const configPath = path.join(testDir, "test.json");
			const config = {
				entryFile: "src/main.ts",
				format: "json" as const,
				verbose: true,
			};

			fs.writeFileSync(configPath, JSON.stringify(config));

			const loaded = loadConfigFile(configPath);
			expect(loaded).toEqual(config);
		});

		it("should load JavaScript configuration file", () => {
			const configPath = path.join(testDir, "test.config.js");
			const config = {
				entryFile: "src/main.ts",
				format: "png" as const,
				darkTheme: true,
			};

			fs.writeFileSync(
				configPath,
				`module.exports = ${JSON.stringify(config)}`,
			);

			const loaded = loadConfigFile(configPath);
			expect(loaded).toEqual(config);
		});

		it("should throw error for non-existent file", () => {
			expect(() => loadConfigFile("/non/existent/file.json")).toThrow(
				"Configuration file not found",
			);
		});

		it("should throw error for invalid JSON", () => {
			const configPath = path.join(testDir, "invalid.json");
			fs.writeFileSync(configPath, "{ invalid json }");

			expect(() => loadConfigFile(configPath)).toThrow(
				"Failed to load configuration",
			);
		});

		it("should validate configuration and throw on invalid format", () => {
			const configPath = path.join(testDir, "invalid-format.json");
			const config = {
				format: "invalid",
			};

			fs.writeFileSync(configPath, JSON.stringify(config));

			expect(() => loadConfigFile(configPath)).toThrow("Invalid configuration");
		});

		it("should validate configuration and throw on invalid ideProtocol", () => {
			const configPath = path.join(testDir, "invalid-ide.json");
			const config = {
				ideProtocol: "invalid",
			};

			fs.writeFileSync(configPath, JSON.stringify(config));

			expect(() => loadConfigFile(configPath)).toThrow("Invalid configuration");
		});
	});

	describe("findConfigFile", () => {
		it("should find .graph-analyzer.json", () => {
			const configPath = path.join(testDir, ".graph-analyzer.json");
			fs.writeFileSync(configPath, "{}");

			const found = findConfigFile(testDir);
			expect(found).toBe(configPath);
		});

		it("should find graph-analyzer.config.json", () => {
			const configPath = path.join(testDir, "graph-analyzer.config.json");
			fs.writeFileSync(configPath, "{}");

			const found = findConfigFile(testDir);
			expect(found).toBe(configPath);
		});

		it("should find graph-analyzer.config.js", () => {
			const configPath = path.join(testDir, "graph-analyzer.config.js");
			fs.writeFileSync(configPath, "module.exports = {}");

			const found = findConfigFile(testDir);
			expect(found).toBe(configPath);
		});

		it("should prioritize .graph-analyzer.json over others", () => {
			const jsonPath = path.join(testDir, ".graph-analyzer.json");
			const jsPath = path.join(testDir, "graph-analyzer.config.js");

			fs.writeFileSync(jsonPath, "{}");
			fs.writeFileSync(jsPath, "module.exports = {}");

			const found = findConfigFile(testDir);
			expect(found).toBe(jsonPath);
		});

		it("should return null if no config file found", () => {
			const found = findConfigFile(testDir);
			expect(found).toBeNull();
		});

		it("should search parent directories", () => {
			const parentDir = testDir;
			const childDir = path.join(testDir, "child");
			fs.mkdirSync(childDir, { recursive: true });

			const configPath = path.join(parentDir, ".graph-analyzer.json");
			fs.writeFileSync(configPath, "{}");

			const found = findConfigFile(childDir);
			expect(found).toBe(configPath);
		});
	});

	describe("loadConfig", () => {
		it("should load config from explicit path", () => {
			const configPath = path.join(testDir, "custom.json");
			const config = { entryFile: "src/app.ts" };
			fs.writeFileSync(configPath, JSON.stringify(config));

			const loaded = loadConfig(configPath);
			expect(loaded).toEqual(config);
		});

		it("should search for config file if no path provided", () => {
			const configPath = path.join(testDir, ".graph-analyzer.json");
			const config = { entryFile: "src/main.ts" };
			fs.writeFileSync(configPath, JSON.stringify(config));

			const loaded = loadConfig(undefined, testDir);
			expect(loaded).toEqual(config);
		});

		it("should return empty config if no file found", () => {
			const loaded = loadConfig(undefined, testDir);
			expect(loaded).toEqual({});
		});

		it("should throw error if explicit path is invalid", () => {
			expect(() => loadConfig("/non/existent/file.json")).toThrow();
		});
	});

	describe("generateConfigFile", () => {
		it("should generate JSON configuration file", () => {
			const outputPath = path.join(testDir, "generated.json");
			generateConfigFile(outputPath, "json");

			expect(fs.existsSync(outputPath)).toBe(true);

			const content = fs.readFileSync(outputPath, "utf8");
			const config = JSON.parse(content);

			expect(config).toHaveProperty("entryFile");
			expect(config).toHaveProperty("format");
			expect(config).toHaveProperty("verbose");
		});

		it("should generate JavaScript configuration file", () => {
			const outputPath = path.join(testDir, "generated.js");
			generateConfigFile(outputPath, "js");

			expect(fs.existsSync(outputPath)).toBe(true);

			const content = fs.readFileSync(outputPath, "utf8");
			expect(content).toContain("module.exports");
			expect(content).toContain("entryFile");
		});

		it("should create directory if it doesn't exist", () => {
			const nestedPath = path.join(testDir, "nested", "dir", "config.json");
			generateConfigFile(nestedPath, "json");

			expect(fs.existsSync(nestedPath)).toBe(true);
		});
	});
});
