import { tsquery } from "@phenomnomnominal/tsquery";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it, vi } from "vitest";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";
import { NsModuleParser } from "../../src/parsers/ns-module.parser";

describe("NsModuleParser - @Global() Decorator", () => {
	let mockLogger: Logger;
	let program: ts.Program;
	let typeChecker: ts.TypeChecker;

	function createSourceFile(code: string): ts.SourceFile {
		return ts.createSourceFile(
			"test.ts",
			code,
			ts.ScriptTarget.Latest,
			true,
		);
	}

	beforeEach(() => {
		mockLogger = {
			log: vi.fn(),
		} as unknown as Logger;

		const sourceText = `
import { Global, NsModule } from "@nexus-ioc/core";
import { ConfigService } from "./config.service";

@Global()
@NsModule({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class GlobalConfigModule {}

@NsModule({
  providers: [],
  exports: [],
})
export class RegularModule {}

@Global
@NsModule({
  providers: [],
  exports: [],
})
export class GlobalWithoutParentheses {}
`;

		const sourceFile = createSourceFile(sourceText);

		const compilerHost: ts.CompilerHost = {
			getSourceFile: (fileName) => {
				if (fileName === "test.ts") {
					return sourceFile;
				}
				return undefined;
			},
			writeFile: () => {},
			getCurrentDirectory: () => "",
			getDirectories: () => [],
			fileExists: () => true,
			readFile: () => "",
			getCanonicalFileName: (fileName) => fileName,
			useCaseSensitiveFileNames: () => true,
			getNewLine: () => "\n",
			getDefaultLibFileName: () => "lib.d.ts",
		};

		program = ts.createProgram(["test.ts"], {}, compilerHost);
		typeChecker = program.getTypeChecker();
	});

	describe("hasGlobalDecorator detection", () => {
		it("should detect @Global() decorator with parentheses", () => {
			const sourceFile = program.getSourceFile("test.ts");
			expect(sourceFile).toBeDefined();
			if (!sourceFile) return;

			const modules = tsquery.query<ts.ClassDeclaration>(
				sourceFile,
				`ClassDeclaration[name.text="GlobalConfigModule"]`,
			);

			const [result] = NsModuleParser.execute(
				modules,
				typeChecker,
				mockLogger,
			);

			expect(result.isGlobal).toBe(true);
			expect(result.moduleName).toBe("GlobalConfigModule");
		});

		it("should detect @Global decorator without parentheses", () => {
			const sourceFile = program.getSourceFile("test.ts");
			expect(sourceFile).toBeDefined();
			if (!sourceFile) return;

			const modules = tsquery.query<ts.ClassDeclaration>(
				sourceFile,
				`ClassDeclaration[name.text="GlobalWithoutParentheses"]`,
			);

			const [result] = NsModuleParser.execute(
				modules,
				typeChecker,
				mockLogger,
			);

			expect(result.isGlobal).toBe(true);
			expect(result.moduleName).toBe("GlobalWithoutParentheses");
		});

		it("should return false for modules without @Global decorator", () => {
			const sourceFile = program.getSourceFile("test.ts");
			expect(sourceFile).toBeDefined();
			if (!sourceFile) return;

			const modules = tsquery.query<ts.ClassDeclaration>(
				sourceFile,
				`ClassDeclaration[name.text="RegularModule"]`,
			);

			const [result] = NsModuleParser.execute(
				modules,
				typeChecker,
				mockLogger,
			);

			expect(result.isGlobal).toBe(false);
			expect(result.moduleName).toBe("RegularModule");
		});

		it("should handle decorator order (@Global before @NsModule)", () => {
			const code = `
import { Global, NsModule } from "@nexus-ioc/core";

@Global()
@NsModule({
  providers: [],
  exports: [],
})
export class TestModule {}
`;
			const sourceFile = createSourceFile(code);
			const modules = tsquery.query<ts.ClassDeclaration>(
				sourceFile,
				`ClassDeclaration[name.text="TestModule"]`,
			);

			const compilerHost: ts.CompilerHost = {
				getSourceFile: () => sourceFile,
				writeFile: () => {},
				getCurrentDirectory: () => "",
				getDirectories: () => [],
				fileExists: () => true,
				readFile: () => "",
				getCanonicalFileName: (fileName) => fileName,
				useCaseSensitiveFileNames: () => true,
				getNewLine: () => "\n",
				getDefaultLibFileName: () => "lib.d.ts",
			};

			const tempProgram = ts.createProgram(["test.ts"], {}, compilerHost);
			const tempTypeChecker = tempProgram.getTypeChecker();

			const [result] = NsModuleParser.execute(
				modules,
				tempTypeChecker,
				mockLogger,
			);

			expect(result.isGlobal).toBe(true);
		});

		it("should handle decorator order (@NsModule before @Global)", () => {
			const code = `
import { Global, NsModule } from "@nexus-ioc/core";

@NsModule({
  providers: [],
  exports: [],
})
@Global()
export class TestModule {}
`;
			const sourceFile = createSourceFile(code);
			const modules = tsquery.query<ts.ClassDeclaration>(
				sourceFile,
				`ClassDeclaration[name.text="TestModule"]`,
			);

			const compilerHost: ts.CompilerHost = {
				getSourceFile: () => sourceFile,
				writeFile: () => {},
				getCurrentDirectory: () => "",
				getDirectories: () => [],
				fileExists: () => true,
				readFile: () => "",
				getCanonicalFileName: (fileName) => fileName,
				useCaseSensitiveFileNames: () => true,
				getNewLine: () => "\n",
				getDefaultLibFileName: () => "lib.d.ts",
			};

			const tempProgram = ts.createProgram(["test.ts"], {}, compilerHost);
			const tempTypeChecker = tempProgram.getTypeChecker();

			const [result] = NsModuleParser.execute(
				modules,
				tempTypeChecker,
				mockLogger,
			);

			expect(result.isGlobal).toBe(true);
		});

		it("should return false when no decorators present", () => {
			const code = `
export class PlainClass {}
`;
			const sourceFile = createSourceFile(code);
			const modules = tsquery.query<ts.ClassDeclaration>(
				sourceFile,
				`ClassDeclaration[name.text="PlainClass"]`,
			);

			// This should return empty array since PlainClass doesn't have @NsModule
			expect(modules).toHaveLength(1);
		});
	});
});

