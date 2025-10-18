import * as fs from "node:fs";
import * as ts from "typescript";
import { ParseNsModule } from "../parse-ns-module";
import { ParseTsConfig } from "../parse-ts-config";

// Mock fs module
vi.mock("node:fs");

describe("ParseNsModule", () => {
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
			"test.module.ts",
			code,
			ts.ScriptTarget.Latest,
			true,
		);
	}

	describe("Basic Module Parsing", () => {
		it("should parse simple NsModule", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				
				@NsModule({
					imports: [],
					providers: [],
					exports: []
				})
				export class AppModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.name).toBe("AppModule");
			expect(parser.imports).toEqual([]);
			expect(parser.providers).toEqual([]);
			expect(parser.exports).toEqual([]);
		});

		it("should parse module with imports", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				import { UserModule } from './user/user.module';
				
				@NsModule({
					imports: [UserModule],
					providers: [],
					exports: []
				})
				export class AppModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.name).toBe("AppModule");
			expect(parser.imports).toEqual(["UserModule"]);
		});

		it("should parse module with providers", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				
				@NsModule({
					imports: [],
					providers: [UserService, DatabaseService],
					exports: []
				})
				export class AppModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.name).toBe("AppModule");
			expect(parser.providers).toHaveLength(2);
			expect(parser.providers[0].token).toBe("UserService");
			expect(parser.providers[1].token).toBe("DatabaseService");
		});

		it("should parse module with exports", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				
				@NsModule({
					imports: [],
					providers: [UserService],
					exports: [UserService]
				})
				export class UserModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/user.module.ts";

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.name).toBe("UserModule");
			expect(parser.exports).toEqual(["UserService"]);
		});
	});

	describe("Global Decorator", () => {
		it("should detect Global decorator", () => {
			const code = `
				import { NsModule, Global } from 'nexus-ioc';
				
				@Global()
				@NsModule({
					imports: [],
					providers: [ConfigService],
					exports: [ConfigService]
				})
				export class ConfigModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/config.module.ts";

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.name).toBe("ConfigModule");
			expect(parser.isGlobal).toBe(true);
		});

		it("should return false for non-global module", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				
				@NsModule({
					imports: [],
					providers: [],
					exports: []
				})
				export class AppModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.isGlobal).toBe(false);
		});
	});

	describe("Complex Module Scenarios", () => {
		it("should parse module with multiple imports", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				import { UserModule } from './user/user.module';
				import { PostModule } from './post/post.module';
				import { CommentModule } from './comment/comment.module';
				
				@NsModule({
					imports: [UserModule, PostModule, CommentModule],
					providers: [],
					exports: []
				})
				export class AppModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.imports).toHaveLength(3);
			expect(parser.imports).toEqual(["UserModule", "PostModule", "CommentModule"]);
		});

		it("should parse module with mixed provider types", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				
				@NsModule({
					imports: [],
					providers: [
						UserService,
						{ provide: "CONFIG", useValue: "production" },
						{ provide: "LOGGER", useFactory: () => new Logger() }
					],
					exports: []
				})
				export class AppModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.providers).toHaveLength(3);
			expect(parser.providers[0].type).toBe("Class");
			expect(parser.providers[1].type).toBe("UseValue");
			expect(parser.providers[2].type).toBe("UseFactory");
		});

		it("should parse module with both imports and exports", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				import { DatabaseModule } from './database/database.module';
				
				@NsModule({
					imports: [DatabaseModule],
					providers: [UserService],
					exports: [UserService, DatabaseModule]
				})
				export class UserModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/user.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.imports).toEqual(["DatabaseModule"]);
			expect(parser.exports).toEqual(["UserService", "DatabaseModule"]);
		});
	});

	describe("Getters", () => {
		it("should return file path", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				
				@NsModule({
					imports: [],
					providers: [],
					exports: []
				})
				export class AppModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			
			expect(parser.filePath).toBe(currentFilePath);
		});

		it("should return modules map", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				
				@NsModule({
					imports: [],
					providers: [UserService],
					exports: []
				})
				export class AppModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.modules).toBeInstanceOf(Map);
			expect(parser.modules.has("AppModule")).toBe(true);
		});

		it("should return deps array", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				import { UserModule } from './user/user.module';
				
				@NsModule({
					imports: [UserModule],
					providers: [],
					exports: []
				})
				export class AppModule {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			vi.mocked(fs.existsSync).mockReturnValue(true);

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			parser.parse();

			expect(parser.deps).toBeDefined();
			expect(Array.isArray(parser.deps)).toBe(true);
		});
	});

	describe("Error Handling", () => {
		it("should throw error for module without name", () => {
			const code = `
				import { NsModule } from 'nexus-ioc';
				
				@NsModule({
					imports: [],
					providers: [],
					exports: []
				})
				export class {}
			`;
			const sourceFile = createSourceFile(code);
			const currentFilePath = "/project/src/app.module.ts";

			const parser = new ParseNsModule(sourceFile, currentFilePath, mockTsConfig);
			
			expect(() => parser.parse()).toThrow("Module name can`t be empty");
		});
	});
});

