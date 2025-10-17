import { describe, expect, it } from "vitest";
import { ServiceSpecTemplate } from "../../src/templates/service-spec.template";

describe("ServiceSpecTemplate", () => {
	describe("generate", () => {
		it("should generate a service spec template with the given name", () => {
			const template = new ServiceSpecTemplate({ name: "Auth" });
			const result = template.generate();

			expect(result).toContain('import { Test } from "@nexus-ioc/testing"');
			expect(result).toContain('import { AuthService } from "./auth.service"');
			expect(result).toContain("describe('AuthService'");
			expect(result).toContain("it('should get service instance'");
			expect(result).toContain("Test.createModule({");
			expect(result).toContain("providers: [AuthService]");
			expect(result).toContain(
				"const authService = await moduleRef.get<AuthService>(AuthService)",
			);
			expect(result).toContain(
				"expect(authService).toBeInstanceOf(AuthService)",
			);
		});

		it("should generate a service spec template with different names", () => {
			const template1 = new ServiceSpecTemplate({ name: "User" });
			const result1 = template1.generate();
			expect(result1).toContain('import { UserService } from "./user.service"');
			expect(result1).toContain("describe('UserService'");
			expect(result1).toContain(
				"const userService = await moduleRef.get<UserService>(UserService)",
			);

			const template2 = new ServiceSpecTemplate({ name: "Product" });
			const result2 = template2.generate();
			expect(result2).toContain(
				'import { ProductService } from "./product.service"',
			);
			expect(result2).toContain("describe('ProductService'");
			expect(result2).toContain(
				"const productService = await moduleRef.get<ProductService>(ProductService)",
			);
		});

		it("should handle lowercase conversion correctly", () => {
			const template = new ServiceSpecTemplate({ name: "MyCustomService" });
			const result = template.generate();

			expect(result).toContain(
				'import { MyCustomServiceService } from "./mycustomservice.service"',
			);
			expect(result).toContain("const mycustomserviceService =");
		});

		it("should accept custom template parameter", () => {
			const customTemplate = "custom template";
			const template = new ServiceSpecTemplate(
				{ name: "Test" },
				customTemplate,
			);
			const result = template.generate();

			expect(result).toContain("describe('TestService'");
		});
	});
});
