import { describe, expect, it } from "vitest";
import { ServiceTemplate } from "../../src/templates/service.template";

describe("ServiceTemplate", () => {
	describe("generate", () => {
		it("should generate a service template with the given name", () => {
			const template = new ServiceTemplate({ name: "Auth" });
			const result = template.generate();

			expect(result).toContain("@Injectable()");
			expect(result).toContain("export class AuthService");
			expect(result).toContain('import { Injectable } from "@nexus-ioc/core"');
		});

		it("should generate a service template with different names", () => {
			const template1 = new ServiceTemplate({ name: "User" });
			const result1 = template1.generate();
			expect(result1).toContain("export class UserService");

			const template2 = new ServiceTemplate({ name: "Product" });
			const result2 = template2.generate();
			expect(result2).toContain("export class ProductService");
		});

		it("should accept custom template parameter", () => {
			const customTemplate = "custom template";
			const template = new ServiceTemplate({ name: "Test" }, customTemplate);
			const result = template.generate();

			expect(result).toContain("export class TestService");
		});
	});
});
