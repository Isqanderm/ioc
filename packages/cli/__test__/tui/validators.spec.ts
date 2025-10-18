import { describe, expect, it } from "vitest";
import {
	validateComponentName,
	validateKebabCase,
	validateNotEmpty,
	validatePascalCase,
	validatePath,
} from "../../src/tui/utils/validators";

describe("Validators", () => {
	describe("validateNotEmpty", () => {
		it("should return error for empty string", () => {
			expect(validateNotEmpty("")).toBe("This field is required");
		});

		it("should return error for whitespace only", () => {
			expect(validateNotEmpty("   ")).toBe("This field is required");
		});

		it("should return undefined for valid string", () => {
			expect(validateNotEmpty("test")).toBeUndefined();
		});
	});

	describe("validatePascalCase", () => {
		it("should return error for empty string", () => {
			expect(validatePascalCase("")).toBe("Name is required");
		});

		it("should return error for lowercase start", () => {
			expect(validatePascalCase("testService")).toBe(
				"Name must start with an uppercase letter (PascalCase)",
			);
		});

		it("should return error for special characters", () => {
			expect(validatePascalCase("Test-Service")).toBe(
				"Name must contain only letters and numbers (no spaces or special characters)",
			);
		});

		it("should return error for spaces", () => {
			expect(validatePascalCase("Test Service")).toBe(
				"Name must contain only letters and numbers (no spaces or special characters)",
			);
		});

		it("should return undefined for valid PascalCase", () => {
			expect(validatePascalCase("TestService")).toBeUndefined();
		});

		it("should return undefined for PascalCase with numbers", () => {
			expect(validatePascalCase("Test123Service")).toBeUndefined();
		});
	});

	describe("validateKebabCase", () => {
		it("should return error for empty string", () => {
			expect(validateKebabCase("")).toBe("Name is required");
		});

		it("should return error for uppercase letters", () => {
			expect(validateKebabCase("Test-Service")).toBe(
				"Name must be in kebab-case (lowercase letters, numbers, and hyphens only)",
			);
		});

		it("should return error for spaces", () => {
			expect(validateKebabCase("test service")).toBe(
				"Name must be in kebab-case (lowercase letters, numbers, and hyphens only)",
			);
		});

		it("should return undefined for valid kebab-case", () => {
			expect(validateKebabCase("test-service")).toBeUndefined();
		});

		it("should return undefined for kebab-case with numbers", () => {
			expect(validateKebabCase("test-123-service")).toBeUndefined();
		});
	});

	describe("validatePath", () => {
		it("should return error for empty string", () => {
			expect(validatePath("")).toBe("Path is required");
		});

		it("should return undefined for relative path", () => {
			expect(validatePath("./src/services")).toBeUndefined();
		});

		it("should return undefined for absolute path", () => {
			expect(validatePath("/usr/local/src")).toBeUndefined();
		});

		it("should return undefined for Windows path", () => {
			expect(validatePath("C:\\Users\\test")).toBeUndefined();
		});

		it("should return error for invalid characters", () => {
			expect(validatePath("test@service")).toBe(
				"Path contains invalid characters",
			);
		});
	});

	describe("validateComponentName", () => {
		it("should return error for empty string", () => {
			expect(validateComponentName("")).toBe("This field is required");
		});

		it("should return error for invalid PascalCase", () => {
			expect(validateComponentName("testService")).toBe(
				"Name must start with an uppercase letter (PascalCase)",
			);
		});

		it("should return undefined for valid component name", () => {
			expect(validateComponentName("TestService")).toBeUndefined();
		});
	});
});
