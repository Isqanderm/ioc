import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";

describe("getSemanticDiagnosticsActions - Global Module Type Mismatch", () => {
	let tempFilePath1: string;
	let tempFilePath2: string;
	let tempFilePath3: string;
	let mockLogger: Logger;
	let tsNsLs: NsLanguageService;

	beforeEach(() => {
		const timestamp = Date.now();
		tempFilePath1 = join(tmpdir(), `test-global-config-${timestamp}.ts`);
		tempFilePath2 = join(tmpdir(), `test-global-module-${timestamp}.ts`);
		tempFilePath3 = join(tmpdir(), `test-service-${timestamp}.ts`);
		mockLogger = {
			log: vi.fn(),
		} as unknown as Logger;
	});

	afterEach(() => {
		try {
			const fs = require("node:fs");
			[tempFilePath1, tempFilePath2, tempFilePath3].forEach((path) => {
				if (fs.existsSync(path)) {
					fs.unlinkSync(path);
				}
			});
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should report type mismatch for global module dependency with incompatible type", () => {
		// Single file with all code to ensure proper type resolution
		const sourceCode = `
import { Injectable, Inject, Global, NsModule } from '@nexus-ioc/core';

@Injectable()
class GlobalConfigService {
  getApiUrl(): string {
    return 'https://api.example.com';
  }
}

@Global()
@NsModule({
  providers: [GlobalConfigService],
  exports: [GlobalConfigService],
})
class GlobalConfigModule {}

@Injectable()
class FeatureService {
  constructor(
    @Inject(GlobalConfigService) private config: string  // Type mismatch!
  ) {}
}
`;

		writeFileSync(tempFilePath1, sourceCode);

		const program = ts.createProgram(
			[tempFilePath1],
			{
				target: ts.ScriptTarget.Latest,
				module: ts.ModuleKind.CommonJS,
				experimentalDecorators: true,
			},
		);

		const languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [tempFilePath1],
				getScriptVersion: () => "1",
				getScriptSnapshot: (fileName) => {
					const sourceFile = program.getSourceFile(fileName);
					return sourceFile
						? ts.ScriptSnapshot.fromString(sourceFile.getFullText())
						: undefined;
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: (fileName) => fileName === tempFilePath1,
				readFile: (fileName) => {
					if (fileName === tempFilePath1) {
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

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath1, tsNsLs);

		// Filter for type mismatch errors
		const typeMismatchErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("Type mismatch"),
		);

		// SHOULD have a type mismatch error
		expect(typeMismatchErrors.length).toBeGreaterThan(0);
		expect(typeMismatchErrors[0].messageText).toContain("GlobalConfigService");
		expect(typeMismatchErrors[0].messageText).toContain("global module");
	});

	it("should NOT report type mismatch for global module dependency with correct type", () => {
		// Single file with all code to ensure proper type resolution
		const sourceCode = `
import { Injectable, Inject, Global, NsModule } from '@nexus-ioc/core';

@Injectable()
class GlobalConfigService {
  getApiUrl(): string {
    return 'https://api.example.com';
  }
}

@Global()
@NsModule({
  providers: [GlobalConfigService],
  exports: [GlobalConfigService],
})
class GlobalConfigModule {}

@Injectable()
class FeatureService {
  constructor(
    @Inject(GlobalConfigService) private config: GlobalConfigService  // Correct type!
  ) {}
}
`;

		writeFileSync(tempFilePath1, sourceCode);

		const program = ts.createProgram(
			[tempFilePath1],
			{
				target: ts.ScriptTarget.Latest,
				module: ts.ModuleKind.CommonJS,
				experimentalDecorators: true,
			},
		);

		const languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [tempFilePath1],
				getScriptVersion: () => "1",
				getScriptSnapshot: (fileName) => {
					const sourceFile = program.getSourceFile(fileName);
					return sourceFile
						? ts.ScriptSnapshot.fromString(sourceFile.getFullText())
						: undefined;
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: (fileName) => fileName === tempFilePath1,
				readFile: (fileName) => {
					if (fileName === tempFilePath1) {
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

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath1, tsNsLs);

		// Filter for type mismatch errors
		const typeMismatchErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("Type mismatch"),
		);

		// Should NOT have any type mismatch errors
		expect(typeMismatchErrors).toHaveLength(0);
	});
});

