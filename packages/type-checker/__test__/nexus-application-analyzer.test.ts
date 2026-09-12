import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import {
	createNexusAnalyzer,
	createNexusApplicationAnalyzer,
} from "../src";

const SOURCE = `
import { Inject, Injectable, NsModule } from "@nexus-ioc/core";

class SharedService {}

@Injectable()
class ServiceA {
  constructor(@Inject(SharedService) shared: SharedService) {}
}

@Injectable()
class ServiceB {
  constructor(@Inject(SharedService) shared: SharedService) {}
}

@Module({})
class AppModule {
  constructor(
    @Inject(ServiceA) serviceA: ServiceA,
    @Inject(ServiceB) serviceB: ServiceB,
  ) {}
}

@Injectable()
class UnreachableService {}
`;

function createProgram(): { program: ts.Program; sourceFile: ts.SourceFile } {
	const files = new Map<string, string>([["/nexus-application-test.ts", SOURCE]]);
	const options: ts.CompilerOptions = {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.CommonJS,
		moduleResolution: ts.ModuleResolutionKind.NodeJs,
		experimentalDecorators: true,
		strict: true,
		skipLibCheck: true,
	};
	const nexusCoreTypes = path.resolve(
		process.cwd(),
		"../ioc/dist/types/index.d.ts",
	);

	const defaultHost = ts.createCompilerHost(options, true);
	const host: ts.CompilerHost = {
		...defaultHost,
		fileExists: (fileName) =>
			fileName === nexusCoreTypes || files.has(fileName) || defaultHost.fileExists(fileName),
		readFile: (fileName) => files.get(fileName) ?? defaultHost.readFile(fileName),
		getSourceFile: (fileName, languageVersion) => {
			const text = files.get(fileName);
			if (text !== undefined) {
				return ts.createSourceFile(fileName, text, languageVersion, true);
			}
			return defaultHost.getSourceFile(fileName, languageVersion);
		},
		resolveModuleNames: (moduleNames, containingFile) =>
			moduleNames.map((moduleName) => {
				if (moduleName === "@nexus-ioc/core") {
					return {
						resolvedFileName: nexusCoreTypes,
						extension: ts.Extension.Dts,
						isExternalLibraryImport: true,
					};
				}

				return ts.resolveModuleName(moduleName, containingFile, options, host)
					.resolvedModule;
			}),
	};

	const program = ts.createProgram(["/nexus-application-test.ts"], options, host);
	const sourceFile = program.getSourceFile("/nexus-application-test.ts");
	if (!sourceFile) throw new Error("Test source file was not created");

	return { program, sourceFile };
}

function getClass(
	sourceFile: ts.SourceFile,
	name: string,
): ts.ClassDeclaration {
	const declaration = sourceFile.statements.find(
		(statement): statement is ts.ClassDeclaration =>
			ts.isClassDeclaration(statement) && statement.name?.text === name,
	);
	if (!declaration) throw new Error(`Class ${name} not found`);
	return declaration;
}

function expectSourceSpan(
	sourceFile: ts.SourceFile,
	span: { fileName: string; start: number; end: number; length: number },
): void {
	expect(span.fileName).toBe(sourceFile.fileName);
	expect(span.end - span.start).toBe(span.length);
	expect(sourceFile.text.slice(span.start, span.end).length).toBe(span.length);
}

describe("NexusApplicationAnalyzer", () => {
	it("discovers reachable Nexus classes from an entry point", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const entryPoint = getClass(sourceFile, "AppModule");
		const application = applicationAnalyzer.analyze(entryPoint);

		expect(application.classes.map((item) => item.name)).toEqual([
			"AppModule",
			"ServiceA",
			"ServiceB",
			"SharedService",
		]);
		expectSourceSpan(sourceFile, application.entryPoint);
		expect(application.classes).toHaveLength(4);
	});

	it("deduplicates shared dependencies and excludes unreachable classes", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const application = applicationAnalyzer.analyze(getClass(sourceFile, "AppModule"));
		const shared = application.classes.filter((item) => item.name === "SharedService");
		const unreachable = application.classes.filter(
			(item) => item.name === "UnreachableService",
		);

		expect(shared).toHaveLength(1);
		expect(unreachable).toHaveLength(0);
	});

	it("keeps traversal deterministic", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);
		const entryPoint = getClass(sourceFile, "AppModule");

		const first = applicationAnalyzer.analyze(entryPoint).classes.map((item) => item.name);
		const second = applicationAnalyzer.analyze(entryPoint).classes.map((item) => item.name);

		expect(first).toEqual(second);
	});

	it("returns AST-independent semantic classes", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const application = applicationAnalyzer.analyze(getClass(sourceFile, "AppModule"));

		for (const nexusClass of application.classes) {
			expect(nexusClass).not.toHaveProperty("node");
			for (const dependency of nexusClass.dependencies) {
				expect(dependency).not.toHaveProperty("declaration");
				expect(dependency).not.toHaveProperty("parameterType");
			}
			for (const decorator of nexusClass.decorators) {
				expect(decorator).not.toHaveProperty("declaration");
				expect(decorator).not.toHaveProperty("expression");
			}
		}
	});
});
