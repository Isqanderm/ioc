import { InjectParser } from "@nexus-ioc/type-checker";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import { Logger } from "../../src/logger";

describe("InjectParser - Property Injection", () => {
	const mockLogger = new Logger({ debug: false });

	/**
	 * Helper function to create a TypeScript source file from code string
	 */
	function createSourceFile(code: string): ts.SourceFile {
		return ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
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
			if (ts.isClassDeclaration(node) && node.name?.text === className) {
				classDecl = node;
			}
			ts.forEachChild(node, visit);
		}

		visit(sourceFile);
		return classDecl;
	}

	it("should parse property with @Inject decorator", () => {
		const code = `
import { Injectable, Inject } from '@nexus-ioc/core';

@Injectable()
class TestService {
  @Inject(DatabaseService)
  private db!: DatabaseService;
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].location).toBe("property");
		expect(params[0].name.getText()).toBe("DatabaseService");
		expect(params[0].parameterName).toBe("db");
		expect(params[0].isOptional).toBe(false);
	});

	it("should parse property with string token", () => {
		const code = `
import { Injectable, Inject } from '@nexus-ioc/core';

@Injectable()
class TestService {
  @Inject('DATABASE_CONFIG')
  private config!: any;
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].location).toBe("property");
		expect(params[0].name.getText()).toBe("'DATABASE_CONFIG'");
		expect(params[0].parameterName).toBe("config");
	});

	it("should parse optional property injection", () => {
		const code = `
import { Injectable, Inject, Optional } from '@nexus-ioc/core';

@Injectable()
class TestService {
  @Inject(CacheService)
  @Optional()
  private cache?: CacheService;
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].location).toBe("property");
		expect(params[0].name.getText()).toBe("CacheService");
		expect(params[0].isOptional).toBe(true);
	});

	it("should parse @Optional without parentheses on property", () => {
		const code = `
import { Injectable, Inject, Optional } from '@nexus-ioc/core';

@Injectable()
class TestService {
  @Inject(CacheService)
  @Optional
  private cache?: CacheService;
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].isOptional).toBe(true);
	});

	it("should handle decorator order: @Optional before @Inject on property", () => {
		const code = `
import { Injectable, Inject, Optional } from '@nexus-ioc/core';

@Injectable()
class TestService {
  @Optional()
  @Inject(CacheService)
  private cache?: CacheService;
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].isOptional).toBe(true);
		expect(params[0].name.getText()).toBe("CacheService");
	});

	it("should parse multiple properties with @Inject", () => {
		const code = `
import { Injectable, Inject } from '@nexus-ioc/core';

@Injectable()
class TestService {
  @Inject(DatabaseService)
  private db!: DatabaseService;

  @Inject('CACHE_MANAGER')
  private cache!: any;

  @Inject(LoggerService)
  private logger!: LoggerService;
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(3);
		expect(params[0].name.getText()).toBe("DatabaseService");
		expect(params[1].name.getText()).toBe("'CACHE_MANAGER'");
		expect(params[2].name.getText()).toBe("LoggerService");
		expect(params.every((p) => p.location === "property")).toBe(true);
	});

	it("should parse mixed constructor and property injection", () => {
		const code = `
import { Injectable, Inject } from '@nexus-ioc/core';

@Injectable()
class TestService {
  @Inject(CacheService)
  private cache!: CacheService;

  constructor(
    @Inject(DatabaseService)
    private db: DatabaseService
  ) {}
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(2);

		// Find constructor and property params
		const constructorParam = params.find((p) => p.location === "constructor");
		const propertyParam = params.find((p) => p.location === "property");

		expect(constructorParam).toBeDefined();
		expect(propertyParam).toBeDefined();

		expect(constructorParam?.name.getText()).toBe("DatabaseService");
		expect(propertyParam?.name.getText()).toBe("CacheService");
	});

	it("should parse mixed optional constructor and property injection", () => {
		const code = `
import { Injectable, Inject, Optional } from '@nexus-ioc/core';

@Injectable()
class TestService {
  @Inject(CacheService)
  @Optional()
  private cache?: CacheService;

  constructor(
    @Inject(DatabaseService)
    private db: DatabaseService,
    @Inject(LoggerService)
    @Optional()
    private logger?: LoggerService
  ) {}
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(3);

		const constructorParams = params.filter(
			(p) => p.location === "constructor",
		);
		const propertyParams = params.filter((p) => p.location === "property");

		expect(constructorParams).toHaveLength(2);
		expect(propertyParams).toHaveLength(1);

		// Check optional flags
		expect(constructorParams[0].isOptional).toBe(false); // db
		expect(constructorParams[1].isOptional).toBe(true); // logger
		expect(propertyParams[0].isOptional).toBe(true); // cache
	});

	it("should return empty array when no @Inject decorators on properties", () => {
		const code = `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
class TestService {
  private db: any;
  private cache: any;
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(0);
	});
});
