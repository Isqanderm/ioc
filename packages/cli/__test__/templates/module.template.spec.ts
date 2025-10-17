import { describe, expect, it } from "vitest";
import { ModuleTemplate } from "../../src/templates/module.template";

describe("ModuleTemplate", () => {
	describe("generate", () => {
		it("should generate a module template with the given name", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			const result = template.generate();

			expect(result).toContain("@NsModule({");
			expect(result).toContain("export class AuthModule");
			expect(result).toContain("imports: []");
			expect(result).toContain("providers: []");
			expect(result).toContain("exports: []");
		});

		it("should generate a module template with different names", () => {
			const template1 = new ModuleTemplate({ name: "User" });
			const result1 = template1.generate();
			expect(result1).toContain("export class UserModule");

			const template2 = new ModuleTemplate({ name: "Product" });
			const result2 = template2.generate();
			expect(result2).toContain("export class ProductModule");
		});
	});

	describe("addImport", () => {
		it("should add a single import", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addImport("DatabaseModule");
			const result = template.generate();

			expect(result).toContain("imports: [DatabaseModule]");
		});

		it("should add multiple imports as array", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addImport(["DatabaseModule", "ConfigModule"]);
			const result = template.generate();

			expect(result).toContain("imports: [DatabaseModule,ConfigModule]");
		});

		it("should add multiple imports via multiple calls", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addImport("DatabaseModule");
			template.addImport("ConfigModule");
			const result = template.generate();

			expect(result).toContain("imports: [DatabaseModule,ConfigModule]");
		});
	});

	describe("addProvider", () => {
		it("should add a single provider", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addProvider("AuthService");
			const result = template.generate();

			expect(result).toContain("providers: [AuthService]");
		});

		it("should add multiple providers as array", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addProvider(["AuthService", "UserService"]);
			const result = template.generate();

			expect(result).toContain("providers: [AuthService,UserService]");
		});

		it("should add multiple providers via multiple calls", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addProvider("AuthService");
			template.addProvider("UserService");
			const result = template.generate();

			expect(result).toContain("providers: [AuthService,UserService]");
		});
	});

	describe("addExport", () => {
		it("should add a single export", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addExport("AuthService");
			const result = template.generate();

			expect(result).toContain("exports: [AuthService]");
		});

		it("should add multiple exports as array", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addExport(["AuthService", "UserService"]);
			const result = template.generate();

			expect(result).toContain("exports: [AuthService,UserService]");
		});

		it("should add multiple exports via multiple calls", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addExport("AuthService");
			template.addExport("UserService");
			const result = template.generate();

			expect(result).toContain("exports: [AuthService,UserService]");
		});
	});

	describe("parse existing template", () => {
		it("should parse imports from existing template", () => {
			const existingTemplate = `
        @NsModule({
          imports: [DatabaseModule, ConfigModule],
          providers: [],
          exports: [],
        })
        export class AuthModule {}
      `;
			const template = new ModuleTemplate({ name: "Auth" }, existingTemplate);
			const result = template.generate();

			expect(result).toContain("imports: [DatabaseModule, ConfigModule]");
		});

		it("should parse providers from existing template", () => {
			const existingTemplate = `
        @NsModule({
          imports: [],
          providers: [AuthService, UserService],
          exports: [],
        })
        export class AuthModule {}
      `;
			const template = new ModuleTemplate({ name: "Auth" }, existingTemplate);
			const result = template.generate();

			expect(result).toContain("providers: [AuthService, UserService]");
		});

		it("should parse exports from existing template", () => {
			const existingTemplate = `
        @NsModule({
          imports: [],
          providers: [],
          exports: [AuthService],
        })
        export class AuthModule {}
      `;
			const template = new ModuleTemplate({ name: "Auth" }, existingTemplate);
			const result = template.generate();

			expect(result).toContain("exports: [AuthService]");
		});

		it("should parse and add new items to existing template", () => {
			const existingTemplate = `
        @NsModule({
          imports: [DatabaseModule],
          providers: [AuthService],
          exports: [AuthService],
        })
        export class AuthModule {}
      `;
			const template = new ModuleTemplate({ name: "Auth" }, existingTemplate);
			template.addImport("ConfigModule");
			template.addProvider("UserService");
			template.addExport("UserService");
			const result = template.generate();

			expect(result).toContain("imports: [DatabaseModule,ConfigModule]");
			expect(result).toContain("providers: [AuthService,UserService]");
			expect(result).toContain("exports: [AuthService,UserService]");
		});

		it("should handle templates with trailing commas", () => {
			const existingTemplate = `
        @NsModule({
          imports: [DatabaseModule,],
          providers: [AuthService,],
          exports: [AuthService,],
        })
        export class AuthModule {}
      `;
			const template = new ModuleTemplate({ name: "Auth" }, existingTemplate);
			const result = template.generate();

			expect(result).toContain("imports: [DatabaseModule]");
			expect(result).toContain("providers: [AuthService]");
			expect(result).toContain("exports: [AuthService]");
		});
	});

	describe("combined operations", () => {
		it("should handle all operations together", () => {
			const template = new ModuleTemplate({ name: "Auth" });
			template.addImport(["DatabaseModule", "ConfigModule"]);
			template.addProvider("AuthService");
			template.addProvider(["UserService", "TokenService"]);
			template.addExport("AuthService");
			const result = template.generate();

			expect(result).toContain("@NsModule({");
			expect(result).toContain("export class AuthModule");
			expect(result).toContain("imports: [DatabaseModule,ConfigModule]");
			expect(result).toContain(
				"providers: [AuthService,UserService,TokenService]",
			);
			expect(result).toContain("exports: [AuthService]");
		});
	});
});
