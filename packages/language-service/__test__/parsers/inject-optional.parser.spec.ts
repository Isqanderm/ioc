import * as ts from "typescript/lib/tsserverlibrary";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../src/logger";
import { InjectParser } from "../../src/parsers/inject.parser";

describe("InjectParser - @Optional() Decorator Support", () => {
	let mockLogger: Logger;

	beforeEach(() => {
		mockLogger = {
			log: vi.fn(),
		} as unknown as Logger;
	});

	/**
	 * Helper function to create a source file from TypeScript code
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

	it("should detect @Optional() decorator on constructor parameter", () => {
		const code = `
import { Injectable, Inject, Optional } from '@nexus-ioc/core';

@Injectable()
class TestService {
  constructor(
    @Inject(DatabaseService)
    @Optional()
    private db?: DatabaseService
  ) {}
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].isOptional).toBe(true);
		expect(params[0].name.getText()).toBe("DatabaseService");
	});

	it("should detect non-optional dependency", () => {
		const code = `
import { Injectable, Inject } from '@nexus-ioc/core';

@Injectable()
class TestService {
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

		expect(params).toHaveLength(1);
		expect(params[0].isOptional).toBe(false);
		expect(params[0].name.getText()).toBe("DatabaseService");
	});

	it("should handle multiple parameters with mixed optional/required", () => {
		const code = `
import { Injectable, Inject, Optional } from '@nexus-ioc/core';

@Injectable()
class TestService {
  constructor(
    @Inject(DatabaseService)
    private db: DatabaseService,
    @Inject(LoggerService)
    @Optional()
    private logger?: LoggerService,
    @Inject('CACHE_SERVICE')
    @Optional()
    private cache?: any
  ) {}
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(3);

		// First parameter: required
		expect(params[0].name.getText()).toBe("DatabaseService");
		expect(params[0].isOptional).toBe(false);

		// Second parameter: optional
		expect(params[1].name.getText()).toBe("LoggerService");
		expect(params[1].isOptional).toBe(true);

		// Third parameter: optional with string token
		expect(params[2].name.getText()).toBe("'CACHE_SERVICE'");
		expect(params[2].isOptional).toBe(true);
	});

	it("should handle @Optional without parentheses", () => {
		const code = `
import { Injectable, Inject, Optional } from '@nexus-ioc/core';

@Injectable()
class TestService {
  constructor(
    @Inject(DatabaseService)
    @Optional
    private db?: DatabaseService
  ) {}
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

	it("should handle decorator order: @Optional before @Inject", () => {
		const code = `
import { Injectable, Inject, Optional } from '@nexus-ioc/core';

@Injectable()
class TestService {
  constructor(
    @Optional()
    @Inject(DatabaseService)
    private db?: DatabaseService
  ) {}
}
`;

		const sourceFile = createSourceFile(code);
		const classDecl = findClassDeclaration(sourceFile, "TestService");

		expect(classDecl).toBeDefined();
		if (!classDecl) return;

		const params = InjectParser.execute(classDecl, mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].isOptional).toBe(true);
		expect(params[0].name.getText()).toBe("DatabaseService");
	});

	it("should return empty array when no @Inject decorators present", () => {
		const code = `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
class TestService {
  constructor(private db: any) {}
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
