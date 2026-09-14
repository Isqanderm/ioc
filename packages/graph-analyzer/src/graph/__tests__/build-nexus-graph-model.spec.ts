import * as path from "node:path";
import {
	createNexusAnalyzer,
	createNexusApplicationAnalyzer,
	findApplicationEntryPoint,
} from "@nexus-ioc/type-checker";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import { CircularDependencyDetector } from "../../analyzer/circular-dependency-detector";
import { buildNexusGraphModel } from "../build-nexus-graph-model";

function createProgram(files: Map<string, string>): {
	program: ts.Program;
	entryFileName: string;
} {
	const options: ts.CompilerOptions = {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.CommonJS,
		moduleResolution: ts.ModuleResolutionKind.NodeJs,
		experimentalDecorators: true,
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
		readFile: (fileName) => {
			if (fileName === nexusCoreTypes) return defaultHost.readFile(fileName);
			return files.get(fileName) ?? defaultHost.readFile(fileName);
		},
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

				if (moduleName.startsWith(".")) {
					const resolvedFileName = `${path.posix
						.normalize(
							path.posix.join(path.posix.dirname(containingFile), moduleName),
						)
						.replace(/\.ts$/, "")}.ts`;
					if (files.has(resolvedFileName)) {
						return {
							resolvedFileName,
							extension: ts.Extension.Ts,
							isExternalLibraryImport: false,
						};
					}
				}

				return ts.resolveModuleName(moduleName, containingFile, options, host)
					.resolvedModule;
			}),
	};

	const entryFileName = [...files.keys()][0];
	const program = ts.createProgram([entryFileName], options, host);
	return { program, entryFileName };
}

describe("buildNexusGraphModel", () => {
	it("builds modules/providers/exports from a multi-module application", () => {
		const files = new Map<string, string>([
			[
				"/app/main.ts",
				`import { Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";
import { DatabaseModule } from "./database.module";

@Module({ imports: [DatabaseModule], exports: [DatabaseModule] })
export class AppModule {}

NexusApplicationServer.create(AppModule).bootstrap();
`,
			],
			[
				"/app/database.module.ts",
				`import { Module } from "@nexus-ioc/core";

@Module({
  providers: [{ provide: "DATABASE", useValue: {} }],
  exports: ["DATABASE"],
})
export class DatabaseModule {}
`,
			],
			[
				"/app/server.ts",
				`export class NexusApplicationServer {
  static create(_module: unknown): NexusApplicationServer {
    return new NexusApplicationServer();
  }
  bootstrap(): void {}
}
`,
			],
		]);
		const { program, entryFileName } = createProgram(files);
		const entryPoint = findApplicationEntryPoint(program, entryFileName);
		if (!entryPoint) throw new Error("Entry point not found");

		const analyzer = createNexusAnalyzer(program);
		const application =
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);

		const graphModel = buildNexusGraphModel(application);

		const appModule = graphModel.modules.get(graphModel.entryModuleId);
		expect(appModule?.name).toBe("AppModule");
		expect(
			[...graphModel.modules.values()].map((module) => module.name).sort(),
		).toEqual(["AppModule", "DatabaseModule"]);

		const databaseModule = [...graphModel.modules.values()].find(
			(module) => module.name === "DatabaseModule",
		);
		expect(databaseModule).toBeDefined();
		expect(appModule?.imports).toEqual([
			{
				id: databaseModule?.id,
				name: "DatabaseModule",
				path: "/app/database.module.ts",
			},
		]);

		expect(databaseModule?.exports).toEqual([
			{ id: "string:DATABASE", name: "DATABASE", path: undefined },
		]);
		expect(databaseModule?.providers).toEqual([
			{
				token: "DATABASE",
				id: "string:DATABASE",
				type: "UseValue",
				scope: undefined,
				useClass: undefined,
				dependencies: [],
				undeclaredDependencies: [],
			},
		]);
	});

	it("surfaces constructor-injection cycles end to end via CircularDependencyDetector", () => {
		const files = new Map<string, string>([
			[
				"/app/main.ts",
				`import { Injectable as Service, Inject as Dependency, Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";

@Service()
export class ServiceA {
  constructor(@Dependency(ServiceB) private readonly b: ServiceB) {}
}

@Service()
export class ServiceB {
  constructor(@Dependency(ServiceA) private readonly a: ServiceA) {}
}

@Module({ providers: [ServiceA, ServiceB] })
export class AppModule {}

NexusApplicationServer.create(AppModule).bootstrap();
`,
			],
			[
				"/app/server.ts",
				`export class NexusApplicationServer {
  static create(_module: unknown): NexusApplicationServer {
    return new NexusApplicationServer();
  }
  bootstrap(): void {}
}
`,
			],
		]);
		const { program, entryFileName } = createProgram(files);
		const entryPoint = findApplicationEntryPoint(program, entryFileName);
		if (!entryPoint) throw new Error("Entry point not found");

		const analyzer = createNexusAnalyzer(program);
		const application =
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);

		const graphModel = buildNexusGraphModel(application);

		// Neither type-checker (factory-cycles only) nor the old graph-analyzer
		// AST parser covered constructor-injection cycles built from
		// type-checker's semantic model — this is the new, widened coverage.
		const analysis = new CircularDependencyDetector(graphModel).analyze();

		expect(analysis.hasCircularDependencies).toBe(true);
		expect(analysis.providerCircularCount).toBe(1);
		expect(analysis.circularDependencies[0].cycle).toEqual([
			"ServiceA",
			"ServiceB",
			"ServiceA",
		]);
	});
});
