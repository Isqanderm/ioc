import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";

describe("getSemanticDiagnosticsActions - Reference Types", () => {
	let tempFilePath: string;
	let mockLogger: Logger;
	let tsNsLs: NsLanguageService;

	beforeEach(() => {
		tempFilePath = join(tmpdir(), `test-reference-types-${Date.now()}.ts`);
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

	it("should NOT report type mismatch for class reference types in constructor", () => {
		const sourceCode = `
      import { Injectable, Inject, NsModule } from '@nexus-ioc/core';

      @Injectable()
      class DatabaseService {
        connect() { return 'connected'; }
      }

      @Injectable()
      class UserService {
        constructor(
          @Inject(DatabaseService)
          private db: DatabaseService  // TypeReferenceNode
        ) {}
      }

      @NsModule({
        providers: [
          DatabaseService,  // ClassDeclaration
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
		const typeMismatchError = customDiagnostics.find(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("Type mismatch") &&
				d.messageText.includes("DatabaseService"),
		);

		expect(typeMismatchError).toBeUndefined();
	});

	it("should NOT report type mismatch for class reference types in properties", () => {
		const sourceCode = `
      import { Injectable, Inject, NsModule } from '@nexus-ioc/core';

      @Injectable()
      class LoggerService {
        log(msg: string) {}
      }

      @Injectable()
      class UserService {
        @Inject(LoggerService)
        private logger!: LoggerService;  // TypeReferenceNode

        doSomething() {
          this.logger.log('test');
        }
      }

      @NsModule({
        providers: [
          LoggerService,  // ClassDeclaration
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
		const typeMismatchError = customDiagnostics.find(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("Type mismatch") &&
				d.messageText.includes("LoggerService"),
		);

		expect(typeMismatchError).toBeUndefined();
	});

	it("should NOT report type mismatch for interface reference types", () => {
		const sourceCode = `
      import { Injectable, Inject, NsModule } from '@nexus-ioc/core';

      interface ILogger {
        log(msg: string): void;
      }

      @Injectable()
      class ConsoleLogger implements ILogger {
        log(msg: string) {
          console.log(msg);
        }
      }

      @Injectable()
      class UserService {
        constructor(
          @Inject('ILogger')
          private logger: ILogger  // TypeReferenceNode to interface
        ) {}
      }

      @NsModule({
        providers: [
          { provide: 'ILogger', useClass: ConsoleLogger },
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

		// Should NOT have any type mismatch errors for ILogger
		const typeMismatchError = customDiagnostics.find(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("Type mismatch") &&
				d.messageText.includes("ILogger"),
		);

		expect(typeMismatchError).toBeUndefined();
	});
});

