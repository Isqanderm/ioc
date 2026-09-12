import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import {
	createNexusAnalyzer,
	createNexusApplicationAnalyzer,
} from "../src";

const FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Inject as Dependency, NsModule as Module } from "@nexus-ioc/core";
import { FirstService, SecondService } from "../services";
import { UnreachableService } from "../services/unreachable";

void UnreachableService;

@Module({})
export class AppModule {
  constructor(
    @Dependency(FirstService) first: FirstService,
    @Dependency(SecondService) second: SecondService,
  ) {}
}
`,
	],
	[
		"/services/index.ts",
		`export { ServiceA as FirstService } from "./service-a";
export { ServiceB as SecondService } from "./service-b";
`,
	],
	[
		"/services/service-a.ts",
		`import { Inject as Dependency, Injectable as Service } from "@nexus-ioc/core";
import { SharedService as Shared } from "./shared-service";

@Service()
export class ServiceA {
  constructor(@Dependency(Shared) shared: Shared) {}
}
`,
	],
	[
		"/services/service-b.ts",
		`import { Inject as Dependency, Injectable as Service } from "@nexus-ioc/core";
import { SharedService as Shared } from "./shared-service";

@Service()
export class ServiceB {
  constructor(@Dependency(Shared) shared: Shared) {}
}
`,
	],
	[
		"/services/shared-service.ts",
		`import { Inject as Dependency, Injectable as Service } from "@nexus-ioc/core";
import { LeafService as Leaf } from "./leaf-service";

@Service()
export class SharedService {
  constructor(@Dependency(Leaf) leaf: Leaf) {}
}
`,
	],
	[
		"/services/leaf-service.ts",
		`import { Injectable as Service } from "@nexus-ioc/core";

@Service()
export class LeafService {}
`,
	],
	[
		"/services/unreachable.ts",
		`import { Injectable as Service } from "@nexus-ioc/core";

