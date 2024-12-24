import { tsquery } from "@phenomnomnominal/tsquery";
import * as ts from "typescript/lib/tsserverlibrary";
import type { Logger } from "../../src/logger";
import { NsModuleParser } from "../../src/parsers/ns-module.parser";

describe("NsModuleParser", () => {
	let sourceFile: ts.SourceFile;
	let mockLogger: Logger;
	let typeChecker: ts.TypeChecker;
	let program: ts.Program;

	beforeEach(() => {
		const sourceText = `
      import { NsModule } from "@nexus-ioc/core";
      import { AppService } from "./app.service";
      import { UserModule } from "./user/user.module";
      import { forFeature, forRoot } from "./feature";

      @NsModule({
        imports: [
          UserModule
        ],
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
            provide: "provider-class",
            useClass: AppService,
          },
          {
            provide: "factory-provider",
            useFactory: () => {
              return "factory-result";
            },
          },
        ],
        exports: [AppService, "secret", "foo", UserModule],
      })
      export class AppModule {}

      @NsModule({
        imports: [],
        providers: [],
        exports: [],
      })
      export class EmptyModule {}
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

		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		sourceFile = program.getSourceFile("test.ts")!;
		typeChecker = program.getTypeChecker();

		mockLogger = {
			log: jest.fn(),
			error: jest.fn(),
		} as unknown as Logger;
	});

	describe("execute", () => {
		it("should parse module declarations correctly", () => {
			const modules = tsquery.query<ts.ClassDeclaration>(
				sourceFile,
				`ClassDeclaration:has(Decorator > CallExpression > Identifier[name="NsModule"])`,
			);

			const result = NsModuleParser.execute(modules, typeChecker, mockLogger);

			expect(result).toHaveLength(2);

			const [appModule, emptyModule] = result;

			// Test AppModule
			expect(appModule.moduleName).toBe("AppModule");
			expect(appModule.imports).toHaveLength(1);
			expect(appModule.providers).toHaveLength(5);
			expect(appModule.exports).toHaveLength(3);

			// Test EmptyModule
			expect(emptyModule.moduleName).toBe("EmptyModule");
			expect(emptyModule.imports).toHaveLength(0);
			expect(emptyModule.providers).toHaveLength(0);
			expect(emptyModule.exports).toHaveLength(0);
		});

		describe("imports parsing", () => {
			it("should correctly parse different types of imports", () => {
				const modules = tsquery.query<ts.ClassDeclaration>(
					sourceFile,
					`ClassDeclaration[name.text="AppModule"]`,
				);

				const [{ imports }] = NsModuleParser.execute(
					modules,
					typeChecker,
					mockLogger,
				);

				const localImport = imports.find((imp) => imp.importType === "local");

				expect(localImport?.declaration.getText()).toBe("UserModule");
			});
		});

		describe("providers parsing", () => {
			it("should correctly parse different types of providers", () => {
				const modules = tsquery.query<ts.ClassDeclaration>(
					sourceFile,
					`ClassDeclaration[name.text="AppModule"]`,
				);

				const [{ providers }] = NsModuleParser.execute(
					modules,
					typeChecker,
					mockLogger,
				);

				const classProvider = providers.find((p) => p.provideType === "class");
				const valueProvider = providers.find(
					(p) => p.provideType === "useValue",
				);
				const useClassProvider = providers.find(
					(p) => p.provideType === "useClass",
				);
				const factoryProvider = providers.find(
					(p) => p.provideType === "useFactory",
				);

				expect(classProvider?.declaration.getText()).toBe("AppService");
				expect(valueProvider?.provide.getText()).toBe('"secret"');
				expect(useClassProvider?.provide.getText()).toBe('"provider-class"');
				expect(factoryProvider?.provide.getText()).toBe('"factory-provider"');
			});
		});

		describe("exports parsing", () => {
			it("should correctly parse exports with proper scopes", () => {
				const modules = tsquery.query<ts.ClassDeclaration>(
					sourceFile,
					`ClassDeclaration[name.text="AppModule"]`,
				);

				const [{ exports }] = NsModuleParser.execute(
					modules,
					typeChecker,
					mockLogger,
				);

				const classExport = exports.find(
					(e) => e.declaration.getText() === "AppService",
				);
				const tokenExport = exports.find(
					(e) => e.declaration.getText() === '"secret"',
				);
				const moduleExport = exports.find(
					(e) => e.declaration.getText() === "UserModule",
				);

				expect(classExport?.scope).toBe("internal");
				expect(tokenExport?.scope).toBe("internal");
				expect(moduleExport?.scope).toBe("external");
			});
		});
	});
});
