import { writeFileSync } from "node:fs";
import * as tmp from "tmp";
import * as ts from "typescript/lib/tsserverlibrary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";

describe("getSemanticDiagnosticsActions - @Optional() Support", () => {
	let tempFile: tmp.FileResult;
	let tempFilePath: string;
	let mockLogger: Logger;
	let tsNsLs: NsLanguageService;

	beforeEach(() => {
		tempFile = tmp.fileSync({ postfix: ".ts" });
		tempFilePath = tempFile.name;
		mockLogger = {
			log: vi.fn(),
		} as unknown as Logger;
	});

	afterEach(() => {
		try {
			if (tempFile && typeof tempFile.removeCallback === "function") {
				tempFile.removeCallback();
			}
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should NOT report error for missing optional dependency", () => {
		const sourceCode = `
      import { Injectable, Inject, Optional, NsModule } from '@nexus-ioc/core';

      @Injectable()
      class DatabaseService {}

      @Injectable()
      class TestService {
        constructor(
          @Inject(DatabaseService)
          @Optional()
          private db?: DatabaseService
        ) {}
      }

      @NsModule({
        providers: [TestService]
      })
      class TestModule {}
    `;

		writeFileSync(tempFilePath, sourceCode);

		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [tempFilePath],
				getScriptVersion: () => "1",
				getScriptSnapshot: (fileName) => {
					const sourceFile = program.getSourceFile(fileName);
					return sourceFile
						? ts.ScriptSnapshot.fromString(sourceFile.getFullText())
						: undefined;
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: (fileName) => fileName === tempFilePath,
				readFile: (fileName) => {
					if (fileName === tempFilePath) {
						const fs = require("node:fs");
						return fs.readFileSync(fileName, "utf-8");
					}
					return undefined;
				},
			},
			ts.createDocumentRegistry(),
		);

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath, tsNsLs);

		// Should NOT have any missing dependency errors
		const missingDepErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("missing dependency"),
		);

		expect(missingDepErrors).toHaveLength(0);
	});

	it("should report error for missing required dependency", () => {
		const sourceCode = `
      import { Injectable, Inject, NsModule } from '@nexus-ioc/core';

      @Injectable()
      class DatabaseService {}

      @Injectable()
      class TestService {
        constructor(
          @Inject(DatabaseService)
          private db: DatabaseService
        ) {}
      }

      @NsModule({
        providers: [TestService]
      })
      class TestModule {}
    `;

		writeFileSync(tempFilePath, sourceCode);

		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [tempFilePath],
				getScriptVersion: () => "1",
				getScriptSnapshot: (fileName) => {
					const sourceFile = program.getSourceFile(fileName);
					return sourceFile
						? ts.ScriptSnapshot.fromString(sourceFile.getFullText())
						: undefined;
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: (fileName) => fileName === tempFilePath,
				readFile: (fileName) => {
					if (fileName === tempFilePath) {
						const fs = require("node:fs");
						return fs.readFileSync(fileName, "utf-8");
					}
					return undefined;
				},
			},
			ts.createDocumentRegistry(),
		);

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath, tsNsLs);

		// Should have missing dependency error
		const missingDepErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("missing dependency"),
		);

		expect(missingDepErrors.length).toBeGreaterThan(0);
	});

	it("should handle mixed optional and required dependencies", () => {
		const sourceCode = `
      import { Injectable, Inject, Optional, NsModule } from '@nexus-ioc/core';

      @Injectable()
      class DatabaseService {}

      @Injectable()
      class LoggerService {}

      @Injectable()
      class CacheService {}

      @Injectable()
      class TestService {
        constructor(
          @Inject(DatabaseService)
          private db: DatabaseService,
          @Inject(LoggerService)
          @Optional()
          private logger?: LoggerService,
          @Inject(CacheService)
          @Optional()
          private cache?: CacheService
        ) {}
      }

      @NsModule({
        providers: [TestService, DatabaseService]
      })
      class TestModule {}
    `;

		writeFileSync(tempFilePath, sourceCode);

		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [tempFilePath],
				getScriptVersion: () => "1",
				getScriptSnapshot: (fileName) => {
					const sourceFile = program.getSourceFile(fileName);
					return sourceFile
						? ts.ScriptSnapshot.fromString(sourceFile.getFullText())
						: undefined;
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: (fileName) => fileName === tempFilePath,
				readFile: (fileName) => {
					if (fileName === tempFilePath) {
						const fs = require("node:fs");
						return fs.readFileSync(fileName, "utf-8");
					}
					return undefined;
				},
			},
			ts.createDocumentRegistry(),
		);

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath, tsNsLs);

		// Should NOT have errors for optional dependencies (LoggerService, CacheService)
		const loggerErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("LoggerService"),
		);
		const cacheErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("CacheService"),
		);

		expect(loggerErrors).toHaveLength(0);
		expect(cacheErrors).toHaveLength(0);

		// DatabaseService is provided, so no error expected
		const dbErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("DatabaseService"),
		);
		expect(dbErrors).toHaveLength(0);
	});

	it("should NOT report error for optional dependency in orphan service", () => {
		const sourceCode = `
      import { Injectable, Inject, Optional } from '@nexus-ioc/core';

      @Injectable()
      class DatabaseService {}

      @Injectable()
      class OrphanService {
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

		const languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [tempFilePath],
				getScriptVersion: () => "1",
				getScriptSnapshot: (fileName) => {
					const sourceFile = program.getSourceFile(fileName);
					return sourceFile
						? ts.ScriptSnapshot.fromString(sourceFile.getFullText())
						: undefined;
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: (fileName) => fileName === tempFilePath,
				readFile: (fileName) => {
					if (fileName === tempFilePath) {
						const fs = require("node:fs");
						return fs.readFileSync(fileName, "utf-8");
					}
					return undefined;
				},
			},
			ts.createDocumentRegistry(),
		);

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath, tsNsLs);

		// Should NOT have any errors for optional dependency even in orphan service
		const missingDepErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("missing dependency"),
		);

		expect(missingDepErrors).toHaveLength(0);
	});

	it("should NOT report type mismatch error for optional dependency with correct type", () => {
		const sourceCode = `
      import { Injectable, Inject, Optional, NsModule } from '@nexus-ioc/core';

      @Injectable()
      class LoggerService {
        log(message: string) {}
      }

      @Injectable()
      class UserService {
        constructor(
          @Inject(LoggerService)
          @Optional()
          private logger?: LoggerService  // Type is LoggerService | undefined
        ) {}
      }

      @NsModule({
        providers: [
          LoggerService,  // Provides LoggerService (not LoggerService | undefined)
          UserService,
        ],
      })
      class AppModule {}
    `;

		writeFileSync(tempFilePath, sourceCode);

		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

		const languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [tempFilePath],
				getScriptVersion: () => "1",
				getScriptSnapshot: (fileName) => {
					const sourceFile = program.getSourceFile(fileName);
					return sourceFile
						? ts.ScriptSnapshot.fromString(sourceFile.getFullText())
						: undefined;
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: (fileName) => fileName === tempFilePath,
				readFile: (fileName) => {
					if (fileName === tempFilePath) {
						const fs = require("node:fs");
						return fs.readFileSync(fileName, "utf-8");
					}
					return undefined;
				},
			},
			ts.createDocumentRegistry(),
		);

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath, tsNsLs);

		// Filter out original TypeScript diagnostics
		const customDiagnostics = diagnostics.filter((d) => d.code === 9999);

		// Should NOT have any type mismatch errors
		// LoggerService (provider) IS assignable to LoggerService | undefined (optional parameter)
		const typeMismatchError = customDiagnostics.find(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("Type mismatch") &&
				d.messageText.includes("LoggerService"),
		);

		expect(typeMismatchError).toBeUndefined();
	});
});
