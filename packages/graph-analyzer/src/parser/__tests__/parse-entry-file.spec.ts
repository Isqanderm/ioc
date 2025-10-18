import * as fs from "node:fs";
import * as ts from "typescript";
import { ParseEntryFile } from "../parse-entry-file";
import { ParseTsConfig } from "../parse-ts-config";

// Mock fs module
vi.mock("node:fs");

describe("ParseEntryFile", () => {
	let mockTsConfig: ParseTsConfig;

	beforeEach(() => {
		vi.clearAllMocks();
		
		// Create a mock tsconfig
		const config = JSON.stringify({
			compilerOptions: {
				baseUrl: "./src",
				paths: {
					"@app/*": ["app/*"],
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
			"entry.ts",
			code,
			ts.ScriptTarget.Latest,
			true,
		);
	}

	describe("parse method", () => {
		it("should parse entry file with .create() call", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				const container = NsContainer.create(AppModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			const entryModule = parser.parse();

			expect(entryModule).toBe("AppModule");
			expect(parser.name).toBe("AppModule");
		});

		it("should extract module name from create call", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { MainModule } from './main.module';
				
				NsContainer.create(MainModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/main.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			const entryModule = parser.parse();

			expect(entryModule).toBe("MainModule");
		});

		it("should throw error when no entry module found", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				const container = new NsContainer();
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			
			expect(() => parser.parse()).toThrow("No entry module");
		});

		it("should find imports for the entry module", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				const container = NsContainer.create(AppModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.imports).toBeDefined();
			expect(Array.isArray(parser.imports)).toBe(true);
		});
	});

	describe("Getters", () => {
		it("should return file path", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				NsContainer.create(AppModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			
			expect(parser.filePath).toBe(currentFilePath);
		});

		it("should return null name before parsing", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				NsContainer.create(AppModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			
			expect(parser.name).toBeNull();
		});

		it("should return empty imports before parsing", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				NsContainer.create(AppModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			
			expect(parser.imports).toEqual([]);
		});

		it("should return name after parsing", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				NsContainer.create(AppModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();
			
			expect(parser.name).toBe("AppModule");
		});
	});

	describe("Different Module Names", () => {
		it("should handle RootModule", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { RootModule } from './root.module';
				
				NsContainer.create(RootModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			const entryModule = parser.parse();

			expect(entryModule).toBe("RootModule");
		});

		it("should handle CoreModule", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { CoreModule } from './core.module';
				
				NsContainer.create(CoreModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			const entryModule = parser.parse();

			expect(entryModule).toBe("CoreModule");
		});

		it("should handle module names with numbers", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModuleV2 } from './app.module.v2';
				
				NsContainer.create(AppModuleV2);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			const entryModule = parser.parse();

			expect(entryModule).toBe("AppModuleV2");
		});
	});

	describe("Different Code Styles", () => {
		it("should handle create call with variable assignment", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				const app = NsContainer.create(AppModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			const entryModule = parser.parse();

			expect(entryModule).toBe("AppModule");
		});

		it("should handle create call without variable", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				NsContainer.create(AppModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			const entryModule = parser.parse();

			expect(entryModule).toBe("AppModule");
		});

		it("should handle create call with await", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				
				const app = await NsContainer.create(AppModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			const entryModule = parser.parse();

			expect(entryModule).toBe("AppModule");
		});
	});

	describe("Edge Cases", () => {
		it("should handle multiple create calls and use the last one", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
				import { TestModule } from './test.module';

				NsContainer.create(AppModule);
				NsContainer.create(TestModule);
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			const entryModule = parser.parse();

			// The loop overwrites entryModule, so it uses the last create call
			expect(entryModule).toBe("TestModule");
		});

		it("should handle empty file", () => {
			const code = "";
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			
			expect(() => parser.parse()).toThrow("No entry module");
		});

		it("should handle file with only imports", () => {
			const code = `
				import { NsContainer } from 'nexus-ioc';
				import { AppModule } from './app.module';
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/entry.ts";

			const parser = new ParseEntryFile(sourceFile, currentFilePath, mockTsConfig);
			
			expect(() => parser.parse()).toThrow("No entry module");
		});
	});
});

