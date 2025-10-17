import { describe, expect, it } from "vitest";
import {
	capitalize,
	formatFilePath,
	getFileIcon,
	toKebabCase,
	toPascalCase,
} from "../../src/tui/utils/formatters";

describe("Formatters", () => {
	describe("capitalize", () => {
		it("should capitalize first letter", () => {
			expect(capitalize("test")).toBe("Test");
		});

		it("should handle already capitalized string", () => {
			expect(capitalize("Test")).toBe("Test");
		});

		it("should handle empty string", () => {
			expect(capitalize("")).toBe("");
		});
	});

	describe("toPascalCase", () => {
		it("should convert kebab-case to PascalCase", () => {
			expect(toPascalCase("test-service")).toBe("TestService");
		});

		it("should convert snake_case to PascalCase", () => {
			expect(toPascalCase("test_service")).toBe("TestService");
		});

		it("should convert space-separated to PascalCase", () => {
			expect(toPascalCase("test service")).toBe("TestService");
		});

		it("should handle already PascalCase", () => {
			expect(toPascalCase("TestService")).toBe("TestService");
		});
	});

	describe("toKebabCase", () => {
		it("should convert PascalCase to kebab-case", () => {
			expect(toKebabCase("TestService")).toBe("test-service");
		});

		it("should convert camelCase to kebab-case", () => {
			expect(toKebabCase("testService")).toBe("test-service");
		});

		it("should convert space-separated to kebab-case", () => {
			expect(toKebabCase("test service")).toBe("test-service");
		});

		it("should handle already kebab-case", () => {
			expect(toKebabCase("test-service")).toBe("test-service");
		});
	});

	describe("getFileIcon", () => {
		it("should return correct icon for .ts files", () => {
			expect(getFileIcon("test.ts")).toBe("📘");
		});

		it("should return correct icon for .spec.ts files", () => {
			expect(getFileIcon("test.spec.ts")).toBe("🧪");
		});

		it("should return correct icon for .module.ts files", () => {
			expect(getFileIcon("test.module.ts")).toBe("📦");
		});

		it("should return correct icon for .service.ts files", () => {
			expect(getFileIcon("test.service.ts")).toBe("⚙️");
		});

		it("should return correct icon for .json files", () => {
			expect(getFileIcon("package.json")).toBe("📄");
		});

		it("should return default icon for unknown files", () => {
			expect(getFileIcon("test.txt")).toBe("📄");
		});
	});

	describe("formatFilePath", () => {
		it("should format file path with color", () => {
			const result = formatFilePath("./src/test.ts");
			expect(result).toContain("./src/test.ts");
		});
	});
});
