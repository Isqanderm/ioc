import { tsquery } from "@phenomnomnominal/tsquery";
import * as ts from "typescript/lib/tsserverlibrary";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";

describe("getSemanticDiagnosticsActions", () => {
	let mockLogger: Logger;
	let program: ts.Program;
	let tsNsLs: NsLanguageService;
	let languageService: ts.LanguageService;

	beforeEach(() => {
		mockLogger = {
			log: jest.fn(),
			error: jest.fn(),
		} as unknown as Logger;

		const files = new Map([
			["test.ts", `
				import { NsModule, Injectable, Inject } from "@nexus-ioc/core";
				import { AppService } from "./app.service";
				import { UserModule } from "./user/user.module";

				@Injectable()
				export class TestService {
					constructor(
						@Inject() private readonly appService: AppService,
						@Inject("missing-dep") private readonly missingDep: string,
						@Inject() private readonly wrongTypeService: string,
					) {}
				}

				@NsModule({
					imports: [UserModule],
					providers: [
						AppService,
						{
							provide: "string-token",
							useValue: "some-value"
						},
						TestService
					],
					exports: [AppService],
				})
				export class AppModule {}

				@Injectable()
				export class NoModuleService {
					constructor(
						@Inject() private readonly someService: any
					) {}
				}
			`],
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

	it("should return original diagnostics when source file is not found", () => {
		expect(() =>
			getSemanticDiagnosticsActions("non-existent.ts", tsNsLs),
		).toThrow("Could not find source file: 'non-existent.ts'.");
	});

	it("should create diagnostic for missing dependencies", () => {
		const result = getSemanticDiagnosticsActions("test.ts", tsNsLs);

		const missingDepDiagnostic = result.find((d) =>
			d.messageText.toString().includes("missing-dep"),
		);

		expect(missingDepDiagnostic).toBeDefined();
		expect(missingDepDiagnostic?.category).toBe(ts.DiagnosticCategory.Error);
	});

	it("should create diagnostic for type mismatches", () => {
		const result = getSemanticDiagnosticsActions("test.ts", tsNsLs);

		const typeMismatchDiagnostic = result.find(
			(d) =>
				d.messageText.toString() ===
				'Class TestService dependency dont exist: "missing-dep"',
		);

		expect(typeMismatchDiagnostic).toBeDefined();
		expect(typeMismatchDiagnostic?.category).toBe(
			ts.DiagnosticCategory.Error,
		);
	});

	it("should create diagnostic for service not connected to any module", () => {
		const result = getSemanticDiagnosticsActions("test.ts", tsNsLs);

		const noModuleDiagnostic = result.find(
			(d) =>
				d.messageText.toString() ===
				'Class TestService dependency dont exist: "missing-dep"',
		);

		expect(noModuleDiagnostic).toBeDefined();
		expect(noModuleDiagnostic?.category).toBe(ts.DiagnosticCategory.Error);
	});

	it("should not create diagnostic for valid dependencies", () => {
		const result = getSemanticDiagnosticsActions("test.ts", tsNsLs);

		const appServiceDiagnostic = result.find((d) =>
			d.messageText.toString().includes("appService"),
		);

		expect(appServiceDiagnostic).toBeUndefined();
	});
});
