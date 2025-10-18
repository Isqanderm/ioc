import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { ParseImports } from "../parse-imports";
import { ParseTsConfig } from "../parse-ts-config";

// Mock fs module
vi.mock("node:fs");

describe("ParseImports", () => {
	let mockTsConfig: ParseTsConfig;

	beforeEach(() => {
		vi.clearAllMocks();
		
		// Create a mock tsconfig
		const config = JSON.stringify({
			compilerOptions: {
				baseUrl: "./src",
				paths: {
					"@app/*": ["app/*"],
					"@shared/*": ["shared/*"],
				},
			},
		});
		mockTsConfig = new ParseTsConfig(config, "/project");
	});

	/**
	 * Helper function to create a source file from TypeScript code
	 */
	function createSourceFile(code: string): ts.SourceFile {
		return ts.createSourceFile(
			"test.ts",
			code,
			ts.ScriptTarget.Latest,
			true,
		);
	}

	describe("findAllNsModuleImports", () => {
		it("should find single module import", () => {
			const code = `
				import { UserModule } from './user/user.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			// Mock fs.existsSync to return true for the expected path
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["UserModule"]);

			expect(imports).toHaveLength(1);
			expect(imports[0]).toContain("user.module");
		});

		it("should find multiple module imports", () => {
			const code = `
				import { UserModule } from './user/user.module';
				import { PostModule } from './post/post.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["UserModule", "PostModule"]);

			expect(imports).toHaveLength(2);
		});

		it("should throw error when module import not found", () => {
			const code = `
				import { SomeOtherModule } from './other.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			
			expect(() => {
				parser.findAllNsModuleImports(["UserModule"]);
			}).toThrow('"UserModule" module import not found');
		});

		it("should handle relative imports with .ts extension", () => {
			const code = `
				import { UserModule } from './user/user.module.ts';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["UserModule"]);

			expect(imports).toHaveLength(1);
		});

		it("should handle relative imports without extension", () => {
			const code = `
				import { UserModule } from './user/user.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockImplementation((path) => {
				return path.toString().endsWith(".ts");
			});

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["UserModule"]);

			expect(imports).toHaveLength(1);
		});

		it("should handle index file imports", () => {
			const code = `
				import { UserModule } from './user';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockImplementation((path) => {
				return path.toString().includes("index.ts");
			});

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["UserModule"]);

			expect(imports).toHaveLength(1);
			expect(imports[0]).toContain("index.ts");
		});

		it("should handle alias path imports", () => {
			const code = `
				import { UserModule } from '@app/user/user.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["UserModule"]);

			expect(imports).toHaveLength(1);
		});

		it("should resolve alias paths correctly", () => {
			const code = `
				import { SharedModule } from '@shared/shared.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["SharedModule"]);

			expect(imports).toHaveLength(1);
		});
	});

	describe("checkExtension", () => {
		it("should find .ts files", () => {
			const code = `
				import { UserModule } from './user.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockImplementation((path) => {
				return path.toString().endsWith(".ts");
			});

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["UserModule"]);

			expect(imports).toHaveLength(1);
		});

		it("should find .tsx files", () => {
			const code = `
				import { Component } from './component';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.tsx";

			vi.mocked(fs.existsSync).mockImplementation((path) => {
				return path.toString().endsWith(".tsx");
			});

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["Component"]);

			expect(imports).toHaveLength(1);
		});

		it("should prefer direct file over index file", () => {
			const code = `
				import { UserModule } from './user';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			let callCount = 0;
			vi.mocked(fs.existsSync).mockImplementation((path) => {
				callCount++;
				// First call should be for user.ts (direct file)
				if (callCount === 1) {
					return true;
				}
				return false;
			});

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["UserModule"]);

			expect(imports).toHaveLength(1);
			expect(imports[0]).toContain("user.ts");
		});
	});

	describe("Error Handling", () => {
		it("should throw error for non-import declaration", () => {
			const code = `
				const UserModule = require('./user.module');
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			
			expect(() => {
				parser.findAllNsModuleImports(["UserModule"]);
			}).toThrow();
		});

		it("should handle empty module dependencies", () => {
			const code = `
				import { UserModule } from './user.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports([]);

			expect(imports).toHaveLength(0);
		});
	});

	describe("parse method", () => {
		it("should have a parse method", () => {
			const code = `import { UserModule } from './user.module';`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			
			expect(parser.parse).toBeDefined();
			expect(typeof parser.parse).toBe("function");
		});

		it("should execute parse method without errors", () => {
			const code = `import { UserModule } from './user.module';`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			
			expect(() => parser.parse()).not.toThrow();
		});
	});

	describe("Complex Import Scenarios", () => {
		it("should handle nested directory imports", () => {
			const code = `
				import { UserModule } from './modules/user/user.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["UserModule"]);

			expect(imports).toHaveLength(1);
			expect(imports[0]).toContain("modules/user/user.module");
		});

		it("should handle parent directory imports", () => {
			const code = `
				import { SharedModule } from '../shared/shared.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/modules/user/user.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseImports(sourceFile, currentFilePath, mockTsConfig);
			const imports = parser.findAllNsModuleImports(["SharedModule"]);

			expect(imports).toHaveLength(1);
		});
	});
});

