import { describe, expect, it } from "vitest";
import { CodePreview } from "../../src/tui/components/code-preview";

describe("CodePreview", () => {
	describe("showFileList", () => {
		it("should display file list without errors", () => {
			const files = [
				{ path: "test.service.ts", content: "export class TestService {}" },
				{ path: "test.module.ts", content: "export class TestModule {}" },
			];

			// Should not throw
			expect(() => CodePreview.showFileList(files)).not.toThrow();
		});

		it("should handle empty file list", () => {
			expect(() => CodePreview.showFileList([])).not.toThrow();
		});
	});

	describe("showSummary", () => {
		it("should display summary with service", () => {
			expect(() =>
				CodePreview.showSummary({
					service: "TestService",
					path: "./src",
				}),
			).not.toThrow();
		});

		it("should display summary with module", () => {
			expect(() =>
				CodePreview.showSummary({
					module: "TestModule",
					path: "./src",
				}),
			).not.toThrow();
		});

		it("should display summary with tests flag", () => {
			expect(() =>
				CodePreview.showSummary({
					service: "TestService",
					tests: true,
					path: "./src",
				}),
			).not.toThrow();
		});

		it("should handle empty summary", () => {
			expect(() => CodePreview.showSummary({})).not.toThrow();
		});
	});

	describe("show", () => {
		it("should display code preview without errors", async () => {
			const files = [
				{
					path: "test.service.ts",
					content: `export class TestService {
  constructor() {}
  
  execute() {
    return 'test';
  }
}`,
				},
			];

			await expect(CodePreview.show(files)).resolves.not.toThrow();
		});

		it("should handle multiple files", async () => {
			const files = [
				{ path: "test.service.ts", content: "export class TestService {}" },
				{ path: "test.spec.ts", content: "describe('TestService', () => {})" },
			];

			await expect(CodePreview.show(files)).resolves.not.toThrow();
		});

		it("should truncate long files", async () => {
			const longContent = Array(100).fill("console.log('test');").join("\n");
			const files = [{ path: "test.ts", content: longContent }];

			await expect(
				CodePreview.show(files, { maxLines: 10 }),
			).resolves.not.toThrow();
		});
	});
});
