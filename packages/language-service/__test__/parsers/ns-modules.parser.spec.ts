import { NsModulesParser } from "@nexus-ioc/type-checker";
import * as ts from "typescript/lib/tsserverlibrary";
import { vi } from "vitest";
import type { Logger } from "../../src/logger";

describe("NsModulesParser", () => {
	let sourceFile: ts.SourceFile;
	let mockLogger: Logger;
	let typeChecker: ts.TypeChecker;
	let program: ts.Program;

	beforeEach(() => {
		const sourceText = `
      import { NsModule } from "@nexus-ioc/core";
      import { AppService } from "./app.service";
      import { UserModule } from "./user/user.module";

      @NsModule({
        imports: [UserModule],
        providers: [
          AppService,
          {
            provide: "secret",
            useValue: "secret-token",
          },
          {
            provide: "number-token",
            useValue: 255,
          },
          {
            provide: "top-secret",
            useValue: "secret-token",
          },
          {
            provide: "secret-factory-property",
            useFactory: () => {
              return "secret-token";
            },
          },
          {
            provide: "secret-factory-method",
            useFactory() {
              return "secret-token";
            },
          },
        ],
        exports: [AppService, "secret", "secret-factory-property2", UserModule],
      })
      export class AppModule {}
    `;

		const compilerHost = ts.createCompilerHost({});
		const originalGetSourceFile = compilerHost.getSourceFile;
		compilerHost.getSourceFile = (
			fileName: string,
			languageVersion: ts.ScriptTarget,
		) => {
			if (fileName === "test.ts") {
				return ts.createSourceFile(fileName, sourceText, languageVersion);
			}
			return originalGetSourceFile(fileName, languageVersion);
		};

		program = ts.createProgram({
			rootNames: ["test.ts"],
			options: {
				target: ts.ScriptTarget.Latest,
				module: ts.ModuleKind.CommonJS,
				experimentalDecorators: true,
			},
			host: compilerHost,
		});

		// biome-ignore lint/style/noNonNullAssertion: test file is guaranteed to exist in test setup
		sourceFile = program.getSourceFile("test.ts")!;
		typeChecker = program.getTypeChecker();

		mockLogger = {
			log: vi.fn(),
			error: vi.fn(),
		} as unknown as Logger;
	});

	describe("execute", () => {
		it("should return class declarations with NsModule decorator", () => {
			const result = NsModulesParser.execute(sourceFile);

			expect(result).toHaveLength(1);
			expect(result[0].name?.text).toBe("AppModule");
		});
	});

	describe("executeByClassDependency", () => {
		it("should return modules that have the specified class dependency", () => {
			const mockClassDependency = {
				name: { text: "AppService" },
				kind: ts.SyntaxKind.ClassDeclaration,
			} as ts.ClassDeclaration;

			const result = NsModulesParser.executeByClassDependency(
				sourceFile,
				mockClassDependency,
				mockLogger,
			);

			expect(result).toHaveLength(1);
			expect(result[0].name?.text).toBe("AppModule");
		});

		it("should return empty array when no modules have the specified dependency", () => {
			const mockClassDependency = {
				name: { text: "NonExistentService" },
				kind: ts.SyntaxKind.ClassDeclaration,
			} as ts.ClassDeclaration;

			const result = NsModulesParser.executeByClassDependency(
				sourceFile,
				mockClassDependency,
				mockLogger,
			);

			expect(result).toHaveLength(0);
		});
	});

	describe("executeByModuleName", () => {
		// TODO: This test requires a more complex setup with proper type information
		// The executeByModuleName method uses checkTypesHelper which compares types,
		// but factory-created identifiers don't have type information attached.
		// This functionality is tested indirectly through integration tests.
		it.skip("should return modules that match the specified module name", () => {
			const mockModuleDeclaration = ts.factory.createIdentifier("AppModule");

			const result = NsModulesParser.executeByModuleName(
				sourceFile,
				mockModuleDeclaration,
				typeChecker,
				mockLogger,
			);

			expect(result).toHaveLength(1);
			expect(result[0].name?.text).toBe("AppModule");
		});

		it.skip("should return empty array when no modules match the specified name", () => {
			const mockModuleDeclaration =
				ts.factory.createIdentifier("NonExistentModule");

			const result = NsModulesParser.executeByModuleName(
				sourceFile,
				mockModuleDeclaration,
				typeChecker,
				mockLogger,
			);

			expect(result).toHaveLength(0);
		});
	});
});
