import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import { findApplicationEntryPoint } from "../src";

function createProgram(files: Map<string, string>): {
	program: ts.Program;
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
	return { program };
}

describe("findApplicationEntryPoint", () => {
	it("finds the class passed as a bare identifier to a bootstrap call", () => {
		const files = new Map<string, string>([
			[
				"/app/main.ts",
				`import { NsModule as Module } from "@nexus-ioc/core";
import { NexusApplicationsServer } from "./server";

@Module({})
export class AppModule {}

NexusApplicationsServer.create(AppModule).bootstrap();
`,
			],
			[
				"/app/server.ts",
				`export class NexusApplicationsServer {
  static create(_module: unknown): NexusApplicationsServer {
    return new NexusApplicationsServer();
  }
  bootstrap(): void {}
}
`,
			],
		]);
		const { program } = createProgram(files);

		const entryPoint = findApplicationEntryPoint(program, "/app/main.ts");

		expect(entryPoint?.name?.text).toBe("AppModule");
	});

	it("resolves the class through an aliased import", () => {
		const files = new Map<string, string>([
			[
				"/app/main.ts",
				`import { NsModule as Module } from "@nexus-ioc/core";
import { AppModule as RootModule } from "./app.module";
import { NexusApplicationsServer } from "./server";

NexusApplicationsServer.create(RootModule).bootstrap();
`,
			],
			[
				"/app/app.module.ts",
				`import { NsModule as Module } from "@nexus-ioc/core";

@Module({})
export class AppModule {}
`,
			],
			[
				"/app/server.ts",
				`export class NexusApplicationsServer {
  static create(_module: unknown): NexusApplicationsServer {
    return new NexusApplicationsServer();
  }
  bootstrap(): void {}
}
`,
			],
		]);
		const { program } = createProgram(files);

		const entryPoint = findApplicationEntryPoint(program, "/app/main.ts");

		expect(entryPoint?.name?.text).toBe("AppModule");
	});

	it("returns undefined when no matching call exists", () => {
		const files = new Map<string, string>([
			[
				"/app/main.ts",
				`import { NsModule as Module } from "@nexus-ioc/core";

@Module({})
export class AppModule {}
`,
			],
		]);
		const { program } = createProgram(files);

		expect(findApplicationEntryPoint(program, "/app/main.ts")).toBeUndefined();
	});

	it("finds the entry point when the bootstrap call is wrapped in an async function", () => {
		const files = new Map<string, string>([
			[
				"/app/main.ts",
				`import { NsModule as Module } from "@nexus-ioc/core";
import { NexusApplicationsServer } from "./server";

@Module({})
export class AppModule {}

async function bootstrap() {
  await NexusApplicationsServer.create(AppModule).bootstrap();
}

bootstrap();
`,
			],
			[
				"/app/server.ts",
				`export class NexusApplicationsServer {
  static create(_module: unknown): NexusApplicationsServer {
    return new NexusApplicationsServer();
  }
  async bootstrap(): Promise<void> {}
}
`,
			],
		]);
		const { program } = createProgram(files);

		const entryPoint = findApplicationEntryPoint(program, "/app/main.ts");

		expect(entryPoint?.name?.text).toBe("AppModule");
	});

	it("does not mistake a decorator call's class-reference argument for the entry point", () => {
		const files = new Map<string, string>([
			[
				"/app/main.ts",
				`import { Injectable as Service, Inject as Dependency, NsModule as Module } from "@nexus-ioc/core";
import { NexusApplicationsServer } from "./server";

@Service()
export class ServiceB {}

@Service()
export class ServiceA {
  constructor(@Dependency(ServiceB) private readonly b: ServiceB) {}
}

@Module({ providers: [ServiceA, ServiceB] })
export class AppModule {}

NexusApplicationsServer.create(AppModule).bootstrap();
`,
			],
			[
				"/app/server.ts",
				`export class NexusApplicationsServer {
  static create(_module: unknown): NexusApplicationsServer {
    return new NexusApplicationsServer();
  }
  bootstrap(): void {}
}
`,
			],
		]);
		const { program } = createProgram(files);

		const entryPoint = findApplicationEntryPoint(program, "/app/main.ts");

		expect(entryPoint?.name?.text).toBe("AppModule");
	});

	it("returns undefined when the call argument is not an identifier", () => {
		const files = new Map<string, string>([
			[
				"/app/main.ts",
				`import { NsModule as Module } from "@nexus-ioc/core";
import { NexusApplicationsServer } from "./server";

@Module({})
export class AppModule {}

NexusApplicationsServer.create(new AppModule()).bootstrap();
`,
			],
			[
				"/app/server.ts",
				`export class NexusApplicationsServer {
  static create(_module: unknown): NexusApplicationsServer {
    return new NexusApplicationsServer();
  }
  bootstrap(): void {}
}
`,
			],
		]);
		const { program } = createProgram(files);

		expect(findApplicationEntryPoint(program, "/app/main.ts")).toBeUndefined();
	});
});
