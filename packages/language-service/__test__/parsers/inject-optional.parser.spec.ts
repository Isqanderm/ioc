import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../src/logger";
import { InjectParser } from "../../src/parsers/inject.parser";

describe("InjectParser - @Optional() Decorator Support", () => {
	let tempFilePath: string;
	let mockLogger: Logger;

	beforeEach(() => {
		tempFilePath = join(tmpdir(), `test-${Date.now()}.ts`);
		mockLogger = {
			log: vi.fn(),
		} as unknown as Logger;
	});

	afterEach(() => {
		try {
			const fs = require("node:fs");
			if (fs.existsSync(tempFilePath)) {
				fs.unlinkSync(tempFilePath);
			}
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should detect @Optional() decorator on constructor parameter", () => {
		const sourceCode = `
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

		writeFileSync(tempFilePath, sourceCode);
		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const sourceFile = program.getSourceFile(tempFilePath);
		expect(sourceFile).toBeDefined();
		if (!sourceFile) return;

		const classDeclarations = sourceFile.statements.filter(
			ts.isClassDeclaration,
		);
		expect(classDeclarations).toHaveLength(1);

		const params = InjectParser.execute(classDeclarations[0], mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].isOptional).toBe(true);
		expect(params[0].name.getText()).toBe("DatabaseService");
	});

	it("should detect non-optional dependency", () => {
		const sourceCode = `
      import { Injectable, Inject } from '@nexus-ioc/core';

      @Injectable()
      class TestService {
        constructor(
          @Inject(DatabaseService)
          private db: DatabaseService
        ) {}
      }
    `;

		writeFileSync(tempFilePath, sourceCode);
		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const sourceFile = program.getSourceFile(tempFilePath);
		expect(sourceFile).toBeDefined();
		if (!sourceFile) return;

		const classDeclarations = sourceFile.statements.filter(
			ts.isClassDeclaration,
		);
		expect(classDeclarations).toHaveLength(1);

		const params = InjectParser.execute(classDeclarations[0], mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].isOptional).toBe(false);
		expect(params[0].name.getText()).toBe("DatabaseService");
	});

	it("should handle multiple parameters with mixed optional/required", () => {
		const sourceCode = `
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

		writeFileSync(tempFilePath, sourceCode);
		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const sourceFile = program.getSourceFile(tempFilePath);
		expect(sourceFile).toBeDefined();
		if (!sourceFile) return;

		const classDeclarations = sourceFile.statements.filter(
			ts.isClassDeclaration,
		);
		expect(classDeclarations).toHaveLength(1);

		const params = InjectParser.execute(classDeclarations[0], mockLogger);

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
		const sourceCode = `
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

		writeFileSync(tempFilePath, sourceCode);
		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const sourceFile = program.getSourceFile(tempFilePath);
		expect(sourceFile).toBeDefined();
		if (!sourceFile) return;

		const classDeclarations = sourceFile.statements.filter(
			ts.isClassDeclaration,
		);
		expect(classDeclarations).toHaveLength(1);

		const params = InjectParser.execute(classDeclarations[0], mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].isOptional).toBe(true);
	});

	it("should handle decorator order: @Optional before @Inject", () => {
		const sourceCode = `
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

		writeFileSync(tempFilePath, sourceCode);
		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const sourceFile = program.getSourceFile(tempFilePath);
		expect(sourceFile).toBeDefined();
		if (!sourceFile) return;

		const classDeclarations = sourceFile.statements.filter(
			ts.isClassDeclaration,
		);
		expect(classDeclarations).toHaveLength(1);

		const params = InjectParser.execute(classDeclarations[0], mockLogger);

		expect(params).toHaveLength(1);
		expect(params[0].isOptional).toBe(true);
		expect(params[0].name.getText()).toBe("DatabaseService");
	});

	it("should return empty array when no @Inject decorators present", () => {
		const sourceCode = `
      import { Injectable } from '@nexus-ioc/core';

      @Injectable()
      class TestService {
        constructor(private db: any) {}
      }
    `;

		writeFileSync(tempFilePath, sourceCode);
		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const sourceFile = program.getSourceFile(tempFilePath);
		expect(sourceFile).toBeDefined();
		if (!sourceFile) return;

		const classDeclarations = sourceFile.statements.filter(
			ts.isClassDeclaration,
		);
		expect(classDeclarations).toHaveLength(1);

		const params = InjectParser.execute(classDeclarations[0], mockLogger);

		expect(params).toHaveLength(0);
	});
});

