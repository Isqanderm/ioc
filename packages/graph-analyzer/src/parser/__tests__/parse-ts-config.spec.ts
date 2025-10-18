import { ParseTsConfig } from "../parse-ts-config";

describe("ParseTsConfig", () => {
	describe("Basic Functionality", () => {
		it("should parse tsconfig with baseUrl", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			expect(parser.getSrcBasePath()).toBe("/project/src");
		});

		it("should parse tsconfig with paths", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
					paths: {
						"@app/*": ["app/*"],
						"@shared/*": ["shared/*"],
					},
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			expect(parser.getSrcBasePath()).toBe("/project/src");
		});

		it("should handle empty paths", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
					paths: {},
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			expect(parser.getSrcBasePath()).toBe("/project/src");
		});
	});

	describe("Alias Path Resolution", () => {
		it("should resolve alias path correctly", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
					paths: {
						"@app/*": ["app/*"],
					},
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			const resolved = parser.resolveAliasPath("@app/services/user");
			expect(resolved).toBe("app/services/user");
		});

		it("should resolve multiple alias paths", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
					paths: {
						"@app/*": ["app/*"],
						"@shared/*": ["shared/*"],
						"@utils/*": ["utils/*"],
					},
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			
			expect(parser.resolveAliasPath("@app/services")).toBe("app/services");
			expect(parser.resolveAliasPath("@shared/models")).toBe("shared/models");
			expect(parser.resolveAliasPath("@utils/helpers")).toBe("utils/helpers");
		});

		it("should return original path if no alias matches", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
					paths: {
						"@app/*": ["app/*"],
					},
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			const resolved = parser.resolveAliasPath("./relative/path");
			expect(resolved).toBe("./relative/path");
		});

		it("should handle path without alias", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
					paths: {
						"@app/*": ["app/*"],
					},
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			const resolved = parser.resolveAliasPath("services/user");
			expect(resolved).toBe("services/user");
		});

		it("should handle complex alias patterns", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
					paths: {
						"@external/*": ["alias_path_apps/*"],
					},
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			const resolved = parser.resolveAliasPath("@external/article/article.module");
			expect(resolved).toBe("alias_path_apps/article/article.module");
		});
	});

	describe("Edge Cases", () => {
		it("should handle tsconfig without paths", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			// When paths is undefined, resolveAliasPath will throw
			// This is expected behavior based on the current implementation
			expect(() => parser.resolveAliasPath("@app/services")).toThrow();
		});

		it("should handle absolute base path", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "/absolute/path/src",
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			expect(parser.getSrcBasePath()).toContain("src");
		});

		it("should handle nested baseUrl", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src/app",
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			expect(parser.getSrcBasePath()).toBe("/project/src/app");
		});

		it("should handle empty baseUrl", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "",
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			expect(parser.getSrcBasePath()).toBe("/project");
		});

		it("should handle alias with multiple target paths", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
					paths: {
						"@app/*": ["app/*", "fallback/*"],
					},
				},
			});

			const parser = new ParseTsConfig(config, "/project");
			const resolved = parser.resolveAliasPath("@app/services");
			// Should use the first path in the array
			expect(resolved).toBe("app/services");
		});
	});

	describe("getSrcBasePath", () => {
		it("should return correct base path with relative baseUrl", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
				},
			});

			const parser = new ParseTsConfig(config, "/home/user/project");
			expect(parser.getSrcBasePath()).toBe("/home/user/project/src");
		});

		it("should return correct base path with dot baseUrl", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: ".",
				},
			});

			const parser = new ParseTsConfig(config, "/home/user/project");
			expect(parser.getSrcBasePath()).toBe("/home/user/project");
		});

		it("should handle Windows-style paths", () => {
			const config = JSON.stringify({
				compilerOptions: {
					baseUrl: "./src",
				},
			});

			const parser = new ParseTsConfig(config, "C:\\Users\\project");
			// Path resolution should work regardless of OS
			expect(parser.getSrcBasePath()).toContain("src");
		});
	});
});

