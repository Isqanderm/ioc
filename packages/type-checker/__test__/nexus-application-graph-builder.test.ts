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

const MULTI_MODULE_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, NsModule as Module } from "@nexus-ioc/core";
import { DatabaseModule } from "./database.module";
import { DatabaseService } from "./database.module";

@Service()
export class RepositoryService {
  constructor(@Dependency(DatabaseService) db: DatabaseService) {}
}

@Module({ imports: [DatabaseModule], providers: [RepositoryService] })
export class AppModule {}
`,
	],
	[
		"/app/database.module.ts",
		`import { Injectable as Service, NsModule as Module } from "@nexus-ioc/core";

@Service()
export class DatabaseService {}

@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
`,
	],
]);

const UNRESOLVED_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, NsModule as Module, Optional as Maybe } from "@nexus-ioc/core";

@Service()
export class OrphanService {
  constructor(
    @Dependency("MISSING_CONFIG") config: unknown,
    @Dependency("MISSING_OPTIONAL") @Maybe() optional: unknown,
  ) {}
}

@Module({ providers: [OrphanService] })
export class AppModule {}
`,
	],
]);

const GLOBAL_MODULE_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, NsModule as Module } from "@nexus-ioc/core";
import { LoggerModule } from "./logger.module";

@Service()
export class ConsumerService {
  constructor(@Dependency("LOGGER") logger: unknown) {}
}

@Module({ imports: [LoggerModule], providers: [ConsumerService] })
export class AppModule {}
`,
	],
	[
		"/app/logger.module.ts",
		`import { Global as NexusGlobal, NsModule as Module } from "@nexus-ioc/core";

@Module({ providers: [{ provide: "LOGGER", useValue: console }], exports: ["LOGGER"] })
@NexusGlobal()
export class LoggerModule {}
`,
	],
]);

const OWN_PROVIDER_PRECEDENCE_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, NsModule as Module } from "@nexus-ioc/core";
import { ImportedModule } from "./imported.module";

@Service()
export class ConsumerService {
  constructor(@Dependency("SHARED_TOKEN") shared: unknown) {}
}

@Module({
  imports: [ImportedModule],
  providers: [
    { provide: "SHARED_TOKEN", useValue: "own" },
    ConsumerService,
  ],
  exports: [],
})
export class AppModule {}
`,
	],
	[
		"/app/imported.module.ts",
		`import { NsModule as Module } from "@nexus-ioc/core";

@Module({
  providers: [{ provide: "SHARED_TOKEN", useValue: "imported" }],
  exports: ["SHARED_TOKEN"],
})
export class ImportedModule {}
`,
	],
]);

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

	it("resolves a dependency through an imported module's exported provider", () => {
		const { program, entryPoint } = createProgram(
			"/app/app.module.ts",
			"AppModule",
			MULTI_MODULE_FILES,
		);
		const analyzer = createNexusAnalyzer(program);
		const application =
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
		const graph =
			createNexusApplicationGraphBuilder(analyzer).build(application);

		expect(graph.unresolved).toEqual([]);
		expect(graph.resolved).toHaveLength(1);
		expect(graph.resolved[0].dependencyName).toBe("db");
		expect(graph.resolved[0].providingModule.name).toBe("DatabaseModule");
		expect(graph.resolved[0].provider.kind).toBe("class");
	});

	it("reports a missing required dependency and skips an unresolved optional one", () => {
		const { program, entryPoint } = createProgram(
			"/app/app.module.ts",
			"AppModule",
			UNRESOLVED_FILES,
		);
		const analyzer = createNexusAnalyzer(program);
		const application =
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
		const graph =
			createNexusApplicationGraphBuilder(analyzer).build(application);

		expect(graph.resolved).toEqual([]);
		expect(graph.unresolved).toHaveLength(1);
		expect(graph.unresolved[0].dependencyName).toBe("config");
	});

	it("resolves a dependency exported by a @Global() module without an explicit import", () => {
		const { program, entryPoint } = createProgram(
			"/app/app.module.ts",
			"AppModule",
			GLOBAL_MODULE_FILES,
		);
		const analyzer = createNexusAnalyzer(program);
		const application =
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
		const graph =
			createNexusApplicationGraphBuilder(analyzer).build(application);

		expect(graph.unresolved).toEqual([]);
		expect(graph.resolved).toHaveLength(1);
		expect(graph.resolved[0].providingModule.name).toBe("LoggerModule");
	});

	it("prefers a module's own provider over an imported module's re-exported provider for the same token", () => {
		const { program, entryPoint } = createProgram(
			"/app/app.module.ts",
			"AppModule",
			OWN_PROVIDER_PRECEDENCE_FILES,
		);
		const analyzer = createNexusAnalyzer(program);
		const application =
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
		const graph =
			createNexusApplicationGraphBuilder(analyzer).build(application);

		expect(graph.unresolved).toEqual([]);
		expect(graph.resolved).toHaveLength(1);
		expect(graph.resolved[0].dependencyName).toBe("shared");
		expect(graph.resolved[0].providingModule.name).toBe("AppModule");
		expect(graph.resolved[0].provider.kind).toBe("useValue");
	});
});
