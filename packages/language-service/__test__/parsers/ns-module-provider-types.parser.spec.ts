import { NsModuleParser } from "@nexus-ioc/type-checker";
import { tsquery } from "@phenomnomnominal/tsquery";
import * as ts from "typescript/lib/tsserverlibrary";
import { beforeEach, describe, expect, it } from "vitest";

describe("NsModuleParser - Provider Types", () => {
	let sourceFile: ts.SourceFile;
	let typeChecker: ts.TypeChecker;
	let program: ts.Program;
	const mockLogger = {
		log: () => {},
	};

	beforeEach(() => {
		const sourceText = `
      import { NsModule, Injectable } from "@nexus-ioc/core";

      @Injectable()
      class DatabaseService {}

      @Injectable()
      class ConfigService {}

      @Injectable()
      class LoggerService {}

      @Injectable()
      class MockDatabaseService {}

      @NsModule({
        providers: [
          // Class provider (shorthand)
          DatabaseService,
          
          // useClass provider
          {
            provide: "DB_SERVICE",
            useClass: MockDatabaseService,
          },
          
          // useValue provider (string)
          {
            provide: "API_KEY",
            useValue: "secret-key-123",
          },
          
          // useValue provider (number)
          {
            provide: "PORT",
            useValue: 3000,
          },
          
          // useValue provider (object)
          {
            provide: "CONFIG",
            useValue: { debug: true, timeout: 5000 },
          },
          
          // useFactory provider without inject
          {
            provide: "TIMESTAMP",
            useFactory: () => Date.now(),
          },
          
          // useFactory provider with inject (string tokens)
          {
            provide: "DATABASE_CONNECTION",
            useFactory: (apiKey: string, port: number) => {
              return { apiKey, port, connected: true };
            },
            inject: ["API_KEY", "PORT"],
          },
          
          // useFactory provider with inject (class tokens)
          {
            provide: "LOGGER_WITH_CONFIG",
            useFactory: (config: ConfigService, logger: LoggerService) => {
              return { config, logger };
            },
            inject: [ConfigService, LoggerService],
          },
          
          // useFactory provider with mixed inject
          {
            provide: "MIXED_FACTORY",
            useFactory: (apiKey: string, db: DatabaseService) => {
              return { apiKey, db };
            },
            inject: ["API_KEY", DatabaseService],
          },
        ],
        exports: [],
      })
      export class TestModule {}
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
	});

	it("should parse class provider correctly", () => {
		const modules = tsquery.query<ts.ClassDeclaration>(
			sourceFile,
			`ClassDeclaration[name.text="TestModule"]`,
		);

		const [{ providers }] = NsModuleParser.execute(
			modules,
			typeChecker,
			mockLogger,
		);

		const classProvider = providers.find(
			(p) =>
				p.provideType === "class" && p.provide.getText() === "DatabaseService",
		);

		expect(classProvider).toBeDefined();
		expect(classProvider?.provideType).toBe("class");
		expect(classProvider?.provide.getText()).toBe("DatabaseService");
		expect(classProvider?.declaration.getText()).toBe("DatabaseService");
		expect(classProvider?.inject).toBeUndefined();
	});

	it("should parse useClass provider correctly", () => {
		const modules = tsquery.query<ts.ClassDeclaration>(
			sourceFile,
			`ClassDeclaration[name.text="TestModule"]`,
		);

		const [{ providers }] = NsModuleParser.execute(
			modules,
			typeChecker,
			mockLogger,
		);

		const useClassProvider = providers.find(
			(p) =>
				p.provideType === "useClass" && p.provide.getText() === '"DB_SERVICE"',
		);

		expect(useClassProvider).toBeDefined();
		expect(useClassProvider?.provideType).toBe("useClass");
		expect(useClassProvider?.provide.getText()).toBe('"DB_SERVICE"');
		expect(useClassProvider?.declaration.getText()).toBe("MockDatabaseService");
		expect(useClassProvider?.inject).toBeUndefined();
	});

	it("should parse useValue provider (string) correctly", () => {
		const modules = tsquery.query<ts.ClassDeclaration>(
			sourceFile,
			`ClassDeclaration[name.text="TestModule"]`,
		);

		const [{ providers }] = NsModuleParser.execute(
			modules,
			typeChecker,
			mockLogger,
		);

		const useValueProvider = providers.find(
			(p) =>
				p.provideType === "useValue" && p.provide.getText() === '"API_KEY"',
		);

		expect(useValueProvider).toBeDefined();
		expect(useValueProvider?.provideType).toBe("useValue");
		expect(useValueProvider?.provide.getText()).toBe('"API_KEY"');
		expect(useValueProvider?.declaration.getText()).toBe('"secret-key-123"');
		expect(useValueProvider?.inject).toBeUndefined();
	});

	it("should parse useValue provider (number) correctly", () => {
		const modules = tsquery.query<ts.ClassDeclaration>(
			sourceFile,
			`ClassDeclaration[name.text="TestModule"]`,
		);

		const [{ providers }] = NsModuleParser.execute(
			modules,
			typeChecker,
			mockLogger,
		);

		const useValueProvider = providers.find(
			(p) => p.provideType === "useValue" && p.provide.getText() === '"PORT"',
		);

		expect(useValueProvider).toBeDefined();
		expect(useValueProvider?.provideType).toBe("useValue");
		expect(useValueProvider?.provide.getText()).toBe('"PORT"');
		expect(useValueProvider?.declaration.getText()).toBe("3000");
		expect(useValueProvider?.inject).toBeUndefined();
	});

	it("should parse useFactory provider without inject correctly", () => {
		const modules = tsquery.query<ts.ClassDeclaration>(
			sourceFile,
			`ClassDeclaration[name.text="TestModule"]`,
		);

		const [{ providers }] = NsModuleParser.execute(
			modules,
			typeChecker,
			mockLogger,
		);

		const useFactoryProvider = providers.find(
			(p) =>
				p.provideType === "useFactory" && p.provide.getText() === '"TIMESTAMP"',
		);

		expect(useFactoryProvider).toBeDefined();
		expect(useFactoryProvider?.provideType).toBe("useFactory");
		expect(useFactoryProvider?.provide.getText()).toBe('"TIMESTAMP"');
		expect(useFactoryProvider?.inject).toBeUndefined();
	});

	it("should parse useFactory provider with string token inject correctly", () => {
		const modules = tsquery.query<ts.ClassDeclaration>(
			sourceFile,
			`ClassDeclaration[name.text="TestModule"]`,
		);

		const [{ providers }] = NsModuleParser.execute(
			modules,
			typeChecker,
			mockLogger,
		);

		const useFactoryProvider = providers.find(
			(p) =>
				p.provideType === "useFactory" &&
				p.provide.getText() === '"DATABASE_CONNECTION"',
		);

		expect(useFactoryProvider).toBeDefined();
		expect(useFactoryProvider?.provideType).toBe("useFactory");
		expect(useFactoryProvider?.provide.getText()).toBe('"DATABASE_CONNECTION"');
		expect(useFactoryProvider?.inject).toBeDefined();
		expect(useFactoryProvider?.inject).toHaveLength(2);
		expect(useFactoryProvider?.inject?.[0].getText()).toBe('"API_KEY"');
		expect(useFactoryProvider?.inject?.[1].getText()).toBe('"PORT"');
	});

	it("should parse useFactory provider with class token inject correctly", () => {
		const modules = tsquery.query<ts.ClassDeclaration>(
			sourceFile,
			`ClassDeclaration[name.text="TestModule"]`,
		);

		const [{ providers }] = NsModuleParser.execute(
			modules,
			typeChecker,
			mockLogger,
		);

		const useFactoryProvider = providers.find(
			(p) =>
				p.provideType === "useFactory" &&
				p.provide.getText() === '"LOGGER_WITH_CONFIG"',
		);

		expect(useFactoryProvider).toBeDefined();
		expect(useFactoryProvider?.provideType).toBe("useFactory");
		expect(useFactoryProvider?.provide.getText()).toBe('"LOGGER_WITH_CONFIG"');
		expect(useFactoryProvider?.inject).toBeDefined();
		expect(useFactoryProvider?.inject).toHaveLength(2);
		expect(useFactoryProvider?.inject?.[0].getText()).toBe("ConfigService");
		expect(useFactoryProvider?.inject?.[1].getText()).toBe("LoggerService");
	});

	it("should parse useFactory provider with mixed inject correctly", () => {
		const modules = tsquery.query<ts.ClassDeclaration>(
			sourceFile,
			`ClassDeclaration[name.text="TestModule"]`,
		);

		const [{ providers }] = NsModuleParser.execute(
			modules,
			typeChecker,
			mockLogger,
		);

		const useFactoryProvider = providers.find(
			(p) =>
				p.provideType === "useFactory" &&
				p.provide.getText() === '"MIXED_FACTORY"',
		);

		expect(useFactoryProvider).toBeDefined();
		expect(useFactoryProvider?.provideType).toBe("useFactory");
		expect(useFactoryProvider?.provide.getText()).toBe('"MIXED_FACTORY"');
		expect(useFactoryProvider?.inject).toBeDefined();
		expect(useFactoryProvider?.inject).toHaveLength(2);
		expect(useFactoryProvider?.inject?.[0].getText()).toBe('"API_KEY"');
		expect(useFactoryProvider?.inject?.[1].getText()).toBe("DatabaseService");
	});
});
