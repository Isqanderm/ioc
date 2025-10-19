import { writeFileSync } from "node:fs";
import * as tmp from "tmp";
import * as ts from "typescript/lib/tsserverlibrary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";

describe("getSemanticDiagnosticsActions - Global Module Type Mismatch", () => {
	let tempFile1: tmp.FileResult;
	let tempFile2: tmp.FileResult;
	let tempFile3: tmp.FileResult;
	let tempFilePath1: string;
	let _tempFilePath2: string;
	let _tempFilePath3: string;
	let mockLogger: Logger;
	let tsNsLs: NsLanguageService;

	beforeEach(() => {
		tempFile1 = tmp.fileSync({ postfix: ".ts" });
		tempFile2 = tmp.fileSync({ postfix: ".ts" });
		tempFile3 = tmp.fileSync({ postfix: ".ts" });
		tempFilePath1 = tempFile1.name;
		_tempFilePath2 = tempFile2.name;
		_tempFilePath3 = tempFile3.name;
		mockLogger = {
			log: vi.fn(),
		} as unknown as Logger;
	});

	afterEach(() => {
		try {
			if (tempFile1) tempFile1.removeCallback();
			if (tempFile2) tempFile2.removeCallback();
			if (tempFile3) tempFile3.removeCallback();
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

		const program = ts.createProgram([tempFilePath1], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

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

		const program = ts.createProgram([tempFilePath1], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
		});

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
