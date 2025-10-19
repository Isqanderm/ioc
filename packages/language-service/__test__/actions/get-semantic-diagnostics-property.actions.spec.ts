import { writeFileSync } from "node:fs";
import * as tmp from "tmp";
import * as ts from "typescript/lib/tsserverlibrary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";

describe("getSemanticDiagnosticsActions - Property Injection", () => {
	let tempFileObj: tmp.FileResult;
	let tempFilePath: string;
	let mockLogger: Logger;
	let tsNsLs: NsLanguageService;

	beforeEach(() => {
		tempFileObj = tmp.fileSync({ postfix: ".ts" });
		tempFilePath = tempFileObj.name;
		mockLogger = {
			log: vi.fn(),
		} as unknown as Logger;
	});

	afterEach(() => {
		try {
			if (tempFileObj && typeof tempFileObj.removeCallback === "function") {
				tempFileObj.removeCallback();
			}
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should NOT report error when property dependency is provided in module", () => {
		const sourceCode = `
import { Injectable, Inject, NsModule } from '@nexus-ioc/core';

@Injectable()
class DatabaseService {
  connect() { return 'connected'; }
}

@Injectable()
class UserService {
  @Inject(DatabaseService)
  private db!: DatabaseService;

  getUsers() {
    return this.db.connect();
  }
}

@NsModule({
  providers: [DatabaseService, UserService]
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

		// Filter for missing dependency errors only
		const missingDepErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("missing dependency"),
		);

		expect(missingDepErrors).toHaveLength(0);
	});

	it("should report error when property dependency is NOT provided in module", () => {
		const sourceCode = `
import { Injectable, Inject, NsModule } from '@nexus-ioc/core';

@Injectable()
class DatabaseService {
  connect() { return 'connected'; }
}

@Injectable()
class UserService {
  @Inject(DatabaseService)
  private db!: DatabaseService;

  getUsers() {
    return this.db.connect();
  }
}

@NsModule({
  providers: [UserService]
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

		const missingDepErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("missing dependency"),
		);

		expect(missingDepErrors.length).toBeGreaterThan(0);
		expect(missingDepErrors[0].messageText).toContain("DatabaseService");
	});

	it("should NOT report error for optional property dependency", () => {
		const sourceCode = `
import { Injectable, Inject, Optional, NsModule } from '@nexus-ioc/core';

@Injectable()
class CacheService {
  get() { return 'cached'; }
}

@Injectable()
class UserService {
  @Inject(CacheService)
  @Optional()
  private cache?: CacheService;

  getUsers() {
    return this.cache?.get() || 'no-cache';
  }
}

@NsModule({
  providers: [UserService]
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

		const missingDepErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("missing dependency"),
		);

		expect(missingDepErrors).toHaveLength(0);
	});

	it("should handle mixed constructor and property injection", () => {
		const sourceCode = `
import { Injectable, Inject, NsModule } from '@nexus-ioc/core';

@Injectable()
class DatabaseService {
  connect() { return 'connected'; }
}

@Injectable()
class CacheService {
  get() { return 'cached'; }
}

@Injectable()
class UserService {
  @Inject(CacheService)
  private cache!: CacheService;

  constructor(
    @Inject(DatabaseService)
    private db: DatabaseService
  ) {}

  getUsers() {
    return this.db.connect() + this.cache.get();
  }
}

@NsModule({
  providers: [DatabaseService, CacheService, UserService]
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

		// Filter for missing dependency errors only
		const missingDepErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("missing dependency"),
		);

		expect(missingDepErrors).toHaveLength(0);
	});

	it("should NOT report type mismatch for property injection with class reference types", () => {
		const sourceCode = `
import { Injectable, Inject, NsModule } from '@nexus-ioc/core';

@Injectable()
class DatabaseService {
  connect() { return 'connected'; }
}

@Injectable()
class LoggerService {
  log(msg: string) { console.log(msg); }
}

@Injectable()
class UserService {
  @Inject(DatabaseService)
  private database!: DatabaseService;

  @Inject(LoggerService)
  private logger!: LoggerService;

  getUsers() {
    this.logger.log('Getting users');
    return this.database.connect();
  }
}

@NsModule({
  providers: [DatabaseService, LoggerService, UserService]
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

		// Filter for type mismatch errors
		const typeMismatchErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("Type mismatch"),
		);

		// Should NOT have any type mismatch errors
		expect(typeMismatchErrors).toHaveLength(0);
	});

	it("should report type mismatch when property type is incompatible with provider type", () => {
		const sourceCode = `
import { Injectable, Inject, NsModule } from '@nexus-ioc/core';

@Injectable()
class DatabaseService {
  connect() { return 'connected'; }
}

@Injectable()
class UserService {
  @Inject(DatabaseService)
  private db!: string;  // Type mismatch: DatabaseService is not assignable to string

  getUsers() {
    return this.db;
  }
}

@NsModule({
  providers: [DatabaseService, UserService]
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

		// Filter for type mismatch errors
		const typeMismatchErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("Type mismatch"),
		);

		// SHOULD have a type mismatch error
		expect(typeMismatchErrors.length).toBeGreaterThan(0);
		expect(typeMismatchErrors[0].messageText).toContain("DatabaseService");
	});
});
