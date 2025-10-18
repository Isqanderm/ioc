import { beforeEach, describe, expect, it } from "vitest";
import { DependencyResolver } from "../../src/tui/utils/dependency-resolver";
import type { ServiceInfo } from "../../src/tui/utils/project-scanner";

describe("DependencyResolver", () => {
	let resolver: DependencyResolver;
	const baseDir = "/test/project";

	beforeEach(() => {
		resolver = new DependencyResolver(baseDir);
	});

	describe("createDependencyOptions", () => {
		it("should convert services to dependency options", () => {
			const services: ServiceInfo[] = [
				{
					name: "auth",
					className: "AuthService",
					filePath: "/test/project/src/auth.service.ts",
					relativePath: "src/auth.service.ts",
				},
				{
					name: "user",
					className: "UserService",
					filePath: "/test/project/src/user.service.ts",
					relativePath: "src/user.service.ts",
				},
			];

			const options = resolver.createDependencyOptions(
				services,
				"/test/project/src/test.service.ts",
			);

			expect(options).toHaveLength(2);
			expect(options[0].value).toBe("AuthService");
			expect(options[0].label).toBe("AuthService");
			expect(options[0].hint).toBe("src/auth.service.ts");
		});

		it("should exclude current service from options", () => {
			const services: ServiceInfo[] = [
				{
					name: "auth",
					className: "AuthService",
					filePath: "/test/project/src/auth.service.ts",
					relativePath: "src/auth.service.ts",
				},
				{
					name: "user",
					className: "UserService",
					filePath: "/test/project/src/user.service.ts",
					relativePath: "src/user.service.ts",
				},
			];

			const options = resolver.createDependencyOptions(
				services,
				"/test/project/src/auth.service.ts",
			);

			expect(options).toHaveLength(1);
			expect(options[0].value).toBe("UserService");
		});
	});

	describe("resolveDependencies", () => {
		it("should resolve dependencies with correct import paths", () => {
			const selectedOptions = [
				{
					value: "AuthService",
					label: "AuthService",
					hint: "src/auth.service.ts",
					service: {
						name: "auth",
						className: "AuthService",
						filePath: "/test/project/src/auth.service.ts",
						relativePath: "src/auth.service.ts",
					},
				},
			];

			const dependencies = resolver.resolveDependencies(
				selectedOptions,
				"/test/project/src/user.service.ts",
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0].className).toBe("AuthService");
			expect(dependencies[0].importPath).toBe("./auth.service");
			expect(dependencies[0].paramName).toBe("auth");
		});

		it("should generate correct parameter names", () => {
			const selectedOptions = [
				{
					value: "UserRepository",
					label: "UserRepository",
					hint: "src/user.repository.ts",
					service: {
						name: "user",
						className: "UserRepository",
						filePath: "/test/project/src/user.repository.ts",
						relativePath: "src/user.repository.ts",
					},
				},
			];

			const dependencies = resolver.resolveDependencies(
				selectedOptions,
				"/test/project/src/user.service.ts",
			);

			expect(dependencies[0].paramName).toBe("userRepository");
		});

		it("should handle nested directory imports", () => {
			const selectedOptions = [
				{
					value: "AuthService",
					label: "AuthService",
					hint: "src/modules/auth/auth.service.ts",
					service: {
						name: "auth",
						className: "AuthService",
						filePath: "/test/project/src/modules/auth/auth.service.ts",
						relativePath: "src/modules/auth/auth.service.ts",
					},
				},
			];

			const dependencies = resolver.resolveDependencies(
				selectedOptions,
				"/test/project/src/modules/user/user.service.ts",
			);

			expect(dependencies[0].importPath).toBe("../auth/auth.service");
		});
	});

	describe("checkNamingConflicts", () => {
		it("should detect naming conflicts", () => {
			const existingServices: ServiceInfo[] = [
				{
					name: "auth",
					className: "AuthService",
					filePath: "/test/project/src/auth.service.ts",
					relativePath: "src/auth.service.ts",
				},
			];

			const conflict = resolver.checkNamingConflicts(
				"AuthService",
				existingServices,
			);

			expect(conflict).toBeTruthy();
			expect(conflict).toContain("AuthService");
		});

		it("should return null when no conflicts", () => {
			const existingServices: ServiceInfo[] = [
				{
					name: "auth",
					className: "AuthService",
					filePath: "/test/project/src/auth.service.ts",
					relativePath: "src/auth.service.ts",
				},
			];

			const conflict = resolver.checkNamingConflicts(
				"UserService",
				existingServices,
			);

			expect(conflict).toBeNull();
		});

		it("should be case-insensitive", () => {
			const existingServices: ServiceInfo[] = [
				{
					name: "auth",
					className: "AuthService",
					filePath: "/test/project/src/auth.service.ts",
					relativePath: "src/auth.service.ts",
				},
			];

			const conflict = resolver.checkNamingConflicts(
				"authservice",
				existingServices,
			);

			expect(conflict).toBeTruthy();
		});
	});

	describe("suggestDependencies", () => {
		it("should suggest related services", () => {
			const availableServices: ServiceInfo[] = [
				{
					name: "user",
					className: "UserService",
					filePath: "/test/project/src/user.service.ts",
					relativePath: "src/user.service.ts",
				},
				{
					name: "user-repository",
					className: "UserRepository",
					filePath: "/test/project/src/user.repository.ts",
					relativePath: "src/user.repository.ts",
				},
				{
					name: "auth",
					className: "AuthService",
					filePath: "/test/project/src/auth.service.ts",
					relativePath: "src/auth.service.ts",
				},
			];

			const suggestions = resolver.suggestDependencies(
				"UserController",
				availableServices,
			);

			expect(suggestions.length).toBeGreaterThan(0);
			expect(suggestions.some((s) => s.className === "UserService")).toBe(true);
		});

		it("should not suggest the service itself", () => {
			const availableServices: ServiceInfo[] = [
				{
					name: "user",
					className: "UserService",
					filePath: "/test/project/src/user.service.ts",
					relativePath: "src/user.service.ts",
				},
			];

			const suggestions = resolver.suggestDependencies(
				"UserService",
				availableServices,
			);

			expect(suggestions).toHaveLength(0);
		});
	});

	describe("detectCircularDependency", () => {
		it("should warn about too many dependencies", () => {
			const dependencies = Array.from({ length: 6 }, (_, i) => ({
				className: `Service${i}`,
				importPath: `./service${i}`,
				paramName: `service${i}`,
			}));

			const warnings = resolver.detectCircularDependency(
				"TestService",
				dependencies,
				[],
			);

			expect(warnings.length).toBeGreaterThan(0);
			expect(warnings[0]).toContain("6 dependencies");
		});

		it("should not warn for reasonable number of dependencies", () => {
			const dependencies = Array.from({ length: 3 }, (_, i) => ({
				className: `Service${i}`,
				importPath: `./service${i}`,
				paramName: `service${i}`,
			}));

			const warnings = resolver.detectCircularDependency(
				"TestService",
				dependencies,
				[],
			);

			expect(warnings).toHaveLength(0);
		});
	});
});
