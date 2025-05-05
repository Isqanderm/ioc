import { tsquery } from "@phenomnomnominal/tsquery";
import * as ts from "typescript/lib/tsserverlibrary";
import { getReferenceModules } from "../../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../../src/language-service/ns-language-service";
import type { Logger } from "../../../src/logger";

describe("getReferenceModules", () => {
	let mockLogger: Logger;
	let program: ts.Program;
	let tsNsLs: NsLanguageService;
	let languageService: ts.LanguageService;

	beforeEach(() => {
		mockLogger = {
			log: jest.fn(),
			error: jest.fn(),
		} as unknown as Logger;

		program = ts.createProgram(
			[
				`${__dirname}/app.module.ts`,
				`${__dirname}/test.module.ts`,
				`${__dirname}/app.service.ts`,
			],
			{
				target: ts.ScriptTarget.Latest,
				module: ts.ModuleKind.CommonJS,
				experimentalDecorators: true,
				moduleResolution: ts.ModuleResolutionKind.NodeJs,
				baseUrl: __dirname,
				paths: {
					"@nexus-ioc/core": ["node_modules/@nexus-ioc/core"],
				},
			},
		);

		languageService = ts.createLanguageService(
			{
				getCompilationSettings: () => program.getCompilerOptions(),
				getScriptFileNames: () => [...program.getRootFileNames()],
				getScriptVersion: () => "0",
				getScriptSnapshot: (fileName) => {
					const sourceFile = program.getSourceFile(fileName);
					if (!sourceFile) return undefined;
					return ts.ScriptSnapshot.fromString(sourceFile.getFullText());
				},
				getCurrentDirectory: () => process.cwd(),
				getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
				fileExists: ts.sys.fileExists,
				readFile: ts.sys.readFile,
				readDirectory: ts.sys.readDirectory,
				directoryExists: ts.sys.directoryExists,
				realpath: ts.sys.realpath,
			},
			ts.createDocumentRegistry(),
		);

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;
	});

	it("should find module references for injectable class", () => {
		const sourceFile = program.getSourceFile("app.service.ts");
		const typeChecker = program.getTypeChecker();

		expect(sourceFile).toBeDefined();

		const [appServiceClass] = tsquery.query<ts.ClassDeclaration>(
			sourceFile!,
			"ClassDeclaration[name.text='AppService']",
		);

		expect(appServiceClass).toBeDefined();

		const modules = getReferenceModules(appServiceClass, tsNsLs, typeChecker);

		console.log("modules: ", modules);

		expect(modules).toHaveLength(2);
		expect(modules[0].moduleName).toBe("AppModule");
		expect(modules[0].providers).toHaveLength(1);
		expect(modules[0].exports).toHaveLength(1);

		const provider = modules[0].providers[0];
		expect(provider.declaration.getText()).toBe("AppService");
	});

	it("should handle multiple module references", () => {
		const sourceFile = program.getSourceFile("app.service.ts");
		const typeChecker = program.getTypeChecker();

		const appServiceClass = tsquery.query<ts.ClassDeclaration>(
			sourceFile!,
			"ClassDeclaration[name.text='AppService']",
		)[0];

		const modules = getReferenceModules(appServiceClass, tsNsLs, typeChecker);

		// AppService is referenced in both app.module.ts and test.module.ts
		expect(modules).toHaveLength(2);

		// Check that both modules have AppService in their providers
		const hasAppServiceProvider = modules.every((module) =>
			module.providers.some(
				(provider) => provider.declaration.getText() === "AppService",
			),
		);
		expect(hasAppServiceProvider).toBe(true);

		// Check that only AppModule exports AppService
		const exportingModules = modules.filter((module) =>
			module.exports.some((exp) => exp.declaration.getText() === "AppService"),
		);
		expect(exportingModules).toHaveLength(1);
		expect(exportingModules[0].moduleName).toBe("AppModule");
	});
});
