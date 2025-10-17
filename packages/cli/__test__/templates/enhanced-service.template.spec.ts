import { describe, expect, it } from "vitest";
import { EnhancedServiceTemplate } from "../../src/templates/enhanced-service.template";

describe("EnhancedServiceTemplate", () => {
	describe("generate", () => {
		it("should generate basic service without dependencies", () => {
			const template = new EnhancedServiceTemplate({
				name: "Auth",
			});

			const result = template.generate();

			expect(result).toContain("@Injectable()");
			expect(result).toContain("export class AuthService");
			expect(result).toContain('import { Injectable } from "@nexus-ioc/core"');
			expect(result).not.toContain("constructor");
		});

		it("should generate service with singleton scope", () => {
			const template = new EnhancedServiceTemplate({
				name: "Auth",
				scope: "Singleton",
			});

			const result = template.generate();

			expect(result).toContain("@Injectable({ scope: Scope.SINGLETON })");
			expect(result).toContain("import { Injectable, Scope }");
		});

		it("should generate service with transient scope (default)", () => {
			const template = new EnhancedServiceTemplate({
				name: "Auth",
				scope: "Transient",
			});

			const result = template.generate();

			expect(result).toContain("@Injectable()");
			expect(result).not.toContain("Scope");
		});

		it("should generate service with single dependency", () => {
			const template = new EnhancedServiceTemplate({
				name: "User",
				dependencies: [
					{
						className: "AuthService",
						importPath: "./auth.service",
						paramName: "auth",
					},
				],
			});

			const result = template.generate();

			expect(result).toContain('import { AuthService } from "./auth.service"');
			expect(result).toContain("constructor(");
			expect(result).toContain("private readonly auth: AuthService");
		});

		it("should generate service with multiple dependencies", () => {
			const template = new EnhancedServiceTemplate({
				name: "User",
				dependencies: [
					{
						className: "AuthService",
						importPath: "./auth.service",
						paramName: "auth",
					},
					{
						className: "DatabaseService",
						importPath: "../database/database.service",
						paramName: "database",
					},
				],
			});

			const result = template.generate();

			expect(result).toContain('import { AuthService } from "./auth.service"');
			expect(result).toContain(
				'import { DatabaseService } from "../database/database.service"',
			);
			expect(result).toContain("private readonly auth: AuthService");
			expect(result).toContain("private readonly database: DatabaseService");
		});

		it("should generate service with dependencies and singleton scope", () => {
			const template = new EnhancedServiceTemplate({
				name: "Cache",
				scope: "Singleton",
				dependencies: [
					{
						className: "ConfigService",
						importPath: "./config.service",
						paramName: "config",
					},
				],
			});

			const result = template.generate();

			expect(result).toContain("@Injectable({ scope: Scope.SINGLETON })");
			expect(result).toContain(
				'import { Injectable, Scope } from "@nexus-ioc/core"',
			);
			expect(result).toContain(
				'import { ConfigService } from "./config.service"',
			);
			expect(result).toContain("private readonly config: ConfigService");
		});

		it("should format constructor parameters correctly", () => {
			const template = new EnhancedServiceTemplate({
				name: "Test",
				dependencies: [
					{
						className: "ServiceA",
						importPath: "./a.service",
						paramName: "serviceA",
					},
					{
						className: "ServiceB",
						importPath: "./b.service",
						paramName: "serviceB",
					},
				],
			});

			const result = template.generate();

			// Check that constructor is properly formatted
			expect(result).toContain("constructor(");
			expect(result).toContain("private readonly serviceA: ServiceA");
			expect(result).toContain("private readonly serviceB: ServiceB");
			expect(result).toContain(") {}");
		});

		it("should handle empty dependencies array", () => {
			const template = new EnhancedServiceTemplate({
				name: "Empty",
				dependencies: [],
			});

			const result = template.generate();

			expect(result).toContain("@Injectable()");
			expect(result).toContain("export class EmptyService");
			expect(result).not.toContain("constructor");
		});

		it("should generate valid TypeScript code", () => {
			const template = new EnhancedServiceTemplate({
				name: "Complete",
				scope: "Singleton",
				dependencies: [
					{
						className: "DepA",
						importPath: "./dep-a",
						paramName: "depA",
					},
					{
						className: "DepB",
						importPath: "./dep-b",
						paramName: "depB",
					},
				],
			});

			const result = template.generate();

			// Basic syntax checks
			expect(result).toContain("import {");
			expect(result).toContain("} from");
			expect(result).toContain("@Injectable");
			expect(result).toContain("export class");
			expect(result).toContain("Service {");

			// Should not have syntax errors
			expect(result).not.toContain("undefined");
			expect(result).not.toContain("null");
		});
	});
});
