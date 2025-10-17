import { describe, expect, it } from "vitest";
import { BootstrapTemplate } from "../../src/templates/bootstrap.template";

describe("BootstrapTemplate", () => {
	describe("generate", () => {
		it("should generate a bootstrap template", () => {
			const template = new BootstrapTemplate();
			const result = template.generate();

			expect(result).toContain(
				'import { NexusApplicationsBrowser } from "@nexus-ioc/core/dist/browser"',
			);
			expect(result).toContain('import { AppModule } from "./apps/app.module"');
			expect(result).toContain("async function bootstrap()");
			expect(result).toContain("NexusApplicationsBrowser");
			expect(result).toContain(".create(AppModule)");
			expect(result).toContain(".bootstrap()");
			expect(result).toContain("bootstrap()");
		});

		it("should generate valid TypeScript code", () => {
			const template = new BootstrapTemplate();
			const result = template.generate();

			// Check for proper function structure
			expect(result).toMatch(/async function bootstrap\(\)/);
			expect(result).toMatch(/bootstrap\(\);/);
		});
	});
});
