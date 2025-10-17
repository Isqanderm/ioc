import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ProjectScanner } from "../../src/tui/utils/project-scanner";

describe("ProjectScanner", () => {
	let scanner: ProjectScanner;

	beforeEach(() => {
		// Use the actual project directory for integration tests
		scanner = new ProjectScanner(process.cwd());
	});

	describe("findServices", () => {
		it("should return an array of services", async () => {
			const services = await scanner.findServices();

			// Should return an array (may be empty if no services exist)
			expect(Array.isArray(services)).toBe(true);

			// If services exist, they should have the correct structure
			if (services.length > 0) {
				expect(services[0]).toHaveProperty("name");
				expect(services[0]).toHaveProperty("className");
				expect(services[0]).toHaveProperty("filePath");
				expect(services[0]).toHaveProperty("relativePath");
				expect(services[0].className).toMatch(/Service$/);
			}
		});
	});

	describe("findModules", () => {
		it("should return an array of modules", async () => {
			const modules = await scanner.findModules();

			// Should return an array (may be empty if no modules exist)
			expect(Array.isArray(modules)).toBe(true);

			// If modules exist, they should have the correct structure
			if (modules.length > 0) {
				expect(modules[0]).toHaveProperty("name");
				expect(modules[0]).toHaveProperty("className");
				expect(modules[0]).toHaveProperty("filePath");
				expect(modules[0]).toHaveProperty("relativePath");
				expect(modules[0].className).toMatch(/Module$/);
			}
		});
	});

	describe("moduleExists", () => {
		it("should return false for non-existent module", async () => {
			const exists = await scanner.moduleExists(
				"./non-existent-path/fake.module.ts",
			);
			expect(exists).toBe(false);
		});
	});

	describe("getSuggestedPaths", () => {
		it("should return an array of suggested paths", async () => {
			const paths = await scanner.getSuggestedPaths();

			expect(Array.isArray(paths)).toBe(true);
			expect(paths.length).toBeGreaterThan(0);

			// Should include at least one path
			expect(paths.some((p) => typeof p === "string")).toBe(true);
		});
	});

	describe("path utilities", () => {
		it("should resolve path correctly", () => {
			const resolved = scanner.resolvePath("./src");
			expect(resolved).toContain("src");
			expect(path.isAbsolute(resolved)).toBe(true);
		});

		it("should get relative path correctly", () => {
			const absolute = path.join(process.cwd(), "src", "test.ts");
			const relative = scanner.getRelativePath(absolute);
			expect(relative).toBe(path.join("src", "test.ts"));
		});

		it("should get directory from file path", () => {
			const dir = scanner.getDirectory("./src/test.ts");
			expect(dir).toContain("src");
			expect(path.isAbsolute(dir)).toBe(true);
		});
	});
});
