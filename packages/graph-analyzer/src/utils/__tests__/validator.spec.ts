import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Validator } from "../validator";

describe("Validator", () => {
	const testDir = path.join(__dirname, "test-validation");

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

	describe("validateFileExists", () => {
		it("should return null for existing file", () => {
			const filePath = path.join(testDir, "test.ts");
			fs.writeFileSync(filePath, "");

			const error = Validator.validateFileExists(filePath);
			expect(error).toBeNull();
		});

		it("should return error for non-existent file", () => {
			const filePath = path.join(testDir, "nonexistent.ts");

			const error = Validator.validateFileExists(filePath);
			expect(error).not.toBeNull();
			expect(error?.type).toBe("FILE_NOT_FOUND");
			expect(error?.message).toContain("File not found");
		});

		it("should include absolute path in error", () => {
			const filePath = "nonexistent.ts";

			const error = Validator.validateFileExists(filePath);
			expect(error?.details).toContain(path.resolve(filePath));
		});
	});

	describe("validateTypeScriptFile", () => {
		it("should return null for .ts file", () => {
			const error = Validator.validateTypeScriptFile("test.ts");
			expect(error).toBeNull();
		});

		it("should return null for .tsx file", () => {
			const error = Validator.validateTypeScriptFile("test.tsx");
			expect(error).toBeNull();
		});

		it("should return error for .js file", () => {
			const error = Validator.validateTypeScriptFile("test.js");
			expect(error).not.toBeNull();
			expect(error?.type).toBe("INVALID_FILE_EXTENSION");
		});

		it("should return error for .json file", () => {
			const error = Validator.validateTypeScriptFile("test.json");
			expect(error).not.toBeNull();
			expect(error?.type).toBe("INVALID_FILE_EXTENSION");
		});

		it("should be case-insensitive", () => {
			const error1 = Validator.validateTypeScriptFile("test.TS");
			const error2 = Validator.validateTypeScriptFile("test.TSX");

			expect(error1).toBeNull();
			expect(error2).toBeNull();
		});
	});

	describe("validateFileReadable", () => {
		it("should return null for readable file", () => {
			const filePath = path.join(testDir, "readable.ts");
			fs.writeFileSync(filePath, "content");

			const error = Validator.validateFileReadable(filePath);
			expect(error).toBeNull();
		});

		it("should return error for non-existent file", () => {
			const filePath = path.join(testDir, "nonexistent.ts");

			const error = Validator.validateFileReadable(filePath);
			expect(error).not.toBeNull();
			expect(error?.type).toBe("FILE_NOT_READABLE");
		});
	});

	describe("validateTsConfig", () => {
		it("should return null when tsConfig is undefined", () => {
			const error = Validator.validateTsConfig(undefined);
			expect(error).toBeNull();
		});

		it("should return null for valid tsconfig.json", () => {
			const tsConfigPath = path.join(testDir, "tsconfig.json");
			fs.writeFileSync(tsConfigPath, JSON.stringify({ compilerOptions: {} }));

			const error = Validator.validateTsConfig(tsConfigPath);
			expect(error).toBeNull();
		});

		it("should return error for non-existent tsconfig", () => {
			const tsConfigPath = path.join(testDir, "nonexistent-tsconfig.json");

			const error = Validator.validateTsConfig(tsConfigPath);
			expect(error).not.toBeNull();
			expect(error?.type).toBe("TSCONFIG_NOT_FOUND");
		});

		it("should return error for invalid JSON", () => {
			const tsConfigPath = path.join(testDir, "invalid-tsconfig.json");
			fs.writeFileSync(tsConfigPath, "{ invalid json }");

			const error = Validator.validateTsConfig(tsConfigPath);
			expect(error).not.toBeNull();
			expect(error?.type).toBe("INVALID_TSCONFIG");
		});
	});

	describe("validateGraphvizInstalled", () => {
		it("should return null for json format", () => {
			const error = Validator.validateGraphvizInstalled("json");
			expect(error).toBeNull();
		});

		it("should return null for html format", () => {
			const error = Validator.validateGraphvizInstalled("html");
			expect(error).toBeNull();
		});

		it("should check Graphviz for png format", () => {
			const error = Validator.validateGraphvizInstalled("png");
			// This will depend on whether Graphviz is installed
			// We just check that it returns a result (null or error)
			expect(error === null || error?.type === "GRAPHVIZ_NOT_FOUND").toBe(true);
		});

		it("should check Graphviz for both format", () => {
			const error = Validator.validateGraphvizInstalled("both");
			// This will depend on whether Graphviz is installed
			expect(error === null || error?.type === "GRAPHVIZ_NOT_FOUND").toBe(true);
		});

		it("should check Graphviz when format is undefined", () => {
			const error = Validator.validateGraphvizInstalled(undefined);
			// This will depend on whether Graphviz is installed
			expect(error === null || error?.type === "GRAPHVIZ_NOT_FOUND").toBe(true);
		});
	});

	describe("validateOutputDirectory", () => {
		it("should return null for writable directory", () => {
			const outputPath = path.join(testDir, "output.json");

			const error = Validator.validateOutputDirectory(outputPath);
			expect(error).toBeNull();
		});

		it("should create directory if it doesn't exist", () => {
			const outputPath = path.join(testDir, "nested", "dir", "output.json");

			const error = Validator.validateOutputDirectory(outputPath);
			expect(error).toBeNull();
			expect(fs.existsSync(path.dirname(outputPath))).toBe(true);
		});

		it("should return null for existing writable directory", () => {
			const dir = path.join(testDir, "existing");
			fs.mkdirSync(dir, { recursive: true });
			const outputPath = path.join(dir, "output.json");

			const error = Validator.validateOutputDirectory(outputPath);
			expect(error).toBeNull();
		});
	});

	describe("validateEntryFile", () => {
		it("should return null for valid TypeScript file", () => {
			const filePath = path.join(testDir, "entry.ts");
			fs.writeFileSync(filePath, "");

			const error = Validator.validateEntryFile(filePath);
			expect(error).toBeNull();
		});

		it("should return error for non-existent file", () => {
			const filePath = path.join(testDir, "nonexistent.ts");

			const error = Validator.validateEntryFile(filePath);
			expect(error).not.toBeNull();
			expect(error?.type).toBe("FILE_NOT_FOUND");
		});

		it("should return error for invalid extension", () => {
			const filePath = path.join(testDir, "entry.js");
			fs.writeFileSync(filePath, "");

			const error = Validator.validateEntryFile(filePath);
			expect(error).not.toBeNull();
			expect(error?.type).toBe("INVALID_FILE_EXTENSION");
		});
	});

	describe("runPreflightChecks", () => {
		it("should return null for valid options", () => {
			const entryFile = path.join(testDir, "entry.ts");
			fs.writeFileSync(entryFile, "");

			const error = Validator.runPreflightChecks({
				entryFile,
				format: "json",
			});

			expect(error).toBeNull();
		});

		it("should return error for invalid entry file", () => {
			const error = Validator.runPreflightChecks({
				entryFile: "nonexistent.ts",
				format: "json",
			});

			expect(error).not.toBeNull();
			expect(error?.type).toBe("FILE_NOT_FOUND");
		});

		it("should return error for invalid tsconfig", () => {
			const entryFile = path.join(testDir, "entry.ts");
			fs.writeFileSync(entryFile, "");

			const error = Validator.runPreflightChecks({
				entryFile,
				tsConfig: "nonexistent-tsconfig.json",
				format: "json",
			});

			expect(error).not.toBeNull();
			expect(error?.type).toBe("TSCONFIG_NOT_FOUND");
		});

		it("should validate output directory", () => {
			const entryFile = path.join(testDir, "entry.ts");
			fs.writeFileSync(entryFile, "");

			const error = Validator.runPreflightChecks({
				entryFile,
				output: path.join(testDir, "output", "graph.json"),
				format: "json",
			});

			expect(error).toBeNull();
			expect(fs.existsSync(path.join(testDir, "output"))).toBe(true);
		});
	});
});
