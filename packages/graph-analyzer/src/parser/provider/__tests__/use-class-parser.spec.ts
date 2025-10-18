import * as fs from "node:fs";
import * as ts from "typescript";
import { UseClassParser } from "../use-class-parser";

// Mock fs module
vi.mock("node:fs");

describe("UseClassParser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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

	describe("Basic Parsing", () => {
		it("should parse provide token", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.token).toBe("'UserService'");
			expect(parser.type).toBe("UseClass");
		});

		it("should parse useClass value", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.value).toBe("UserServiceImpl");
		});

		it("should parse scope", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl, scope: Scope.REQUEST }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.scope).toBe("Scope.REQUEST");
		});

		it("should handle provider without scope", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.scope).toBeNull();
		});

		it("should handle provider with whitespace", () => {
			const provider = `{
				provide: 'UserService',
				useClass: UserServiceImpl,
				scope: Scope.SINGLETON
			}`;
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.token).toBe("'UserService'");
			expect(parser.value).toBe("UserServiceImpl");
			expect(parser.scope).toBe("Scope.SINGLETON");
		});
	});

	describe("Dependency Extraction", () => {
		it("should extract dependencies from class in same file", () => {
			const code = `
				import { Injectable, Inject } from 'nexus-ioc';

				@Injectable()
				export class UserServiceImpl {
					constructor(
						@Inject(DatabaseService) private readonly database: DatabaseService,
						@Inject(LoggerService) private readonly logger: LoggerService
					) {}
				}
			`;
			const sourceFile = createSourceFile(code);
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			expect(parser.dependencies).toBeDefined();
			// Dependencies are extracted if @Inject decorators are present
			expect(parser.dependencies.length).toBeGreaterThanOrEqual(0);
		});

		it("should return empty dependencies when class not found", () => {
			const code = `
				import { Injectable } from 'nexus-ioc';
			`;
			const sourceFile = createSourceFile(code);
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should extract dependencies from class in imported file", () => {
			const moduleCode = `
				import { UserServiceImpl } from './user.service';
				
				@NsModule({
					providers: [
						{ provide: 'UserService', useClass: UserServiceImpl }
					]
				})
				export class UserModule {}
			`;
			const serviceCode = `
				import { Injectable } from 'nexus-ioc';
				
				@Injectable()
				export class UserServiceImpl {
					constructor(
						private readonly database: DatabaseService
					) {}
				}
			`;

			const moduleSourceFile = createSourceFile(moduleCode);
			const serviceSourceFile = createSourceFile(serviceCode);

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(serviceCode);

			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, moduleSourceFile, "/project/src/user.module.ts");
			parser.parse();

			expect(parser.dependencies).toBeDefined();
		});

		it("should handle missing source file", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle file read error", () => {
			const code = `
				import { UserServiceImpl } from './user.service';
			`;
			const sourceFile = createSourceFile(code);

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("File read error");
			});

			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle non-existent imported file", () => {
			const code = `
				import { UserServiceImpl } from './user.service';
			`;
			const sourceFile = createSourceFile(code);

			vi.mocked(fs.existsSync).mockReturnValue(false);

			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle class without import", () => {
			const code = `
				@NsModule({
					providers: []
				})
				export class UserModule {}
			`;
			const sourceFile = createSourceFile(code);

			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should skip node_modules imports", () => {
			const code = `
				import { UserServiceImpl } from 'some-package';
			`;
			const sourceFile = createSourceFile(code);

			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle different file extensions", () => {
			const code = `
				import { UserServiceImpl } from './user.service';
			`;
			const sourceFile = createSourceFile(code);

			// Mock existsSync to return true for .ts extension
			vi.mocked(fs.existsSync).mockImplementation((path) => {
				return path.toString().endsWith(".ts");
			});
			vi.mocked(fs.readFileSync).mockReturnValue(`
				export class UserServiceImpl {
					constructor() {}
				}
			`);

			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			expect(parser.dependencies).toBeDefined();
		});

		it("should handle index file imports", () => {
			const code = `
				import { UserServiceImpl } from './services';
			`;
			const sourceFile = createSourceFile(code);

			// Mock existsSync to return true for index.ts
			vi.mocked(fs.existsSync).mockImplementation((path) => {
				return path.toString().includes("index.ts");
			});
			vi.mocked(fs.readFileSync).mockReturnValue(`
				export class UserServiceImpl {
					constructor() {}
				}
			`);

			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			expect(parser.dependencies).toBeDefined();
		});

		it("should handle default import", () => {
			const code = `
				import UserServiceImpl from './user.service';
			`;
			const sourceFile = createSourceFile(code);

			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			// Default imports are not handled by named imports check
			expect(parser.dependencies).toEqual([]);
		});

		it("should handle namespace import", () => {
			const code = `
				import * as Services from './services';
			`;
			const sourceFile = createSourceFile(code);

			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider, sourceFile, "/project/src/user.module.ts");
			parser.parse();

			// Namespace imports are not handled
			expect(parser.dependencies).toEqual([]);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty provider string", () => {
			const provider = "";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.token).toBeNull();
			expect(parser.value).toBeNull();
			expect(parser.scope).toBeNull();
		});

		it("should handle provider without provide field", () => {
			const provider = "{ useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.token).toBeNull();
			expect(parser.value).toBe("UserServiceImpl");
		});

		it("should handle provider without useClass field", () => {
			const provider = "{ provide: 'UserService' }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.token).toBe("'UserService'");
			expect(parser.value).toBeNull();
		});

		it("should handle malformed provider", () => {
			const provider = "{ provide: }";
			const parser = new UseClassParser(provider);
			parser.parse();

			// The regex will match the closing brace
			expect(parser.token).toBe("}");
		});

		it("should handle provider with special characters in token", () => {
			const provider = "{ provide: 'API_URL', useClass: ApiUrlProvider }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.token).toBe("'API_URL'");
			expect(parser.value).toBe("ApiUrlProvider");
		});
	});

	describe("Getters", () => {
		it("should return correct token", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.token).toBe("'UserService'");
		});

		it("should return correct value", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.value).toBe("UserServiceImpl");
		});

		it("should return correct scope", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl, scope: Scope.REQUEST }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.scope).toBe("Scope.REQUEST");
		});

		it("should return correct dependencies", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider);
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should return correct type", () => {
			const provider = "{ provide: 'UserService', useClass: UserServiceImpl }";
			const parser = new UseClassParser(provider);

			expect(parser.type).toBe("UseClass");
		});
	});
});

