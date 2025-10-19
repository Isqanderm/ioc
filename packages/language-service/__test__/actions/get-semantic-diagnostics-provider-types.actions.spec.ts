import * as ts from "typescript/lib/tsserverlibrary";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";

describe("getSemanticDiagnostics - Provider Types", () => {
	let program: ts.Program;
	let tsNsLs: NsLanguageService;
	let languageService: ts.LanguageService;
	let mockLogger: Logger;

	beforeEach(() => {
		mockLogger = {
			log: vi.fn(),
			error: vi.fn(),
		} as unknown as Logger;

		const files = new Map([
			[
				"test.ts",
				`
      // Mock decorators for testing
      function NsModule(metadata: any) {
        return function (target: any) {};
      }
      function Injectable() {
        return function (target: any) {};
      }
      function Inject(token?: any) {
        return function (target: any, propertyKey: string | symbol, parameterIndex?: number) {};
      }

      @Injectable()
      class DatabaseService {
        connect() { return "connected"; }
      }

      @Injectable()
      class ConfigService {
        getConfig() { return { debug: true }; }
      }

      @Injectable()
      class LoggerService {
        log(message: string) { console.log(message); }
      }

      @Injectable()
      class MockDatabaseService {
        connect() { return "mock-connected"; }
      }

      // Service that uses useClass provider correctly
      @Injectable()
      class ServiceUsingUseClass {
        constructor(@Inject("DB_SERVICE") private db: any) {}
      }

      // Service that uses useValue provider correctly
      @Injectable()
      class ServiceUsingUseValue {
        constructor(@Inject("API_KEY") private apiKey: string) {}
      }

      // Service that uses useFactory provider correctly
      @Injectable()
      class ServiceUsingUseFactory {
        constructor(@Inject("TIMESTAMP") private timestamp: number) {}
      }

      // Module that provides and consumes services for testing
      @NsModule({
        providers: [
          DatabaseService,
          ConfigService,
          LoggerService,
          MockDatabaseService,

          // useClass provider
          {
            provide: "DB_SERVICE",
            useClass: MockDatabaseService,
          },

          // useValue providers
          {
            provide: "API_KEY",
            useValue: "secret-key-123",
          },
          {
            provide: "PORT",
            useValue: 3000,
          },
          {
            provide: "CONFIG",
            useValue: { debug: true, timeout: 5000 },
          },

          // useFactory providers
          {
            provide: "TIMESTAMP",
            useFactory: (): number => Date.now(),
          },
          {
            provide: "DATABASE_CONNECTION",
            useFactory: (apiKey: string, port: number) => {
              return { apiKey, port, connected: true };
            },
            inject: ["API_KEY", "PORT"],
          },
          {
            provide: "LOGGER_WITH_CONFIG",
            useFactory: (config: ConfigService, logger: LoggerService) => {
              return { config, logger };
            },
            inject: [ConfigService, LoggerService],
          },

          // Services that use the providers
          ServiceUsingUseClass,
          ServiceUsingUseValue,
          ServiceUsingUseFactory,
        ],
        exports: [],
      })
      export class ConsumerModule {}
    `,
			],
		]);

		const compilerHost = ts.createCompilerHost({});
		const originalGetSourceFile = compilerHost.getSourceFile;
		compilerHost.getSourceFile = (
			fileName: string,
			languageVersion: ts.ScriptTarget,
		) => {
			const sourceText = files.get(fileName);
			if (sourceText) {
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

		languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [...program.getRootFileNames()],
				getScriptVersion: () => "0",
				getScriptSnapshot: (fileName) => {
					const sourceText = files.get(fileName);
					if (sourceText) {
						return ts.ScriptSnapshot.fromString(sourceText);
					}
					const sourceFile = program.getSourceFile(fileName);
					if (!sourceFile) return undefined;
					return ts.ScriptSnapshot.fromString(sourceFile.getFullText());
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: (fileName) => files.has(fileName),
				readFile: (fileName) => files.get(fileName),
				readDirectory: () => [],
				directoryExists: () => true,
			},
			ts.createDocumentRegistry(),
		);

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;
	});

	it("should not report errors for correct useClass provider usage", () => {
		const diagnostics = getSemanticDiagnosticsActions("test.ts", tsNsLs);

		const serviceErrors = diagnostics.filter(
			(d) =>
				d.messageText.toString().includes("ServiceUsingUseClass") ||
				d.messageText.toString().includes("DB_SERVICE"),
		);

		expect(serviceErrors).toHaveLength(0);
	});

	it("should not report errors for correct useValue provider usage", () => {
		const diagnostics = getSemanticDiagnosticsActions("test.ts", tsNsLs);

		const serviceErrors = diagnostics.filter(
			(d) =>
				d.messageText.toString().includes("ServiceUsingUseValue") ||
				d.messageText.toString().includes("API_KEY"),
		);

		expect(serviceErrors).toHaveLength(0);
	});

	it("should not report errors for correct useFactory provider usage", () => {
		const diagnostics = getSemanticDiagnosticsActions("test.ts", tsNsLs);

		const serviceErrors = diagnostics.filter(
			(d) =>
				d.messageText.toString().includes("ServiceUsingUseFactory") ||
				d.messageText.toString().includes("TIMESTAMP"),
		);

		expect(serviceErrors).toHaveLength(0);
	});

	it("should not report errors for factory provider with valid inject dependencies", () => {
		const diagnostics = getSemanticDiagnosticsActions("test.ts", tsNsLs);

		const factoryErrors = diagnostics.filter(
			(d) =>
				d.messageText.toString().includes("DATABASE_CONNECTION") ||
				d.messageText.toString().includes("LOGGER_WITH_CONFIG"),
		);

		expect(factoryErrors).toHaveLength(0);
	});
});

describe("getSemanticDiagnostics - Provider Type Errors", () => {
	let program: ts.Program;
	let tsNsLs: NsLanguageService;
	let languageService: ts.LanguageService;
	let mockLogger: Logger;

	beforeEach(() => {
		mockLogger = {
			log: vi.fn(),
			error: vi.fn(),
		} as unknown as Logger;

		const files = new Map([
			[
				"test.ts",
				`
      // Mock decorators for testing
      function NsModule(metadata: any) {
        return function (target: any) {};
      }
      function Injectable() {
        return function (target: any) {};
      }
      function Inject(token?: any) {
        return function (target: any, propertyKey: string | symbol, parameterIndex?: number) {};
      }

      @Injectable()
      class DatabaseService {}

      @Injectable()
      class ConfigService {}

      // Module with factory provider that has missing inject dependency
      @NsModule({
        providers: [
          DatabaseService,
          {
            provide: "FACTORY_WITH_MISSING_DEP",
            useFactory: (config: ConfigService, missing: any) => {
              return { config, missing };
            },
            inject: [ConfigService, "MISSING_TOKEN"],
          },
        ],
        exports: [],
      })
      export class ModuleWithMissingFactoryDep {}
    `,
			],
		]);

		const compilerHost = ts.createCompilerHost({});
		const originalGetSourceFile = compilerHost.getSourceFile;
		compilerHost.getSourceFile = (
			fileName: string,
			languageVersion: ts.ScriptTarget,
		) => {
			const sourceText = files.get(fileName);
			if (sourceText) {
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

		languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [...program.getRootFileNames()],
				getScriptVersion: () => "0",
				getScriptSnapshot: (fileName) => {
					const sourceText = files.get(fileName);
					if (sourceText) {
						return ts.ScriptSnapshot.fromString(sourceText);
					}
					const sourceFile = program.getSourceFile(fileName);
					if (!sourceFile) return undefined;
					return ts.ScriptSnapshot.fromString(sourceFile.getFullText());
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: (fileName) => files.has(fileName),
				readFile: (fileName) => files.get(fileName),
				readDirectory: () => [],
				directoryExists: () => true,
			},
			ts.createDocumentRegistry(),
		);

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;
	});

	it("should report error for factory provider with missing inject dependency", () => {
		const diagnostics = getSemanticDiagnosticsActions("test.ts", tsNsLs);

		const factoryErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("MISSING_TOKEN"),
		);

		expect(factoryErrors.length).toBeGreaterThan(0);
		expect(factoryErrors[0].messageText).toContain("not provided");
	});

	it("should report error for type mismatch with useValue provider", () => {
		// Create a test file with type mismatch
		const testFiles = new Map([
			[
				"type-mismatch-test.ts",
				`
      function NsModule(metadata: any) {
        return function (target: any) {};
      }
      function Injectable() {
        return function (target: any) {};
      }
      function Inject(token?: any) {
        return function (target: any, propertyKey: string | symbol, parameterIndex?: number) {};
      }

      @Injectable()
      class ServiceExpectingString {
        constructor(@Inject("CONFIG_VALUE") private config: string) {}
      }

      @NsModule({
        providers: [
          {
            provide: "CONFIG_VALUE",
            useValue: 12345, // Type mismatch: number instead of string
          },
          ServiceExpectingString,
        ],
      })
      class TypeMismatchModule {}
      `,
			],
		]);

		const compilerOptions: ts.CompilerOptions = {
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
			emitDecoratorMetadata: true,
		};

		const compilerHost = ts.createCompilerHost(compilerOptions);
		const originalGetSourceFile = compilerHost.getSourceFile;

		compilerHost.getSourceFile = (fileName, languageVersion) => {
			const fileContent = testFiles.get(fileName);
			if (fileContent) {
				return ts.createSourceFile(fileName, fileContent, languageVersion);
			}
			return originalGetSourceFile.call(
				compilerHost,
				fileName,
				languageVersion,
			);
		};

		const _program = ts.createProgram(
			Array.from(testFiles.keys()),
			compilerOptions,
			compilerHost,
		);

		const languageService = ts.createLanguageService({
			getCompilationSettings: () => compilerOptions,
			getScriptFileNames: () => Array.from(testFiles.keys()),
			getScriptVersion: () => "1",
			getScriptSnapshot: (fileName) => {
				const content = testFiles.get(fileName);
				return content ? ts.ScriptSnapshot.fromString(content) : undefined;
			},
			getCurrentDirectory: () => "",
			getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
			fileExists: (fileName) => testFiles.has(fileName),
			readFile: (fileName) => testFiles.get(fileName),
		});

		const testTsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(
			"type-mismatch-test.ts",
			testTsNsLs,
		);

		// Filter out original TypeScript diagnostics
		const customDiagnostics = diagnostics.filter((d) => d.code === 9999);

		// Check for type mismatch error
		const typeMismatchError = customDiagnostics.find(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("Type mismatch") &&
				d.messageText.includes("CONFIG_VALUE"),
		);

		// The type mismatch should be detected
		expect(typeMismatchError).toBeDefined();
	});
});
