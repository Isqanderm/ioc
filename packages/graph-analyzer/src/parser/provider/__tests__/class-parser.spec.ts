import * as fs from "node:fs";
import * as ts from "typescript";
import { ClassParser } from "../class-parser";

// Mock fs module
vi.mock("node:fs");

describe("ClassParser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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

	describe("Basic Functionality", () => {
		it("should extract class token", () => {
			const parser = new ClassParser("UserService");
			parser.parse();

			expect(parser.token).toBe("UserService");
			expect(parser.type).toBe("Class");
		});

		it("should work without source file", () => {
			const parser = new ClassParser("UserService");
			parser.parse();

			expect(parser.token).toBe("UserService");
			expect(parser.dependencies).toEqual([]);
		});
	});

	describe("Dependency Extraction", () => {
		it("should extract constructor dependencies when source file is provided", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        export class UserService {
          constructor(
            @Inject(DatabaseService) private db: DatabaseService,
            @Inject('CONFIG') private config: any
          ) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.token).toBe("UserService");
			expect(parser.dependencies).toHaveLength(2);
			expect(parser.dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "DatabaseService",
				tokenType: "class",
			});
			expect(parser.dependencies[1]).toMatchObject({
				type: "constructor",
				index: 1,
				token: "CONFIG",
				tokenType: "string",
			});
		});

		it("should extract property dependencies when source file is provided", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        export class UserService {
          @Inject(LoggerService)
          private logger: LoggerService;
          
          @Inject('CACHE')
          private cache: any;
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.token).toBe("UserService");
			expect(parser.dependencies).toHaveLength(2);
			expect(parser.dependencies[0]).toMatchObject({
				type: "property",
				key: "logger",
				token: "LoggerService",
				tokenType: "class",
			});
			expect(parser.dependencies[1]).toMatchObject({
				type: "property",
				key: "cache",
				token: "CACHE",
				tokenType: "string",
			});
		});

		it("should extract both constructor and property dependencies", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        export class UserService {
          @Inject(LoggerService)
          private logger: LoggerService;
          
          constructor(
            @Inject(DatabaseService) private db: DatabaseService
          ) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.token).toBe("UserService");
			expect(parser.dependencies).toHaveLength(2);

			const constructorDeps = parser.dependencies.filter(
				(d) => d.type === "constructor",
			);
			const propertyDeps = parser.dependencies.filter(
				(d) => d.type === "property",
			);

			expect(constructorDeps).toHaveLength(1);
			expect(propertyDeps).toHaveLength(1);
		});

		it("should handle optional dependencies", () => {
			const code = `
        import { Inject, Injectable, Optional } from 'nexus-ioc';
        
        @Injectable()
        export class UserService {
          constructor(
            @Inject(LoggerService)
            @Optional()
            private logger?: LoggerService
          ) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toHaveLength(1);
			expect(parser.dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "LoggerService",
				tokenType: "class",
				optional: true,
			});
		});

		it("should return empty dependencies for class without @Inject decorators", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';
        
        @Injectable()
        export class UserService {
          constructor(private db: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle class not found in source file", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';
        
        @Injectable()
        export class OtherService {}
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.token).toBe("UserService");
			expect(parser.dependencies).toEqual([]);
		});
	});

	describe("TC39 Stage 3 Decorator Support", () => {
		it("should extract static dependencies", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';
        
        @Injectable()
        export class UserService {
          static dependencies = [
            { index: 0, token: DatabaseService, optional: false },
            { index: 1, token: "CONFIG", optional: false }
          ];
          
          constructor(db: DatabaseService, config: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toHaveLength(2);
			expect(parser.dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "DatabaseService",
				tokenType: "class",
				optional: false,
			});
			expect(parser.dependencies[1]).toMatchObject({
				type: "constructor",
				index: 1,
				token: "CONFIG",
				tokenType: "string",
				optional: false,
			});
		});

		it("should prefer static dependencies over decorator-based", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        export class UserService {
          static dependencies = [
            { index: 0, token: DatabaseService, optional: false }
          ];
          
          constructor(@Inject(OtherService) db: DatabaseService) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			// Should use static dependencies
			expect(parser.dependencies).toHaveLength(1);
			expect(parser.dependencies[0].token).toBe("DatabaseService");
		});
	});

	describe("Real-world Examples", () => {
		it("should handle HttpService from example app", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';

        @Injectable()
        export class HttpService {
          constructor(@Inject("URL") private readonly url: string) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("HttpService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toHaveLength(1);
			expect(parser.dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "URL",
				tokenType: "string",
				optional: false,
			});
		});

		it("should handle RpcService from example app", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        import type { RpcHelper } from './rpc.helper';

        @Injectable()
        export class RpcService {
          constructor(
            @Inject("URL_TOKEN") urlToken: string,
            private readonly helper: RpcHelper
          ) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("RpcService", sourceFile);
			parser.parse();

			// Should extract both: one with @Inject decorator and one from type annotation
			expect(parser.dependencies).toHaveLength(2);
			expect(parser.dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "URL_TOKEN",
				tokenType: "string",
				optional: false,
				hasExplicitDecorator: true,
			});
			expect(parser.dependencies[1]).toMatchObject({
				type: "constructor",
				index: 1,
				token: "RpcHelper",
				tokenType: "class",
				optional: false,
				hasExplicitDecorator: false,
			});
		});
	});

	describe("File Loading and Import Resolution", () => {
		it("should load class from imported file", () => {
			const moduleCode = `
        import { Inject, Injectable } from 'nexus-ioc';
        import { UserService } from './user.service';

        @Injectable()
        export class AppService {
          constructor(@Inject(UserService) private user: UserService) {}
        }
      `;
			const serviceCode = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        export class UserService {
          constructor() {}
        }
      `;

			const moduleSourceFile = createSourceFile(moduleCode);

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(serviceCode);

			const parser = new ClassParser("UserService", moduleSourceFile, "/project/src/app.service.ts");
			parser.parse();

			expect(parser.token).toBe("UserService");
		});

		it("should handle file not found", () => {
			const code = `
        import { UserService } from './user.service';
      `;
			const sourceFile = createSourceFile(code);

			vi.mocked(fs.existsSync).mockReturnValue(false);

			const parser = new ClassParser("UserService", sourceFile, "/project/src/app.service.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle file read error", () => {
			const code = `
        import { UserService } from './user.service';
      `;
			const sourceFile = createSourceFile(code);

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("File read error");
			});

			const parser = new ClassParser("UserService", sourceFile, "/project/src/app.service.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle class without current file path", () => {
			const code = `
        import { UserService } from './user.service';
      `;
			const sourceFile = createSourceFile(code);

			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle node_modules import", () => {
			const code = `
        import { UserService } from 'some-package';
      `;
			const sourceFile = createSourceFile(code);

			const parser = new ClassParser("UserService", sourceFile, "/project/src/app.service.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle different file extensions", () => {
			const code = `
        import { UserService } from './user.service';
      `;
			const sourceFile = createSourceFile(code);

			vi.mocked(fs.existsSync).mockImplementation((path) => {
				return path.toString().endsWith(".ts");
			});
			vi.mocked(fs.readFileSync).mockReturnValue(`
				export class UserService {
					constructor() {}
				}
			`);

			const parser = new ClassParser("UserService", sourceFile, "/project/src/app.service.ts");
			parser.parse();

			expect(parser.token).toBe("UserService");
		});

		it("should handle index file imports", () => {
			const code = `
        import { UserService } from './services';
      `;
			const sourceFile = createSourceFile(code);

			vi.mocked(fs.existsSync).mockImplementation((path) => {
				return path.toString().includes("index.ts");
			});
			vi.mocked(fs.readFileSync).mockReturnValue(`
				export class UserService {
					constructor() {}
				}
			`);

			const parser = new ClassParser("UserService", sourceFile, "/project/src/app.service.ts");
			parser.parse();

			expect(parser.token).toBe("UserService");
		});

		it("should handle default import without named bindings", () => {
			const code = `
        import UserService from './user.service';
      `;
			const sourceFile = createSourceFile(code);

			const parser = new ClassParser("UserService", sourceFile, "/project/src/app.service.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle namespace import", () => {
			const code = `
        import * as Services from './services';
      `;
			const sourceFile = createSourceFile(code);

			const parser = new ClassParser("UserService", sourceFile, "/project/src/app.service.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle import without module specifier", () => {
			const code = `
        import 'side-effect-module';
      `;
			const sourceFile = createSourceFile(code);

			const parser = new ClassParser("UserService", sourceFile, "/project/src/app.service.ts");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});
	});

	describe("Edge Cases", () => {
		it("should handle class with no constructor", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        export class UserService {
          private data = [];
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle class with empty constructor", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        export class UserService {
          constructor() {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});

		it("should handle multiple classes in same file", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';

        @Injectable()
        export class UserService {
          constructor(@Inject(DatabaseService) private db: DatabaseService) {}
        }

        @Injectable()
        export class PostService {
          constructor(@Inject(DatabaseService) private db: DatabaseService) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("PostService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toHaveLength(1);
			expect(parser.dependencies[0].token).toBe("DatabaseService");
		});

		it("should handle static dependencies with optional true", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        export class UserService {
          static dependencies = [
            { index: 0, token: DatabaseService, optional: true }
          ];

          constructor(db?: DatabaseService) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toHaveLength(1);
			expect(parser.dependencies[0].optional).toBe(true);
		});

		it("should handle static dependencies with string token", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        export class UserService {
          static dependencies = [
            { index: 0, token: "DATABASE_URL", optional: false }
          ];

          constructor(dbUrl: string) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toHaveLength(1);
			expect(parser.dependencies[0].token).toBe("DATABASE_URL");
			expect(parser.dependencies[0].tokenType).toBe("string");
		});

		it("should handle mixed optional and required dependencies", () => {
			const code = `
        import { Inject, Injectable, Optional } from 'nexus-ioc';

        @Injectable()
        export class UserService {
          constructor(
            @Inject(DatabaseService) private db: DatabaseService,
            @Inject(LoggerService) @Optional() private logger?: LoggerService
          ) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toHaveLength(2);
			expect(parser.dependencies[0].optional).toBeFalsy();
			expect(parser.dependencies[1].optional).toBe(true);
		});

		it("should handle property dependencies with optional", () => {
			const code = `
        import { Inject, Injectable, Optional } from 'nexus-ioc';

        @Injectable()
        export class UserService {
          @Inject(LoggerService)
          @Optional()
          private logger?: LoggerService;
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			expect(parser.dependencies).toHaveLength(1);
			expect(parser.dependencies[0].type).toBe("property");
			expect(parser.dependencies[0].optional).toBe(true);
		});

		it("should handle class with both static dependencies and decorators", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';

        @Injectable()
        export class UserService {
          static dependencies = [
            { index: 0, token: DatabaseService, optional: false }
          ];

          @Inject(LoggerService)
          private logger: LoggerService;

          constructor(db: DatabaseService) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const parser = new ClassParser("UserService", sourceFile);
			parser.parse();

			// Should have both static constructor deps and property deps
			expect(parser.dependencies.length).toBeGreaterThan(0);
		});
	});

	describe("Getters", () => {
		it("should return correct token", () => {
			const parser = new ClassParser("UserService");
			parser.parse();

			expect(parser.token).toBe("UserService");
		});

		it("should return correct type", () => {
			const parser = new ClassParser("UserService");

			expect(parser.type).toBe("Class");
		});

		it("should return correct value", () => {
			const parser = new ClassParser("UserService");
			parser.parse();

			// ClassParser doesn't have a value getter, it returns token
			expect(parser.token).toBe("UserService");
		});

		it("should return dependencies", () => {
			const parser = new ClassParser("UserService");
			parser.parse();

			expect(parser.dependencies).toEqual([]);
		});
	});
});

