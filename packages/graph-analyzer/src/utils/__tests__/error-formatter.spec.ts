import { describe, expect, it } from "vitest";
import { ErrorFormatter } from "../error-formatter";
import type { ValidationError } from "../validator";

describe("ErrorFormatter", () => {
	describe("formatValidationError", () => {
		it("should format error with message and suggestions", () => {
			const error: ValidationError = {
				type: "FILE_NOT_FOUND",
				message: "File not found: /path/to/file.ts",
				suggestions: [
					"Check if the file path is correct",
					"Make sure you're in the project root directory",
				],
			};

			const formatted = ErrorFormatter.formatValidationError(error);

			expect(formatted).toContain("❌ Error");
			expect(formatted).toContain("File not found: /path/to/file.ts");
			expect(formatted).toContain("Suggestions:");
			expect(formatted).toContain("Check if the file path is correct");
			expect(formatted).toContain(
				"Make sure you're in the project root directory",
			);
			expect(formatted).toContain("For more help, run: graph-analyzer --help");
		});

		it("should include details when provided", () => {
			const error: ValidationError = {
				type: "INVALID_TSCONFIG",
				message: "Invalid TypeScript configuration",
				suggestions: ["Fix the syntax error"],
				details: "Unexpected token at line 5",
			};

			const formatted = ErrorFormatter.formatValidationError(error);

			expect(formatted).toContain("Details:");
			expect(formatted).toContain("Unexpected token at line 5");
		});

		it("should handle empty suggestions", () => {
			const error: ValidationError = {
				type: "UNKNOWN_ERROR",
				message: "Something went wrong",
				suggestions: [],
			};

			const formatted = ErrorFormatter.formatValidationError(error);

			expect(formatted).toContain("Something went wrong");
			expect(formatted).not.toContain("Suggestions:");
		});

		it("should handle empty string suggestions for spacing", () => {
			const error: ValidationError = {
				type: "TEST_ERROR",
				message: "Test error",
				suggestions: ["First suggestion", "", "Second suggestion"],
			};

			const formatted = ErrorFormatter.formatValidationError(error);

			expect(formatted).toContain("First suggestion");
			expect(formatted).toContain("Second suggestion");
		});
	});

	describe("formatError", () => {
		it("should format generic error with suggestions", () => {
			const error = new Error("File not found: test.ts");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("❌ Error");
			expect(formatted).toContain("File not found: test.ts");
			expect(formatted).toContain("Suggestions:");
			expect(formatted).toContain("For more help, run: graph-analyzer --help");
		});

		it("should provide suggestions for file not found errors", () => {
			const error = new Error("ENOENT: no such file or directory");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("Check if the file path is correct");
			expect(formatted).toContain(
				"Make sure you're in the project root directory",
			);
		});

		it("should provide suggestions for no entry module errors", () => {
			const error = new Error("No entry module found in entry file");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("NexusFactory.create()");
			expect(formatted).toContain("@NsModule");
		});

		it("should provide suggestions for invalid format errors", () => {
			const error = new Error("Invalid format: xyz");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("Use one of: json, png, html, or both");
		});

		it("should provide suggestions for configuration errors", () => {
			const error = new Error("Invalid configuration: format must be string");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("Check your configuration file syntax");
			expect(formatted).toContain("graph-analyzer --init");
		});

		it("should provide suggestions for TypeScript errors", () => {
			const error = new Error("Cannot read properties of undefined");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("Check your TypeScript configuration");
			expect(formatted).toContain("tsconfig.json");
		});

		it("should provide suggestions for permission errors", () => {
			const error = new Error("EACCES: permission denied");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("Check file and directory permissions");
			expect(formatted).toContain("read/write access");
		});

		it("should provide suggestions for module resolution errors", () => {
			const error = new Error("Cannot find module '@nexus-ioc/core'");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("Check that all dependencies are installed");
			expect(formatted).toContain("npm install");
		});

		it("should provide suggestions for decorator errors", () => {
			const error = new Error("Decorator metadata not found");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("experimentalDecorators");
			expect(formatted).toContain("emitDecoratorMetadata");
		});

		it("should provide generic suggestions for unknown errors", () => {
			const error = new Error("Some unknown error");

			const formatted = ErrorFormatter.formatError(error);

			expect(formatted).toContain("Check the error message above for details");
			expect(formatted).toContain("--verbose");
		});
	});

	describe("formatSuccess", () => {
		it("should format success message with checkmark", () => {
			const formatted = ErrorFormatter.formatSuccess("Operation completed");

			expect(formatted).toBe("✓ Operation completed");
		});
	});

	describe("formatWarning", () => {
		it("should format warning message with warning symbol", () => {
			const formatted = ErrorFormatter.formatWarning("This is a warning");

			expect(formatted).toBe("⚠ This is a warning");
		});
	});

	describe("formatInfo", () => {
		it("should format info message with info symbol", () => {
			const formatted = ErrorFormatter.formatInfo("This is information");

			expect(formatted).toBe("ℹ This is information");
		});
	});
});