@Service()
export class UnreachableService {}
`,
	],
]);

function createProgram(
	entryFileName = "/app/app.module.ts",
	entryClassName = "AppModule",
	files = FILES,
): { program: ts.Program; entryPoint: ts.ClassDeclaration } {
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
			fileName === nexusCoreTypes ||
			files.has(fileName) ||
			defaultHost.fileExists(fileName),
		directoryExists: (directoryName) => {
			const normalizedDirectory = path.normalize(directoryName);

			return (
				normalizedDirectory === "/" ||
				[...files.keys()].some(
					(fileName) =>
						path.dirname(fileName) === normalizedDirectory ||
						fileName.startsWith(`${normalizedDirectory}/`),
				)
			);
		},
		readFile: (fileName) =>
			fileName === nexusCoreTypes
				? defaultHost.readFile(fileName)
				: files.get(fileName) ?? defaultHost.readFile(fileName),
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

				return ts.resolveModuleName(
					moduleName,
					containingFile,
					options,
					host,
				).resolvedModule;
			}),
	};

	const program = ts.createProgram([entryFileName], options, host);
	const sourceFile = program.getSourceFile(entryFileName);
	if (!sourceFile) throw new Error("Entry point source file was not created");

	const entryPoint = sourceFile.statements.find(
		(statement): statement is ts.ClassDeclaration =>
			ts.isClassDeclaration(statement) && statement.name?.text === entryClassName,
	);
	if (!entryPoint) throw new Error(`${entryClassName} not found`);

	return { program, entryPoint };
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
	it("discovers reachable Nexus classes across multiple files", () => {
		const { program, entryPoint } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const application = applicationAnalyzer.analyze(entryPoint);

		expect(application.classes.map((item) => item.name)).toEqual([
			"AppModule",
			"ServiceA",
			"ServiceB",
			"SharedService",
			"LeafService",
		]);
		expect(application.classes.map((item) => item.source.fileName)).toEqual([
			"/app/app.module.ts",
			"/services/service-a.ts",
			"/services/service-b.ts",
			"/services/shared-service.ts",
			"/services/leaf-service.ts",
		]);
	});

	it("resolves aliased Nexus decorators and class imports across re-exports", () => {
		const { program, entryPoint } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const application = applicationAnalyzer.analyze(entryPoint);
		const appModule = application.classes[0];

		expect(appModule.name).toBe("AppModule");
		expect(appModule.isModule).toBe(true);
		expect(appModule.dependencies.map((item) => item.name)).toEqual([
			"first",
			"second",
		]);

		for (const dependency of appModule.dependencies) {
			expect(dependency.optional).toBe(false);
			expect(dependency.token).toMatchObject({ kind: "reference" });
		}

		const dependencyClassNames = appModule.dependencies.map((dependency) => {
			if (dependency.token?.kind !== "reference") {
				throw new Error(
					"Expected an aliased class import to resolve to a reference token",
				);
			}
			return dependency.token.symbol.getName();
		});

		expect(dependencyClassNames).toEqual(["ServiceA", "ServiceB"]);
	});

	it("resolves aliased class references in nested dependencies", () => {
		const { program, entryPoint } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const application = applicationAnalyzer.analyze(entryPoint);
		const serviceA = application.classes.find((item) => item.name === "ServiceA");
		const sharedDependency = serviceA?.dependencies[0];

		expect(sharedDependency?.token).toMatchObject({ kind: "reference" });
		if (sharedDependency?.token?.kind !== "reference") {
			throw new Error(
				"Expected aliased SharedService import to resolve to a reference token",
			);
		}

		expect(sharedDependency.token.symbol.getName()).toBe("SharedService");
	});

	it("follows semantic references across imported files", () => {
		const { program, entryPoint } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const application = applicationAnalyzer.analyze(entryPoint);
		const serviceA = application.classes.find((item) => item.name === "ServiceA");
		const sharedDependency = serviceA?.dependencies[0];

		expect(sharedDependency?.token).toMatchObject({ kind: "reference" });
		if (sharedDependency?.token?.kind !== "reference") {
			throw new Error("SharedService token was not resolved");
		}
		expect(sharedDependency.token.symbol.getName()).toBe("SharedService");

		const sharedService = application.classes.find(
			(item) => item.name === "SharedService",
		);
		expect(sharedService?.source.fileName).toBe("/services/shared-service.ts");
	});

	it("deduplicates shared classes reached from multiple files and excludes unreachable files", () => {
		const { program, entryPoint } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const application = applicationAnalyzer.analyze(entryPoint);

		expect(
			application.classes.filter((item) => item.name === "SharedService"),
		).toHaveLength(1);
		expect(
			application.classes.filter((item) => item.name === "UnreachableService"),
		).toHaveLength(0);
	});

	it("preserves the entry point source span from its own file", () => {
		const { program, entryPoint } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const application = applicationAnalyzer.analyze(entryPoint);
		const entrySourceFile = program.getSourceFile("/app/app.module.ts");

		if (!entrySourceFile) throw new Error("Entry point source file not found");
		expectSourceSpan(entrySourceFile, application.entryPoint);
	});

	it("keeps traversal deterministic across files", () => {
		const firstProgram = createProgram();
		const firstAnalyzer = createNexusApplicationAnalyzer(
			createNexusAnalyzer(firstProgram.program),
		);
		const first = firstAnalyzer
			.analyze(firstProgram.entryPoint)
			.classes.map((item) => `${item.source.fileName}:${item.name}`);

		const secondProgram = createProgram();
		const secondAnalyzer = createNexusApplicationAnalyzer(
			createNexusAnalyzer(secondProgram.program),
		);
		const second = secondAnalyzer
			.analyze(secondProgram.entryPoint)
			.classes.map((item) => `${item.source.fileName}:${item.name}`);

		expect(first).toEqual(second);
	});

	it("returns AST-independent semantic classes across the application", () => {
		const { program, entryPoint } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

		const application = applicationAnalyzer.analyze(entryPoint);

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

	it("terminates circular traversal and deduplicates classes", () => {
		const cycleFiles = new Map(FILES);
		cycleFiles.set(
			"/cycle/cycle-a.ts",
			`import { Inject as Dependency, Injectable as Service } from "@nexus-ioc/core";
import { CycleB } from "./cycle-b";

@Service()
export class CycleA {
  constructor(@Dependency(CycleB) cycleB: CycleB) {}
}
`,
		);
		cycleFiles.set(
			"/cycle/cycle-b.ts",
			`import { Inject as Dependency, Injectable as Service } from "@nexus-ioc/core";
import { CycleA } from "./cycle-a";

@Service()
export class CycleB {
  constructor(@Dependency(CycleA) cycleA: CycleA) {}
}
`,
		);

		const { program, entryPoint } = createProgram(
			"/cycle/cycle-a.ts",
			"CycleA",
			cycleFiles,
		);
		const analyzer = createNexusApplicationAnalyzer(
			createNexusAnalyzer(program),
		);

		const application = analyzer.analyze(entryPoint);

		expect(application.classes.map((item) => item.name)).toEqual([
			"CycleA",
			"CycleB",
		]);
		expect(
			application.classes.filter((item) => item.name === "CycleA"),
		).toHaveLength(1);
		expect(
			application.classes.filter((item) => item.name === "CycleB"),
		).toHaveLength(1);
	});
});
