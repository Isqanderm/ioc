import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import {
	createNexusAnalyzer,
	createNexusApplicationAnalyzer,
	createNexusApplicationGraphBuilder,
} from "../src";

const FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, NsModule as Module } from "@nexus-ioc/core";

@Service()
export class LocalService {}

@Module({ providers: [LocalService] })
export class AppModule {}
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
	const normalizePath = (fileName: string): string =>
		path.posix.normalize(fileName);

	const defaultHost = ts.createCompilerHost(options, true);
	const host: ts.CompilerHost = {
		...defaultHost,
		getCurrentDirectory: () => "/",
		fileExists: (fileName) => {
			const normalizedFileName = normalizePath(fileName);
			return (
				normalizedFileName === normalizePath(nexusCoreTypes) ||
				files.has(normalizedFileName) ||
				defaultHost.fileExists(fileName)
			);
		},
		directoryExists: (directoryName) => {
			const normalizedDirectory = normalizePath(directoryName);
			if (normalizedDirectory === "/" || normalizedDirectory === ".") {
				return true;
			}
			return (
				[...files.keys()].some((fileName) =>
					normalizePath(fileName).startsWith(`${normalizedDirectory}/`),
				) || defaultHost.directoryExists(directoryName)
			);
		},
		readFile: (fileName) => {
			const normalizedFileName = normalizePath(fileName);
			return normalizedFileName === normalizePath(nexusCoreTypes)
				? defaultHost.readFile(fileName)
				: (files.get(normalizedFileName) ?? defaultHost.readFile(fileName));
		},
		getSourceFile: (fileName, languageVersion) => {
			const normalizedFileName = normalizePath(fileName);
			const text = files.get(normalizedFileName);
			if (text !== undefined) {
				return ts.createSourceFile(
					normalizedFileName,
					text,
					languageVersion,
					true,
				);
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

	const program = ts.createProgram([entryFileName], options, host);
	const sourceFile = program.getSourceFile(entryFileName);
	if (!sourceFile) throw new Error("Entry point source file was not created");

	const entryPoint = sourceFile.statements.find(
		(statement): statement is ts.ClassDeclaration =>
			ts.isClassDeclaration(statement) &&
			statement.name?.text === entryClassName,
	);
	if (!entryPoint) throw new Error(`${entryClassName} not found`);

	return { program, entryPoint };
}

describe("NexusApplicationGraphBuilder", () => {
	it("indexes a module's own providers and finds no dependencies to resolve yet", () => {
		const { program, entryPoint } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);
		const graphBuilder = createNexusApplicationGraphBuilder(analyzer);

		const application = applicationAnalyzer.analyze(entryPoint);
		const graph = graphBuilder.build(application);

		expect(graph.resolved).toEqual([]);
		expect(graph.unresolved).toEqual([]);
		expect(graph.cycles).toEqual([]);
	});
});
