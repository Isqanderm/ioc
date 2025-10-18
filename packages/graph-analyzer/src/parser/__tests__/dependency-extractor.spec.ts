import * as ts from "typescript";
import { DependencyExtractor } from "../dependency-extractor";

describe("DependencyExtractor", () => {
	let extractor: DependencyExtractor;

	beforeEach(() => {
		extractor = new DependencyExtractor();
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

	/**
	 * Helper function to find a class declaration in a source file
	 */
	function findClassDeclaration(
		sourceFile: ts.SourceFile,
		className: string,
	): ts.ClassDeclaration | undefined {
		let classDecl: ts.ClassDeclaration | undefined;

		function visit(node: ts.Node) {
			if (
				ts.isClassDeclaration(node) &&
				node.name?.text === className
			) {
				classDecl = node;
			}
			ts.forEachChild(node, visit);
		}

		visit(sourceFile);
		return classDecl;
	}

	describe("Constructor Dependencies", () => {
		it("should extract class token from @Inject decorator", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          constructor(@Inject(DatabaseService) private db: DatabaseService) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "DatabaseService",
				tokenType: "class",
				optional: false,
			});
		});

		it("should extract string token from @Inject decorator", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          constructor(@Inject('CONFIG') private config: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "CONFIG",
				tokenType: "string",
				optional: false,
			});
		});

		it("should extract symbol token from @Inject decorator", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          constructor(@Inject(Symbol.for('logger')) private logger: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "Symbol.for('logger')",
				tokenType: "symbol",
				optional: false,
			});
		});

		it("should detect @Optional decorator", () => {
			const code = `
        import { Inject, Injectable, Optional } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          constructor(
            @Inject(LoggerService)
            @Optional()
            private logger?: LoggerService
          ) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "LoggerService",
				tokenType: "class",
				optional: true,
			});
		});

		it("should extract multiple constructor dependencies", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          constructor(
            @Inject(DatabaseService) private db: DatabaseService,
            @Inject('CONFIG') private config: any,
            @Inject(LoggerService) private logger: LoggerService
          ) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(3);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "DatabaseService",
				tokenType: "class",
			});
			expect(dependencies[1]).toMatchObject({
				type: "constructor",
				index: 1,
				token: "CONFIG",
				tokenType: "string",
			});
			expect(dependencies[2]).toMatchObject({
				type: "constructor",
				index: 2,
				token: "LoggerService",
				tokenType: "class",
			});
		});

		it("should return empty array when no constructor exists", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          // No constructor
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(0);
		});

		it("should return empty array when constructor has no @Inject decorators", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          constructor(private db: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(0);
		});
	});

	describe("Property Dependencies", () => {
		it("should extract property dependencies", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          @Inject(LoggerService)
          private logger: LoggerService;
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "property",
				key: "logger",
				token: "LoggerService",
				tokenType: "class",
				optional: false,
			});
		});

		it("should extract property dependencies with string tokens", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          @Inject('CONFIG')
          private config: any;
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "property",
				key: "config",
				token: "CONFIG",
				tokenType: "string",
				optional: false,
			});
		});

		it("should detect @Optional decorator on properties", () => {
			const code = `
        import { Inject, Injectable, Optional } from 'nexus-ioc';
        
        @Injectable()
        class UserService {
          @Inject(LoggerService)
          @Optional()
          private logger?: LoggerService;
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "property",
				key: "logger",
				token: "LoggerService",
				tokenType: "class",
				optional: true,
			});
		});
	});

	describe("Mixed Dependencies", () => {
		it("should extract both constructor and property dependencies", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          @Inject(LoggerService)
          private logger: LoggerService;

          constructor(
            @Inject(DatabaseService) private db: DatabaseService,
            @Inject('CONFIG') private config: any
          ) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(3);

			// Constructor dependencies
			const constructorDeps = dependencies.filter((d) => d.type === "constructor");
			expect(constructorDeps).toHaveLength(2);

			// Property dependencies
			const propertyDeps = dependencies.filter((d) => d.type === "property");
			expect(propertyDeps).toHaveLength(1);
		});
	});

	describe("TC39 Stage 3 Decorators", () => {
		it("should parse static dependencies array", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          static dependencies = [
            { index: 0, token: DatabaseService, optional: false }
          ];

          constructor(db: DatabaseService) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "DatabaseService",
				tokenType: "class",
				optional: false,
			});
		});

		it("should parse static dependencies with string tokens", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          static dependencies = [
            { index: 0, token: "CONFIG", optional: false }
          ];

          constructor(config: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "CONFIG",
				tokenType: "string",
				optional: false,
			});
		});

		it("should parse static dependencies with optional flag", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          static dependencies = [
            { index: 0, token: LoggerService, optional: true }
          ];

          constructor(logger?: LoggerService) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "LoggerService",
				tokenType: "class",
				optional: true,
			});
		});

		it("should parse multiple static dependencies", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          static dependencies = [
            { index: 0, token: DatabaseService, optional: false },
            { index: 1, token: "CONFIG", optional: false },
            { index: 2, token: LoggerService, optional: true }
          ];

          constructor(
            db: DatabaseService,
            config: any,
            logger?: LoggerService
          ) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(3);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "DatabaseService",
				optional: false,
			});
			expect(dependencies[1]).toMatchObject({
				type: "constructor",
				index: 1,
				token: "CONFIG",
				optional: false,
			});
			expect(dependencies[2]).toMatchObject({
				type: "constructor",
				index: 2,
				token: "LoggerService",
				optional: true,
			});
		});

		it("should prefer static dependencies over decorator-based dependencies", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          static dependencies = [
            { index: 0, token: DatabaseService, optional: false }
          ];

          constructor(@Inject(OtherService) db: DatabaseService) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			// Should use static dependencies, not decorator-based
			expect(dependencies).toHaveLength(1);
			expect(dependencies[0]).toMatchObject({
				type: "constructor",
				index: 0,
				token: "DatabaseService",
				tokenType: "class",
				optional: false,
			});
		});
	});

	describe("Edge Cases and Error Handling", () => {
		it("should handle class without modifiers on static dependencies property", () => {
			const code = `
        import { Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          dependencies = []; // Instance property, not static

          constructor(db: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			// Should not extract dependencies since dependencies is not static and no decorators
			expect(dependencies).toHaveLength(0);
		});

		it("should infer token type as symbol for Symbol.for() tokens", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          constructor(@Inject(Symbol.for('DATABASE')) private db: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0].tokenType).toBe("symbol");
		});

		it("should infer token type as class for uppercase tokens", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          constructor(@Inject(DatabaseService) private db: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0].tokenType).toBe("class");
		});

		it("should infer token type as string for lowercase tokens", () => {
			const code = `
        import { Inject, Injectable } from 'nexus-ioc';

        @Injectable()
        class UserService {
          constructor(@Inject('database') private db: any) {}
        }
      `;

			const sourceFile = createSourceFile(code);
			const classDecl = findClassDeclaration(sourceFile, "UserService");

			expect(classDecl).toBeDefined();
			const dependencies = extractor.extractDependencies(
				classDecl!,
				sourceFile,
			);

			expect(dependencies).toHaveLength(1);
			expect(dependencies[0].tokenType).toBe("string");
		});
	});
});

