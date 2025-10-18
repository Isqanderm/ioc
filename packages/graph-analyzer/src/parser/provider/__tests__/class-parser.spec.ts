import * as ts from "typescript";
import { ClassParser } from "../class-parser";

describe("ClassParser", () => {
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

			// Should only extract the one with @Inject decorator
			expect(parser.dependencies).toHaveLength(1);
			expect(parser.dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "URL_TOKEN",
				tokenType: "string",
				optional: false,
			});
		});
	});
});

