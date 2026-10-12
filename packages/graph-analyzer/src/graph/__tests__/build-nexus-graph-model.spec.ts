import * as path from "node:path";
import {
	createNexusAnalyzer,
	createNexusApplicationAnalyzer,
	findApplicationEntryPoint,
} from "@nexus-ioc/type-checker";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import { CircularDependencyDetector } from "../../analyzer/circular-dependency-detector";
import { JsonFormatter } from "../../visualize/json-formatter";
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

	it("labels an InjectionToken provider by its variable name", () => {
		const files = new Map<string, string>([
			[
				"/app/main.ts",
				`import { InjectionToken, Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";

export const CONFIG = new InjectionToken<{ url: string }>("CONFIG");

@Module({
  providers: [{ provide: CONFIG, useValue: { url: "x" } }],
  exports: [CONFIG],
})
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

		const appModule = graphModel.modules.get(graphModel.entryModuleId);
		expect(appModule?.providers).toHaveLength(1);
		expect(appModule?.providers[0].token).toBe("CONFIG");
		expect(appModule?.providers[0].id).toContain("/app/main.ts:");
		expect(appModule?.exports.map((entry) => entry.name)).toEqual(["CONFIG"]);
	});

	const SERVER = `export class NexusApplicationServer {
  static create(_module: unknown): NexusApplicationServer {
    return new NexusApplicationServer();
  }
  bootstrap(): void {}
}
`;

	function buildFrom(main: string) {
		const { program, entryFileName } = createProgram(
			new Map([
				["/app/main.ts", main],
				["/app/server.ts", SERVER],
			]),
		);
		const entryPoint = findApplicationEntryPoint(program, entryFileName);
		if (!entryPoint) throw new Error("Entry point not found");
		const analyzer = createNexusAnalyzer(program);
		return buildNexusGraphModel(
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint),
		);
	}

	it("adds an Api -> Http edge for an inject() field initializer", () => {
		const graphModel =
			buildFrom(`import { inject, Injectable, Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";

@Injectable()
export class Http {}

@Injectable()
export class Api {
  readonly http = inject(Http);
}

@Module({ providers: [Api, Http] })
export class AppModule {}

NexusApplicationServer.create(AppModule).bootstrap();
`);
		const providers = graphModel.modules.get(
			graphModel.entryModuleId,
		)?.providers;
		const api = providers?.find((provider) => provider.token === "Api");
		const http = providers?.find((provider) => provider.token === "Http");
		expect(api?.dependencies).toEqual([
			{ token: "Http", tokenId: http?.id, optional: false },
		]);
		expect(api?.undeclaredDependencies).toEqual([]);
	});

	it("reports an A <-> B cycle made of inject() calls", () => {
		const graphModel =
			buildFrom(`import { inject, Injectable, Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";

@Injectable()
export class ServiceA {
  readonly b = inject(ServiceB);
}

@Injectable()
export class ServiceB {
  constructor() {
    inject(ServiceA);
  }
}

@Module({ providers: [ServiceA, ServiceB] })
export class AppModule {}

NexusApplicationServer.create(AppModule).bootstrap();
`);
		const analysis = new CircularDependencyDetector(graphModel).analyze();
		expect(analysis.hasCircularDependencies).toBe(true);
		expect(analysis.providerCircularCount).toBe(1);
		expect(analysis.circularDependencies[0].cycle).toEqual([
			"ServiceA",
			"ServiceB",
			"ServiceA",
		]);
	});

	it("adds a factory's inject() calls to the factory provider's dependencies", () => {
		const graphModel =
			buildFrom(`import { inject, Injectable, Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";

@Injectable()
export class Http {}

@Module({
  providers: [Http, { provide: "CLIENT", useFactory: () => ({ http: inject(Http) }) }],
})
export class AppModule {}

NexusApplicationServer.create(AppModule).bootstrap();
`);
		const providers = graphModel.modules.get(
			graphModel.entryModuleId,
		)?.providers;
		const client = providers?.find((provider) => provider.token === "CLIENT");
		expect(client?.dependencies.map((dependency) => dependency.token)).toEqual([
			"Http",
		]);
	});

	describe("child scopes declared via children", () => {
		const SERVER_FILE: [string, string] = ["/app/server.ts", SERVER];

		function buildFiles(entries: [string, string][]) {
			const { program, entryFileName } = createProgram(
				new Map([...entries, SERVER_FILE]),
			);
			const entryPoint = findApplicationEntryPoint(program, entryFileName);
			if (!entryPoint) throw new Error("Entry point not found");
			const analyzer = createNexusAnalyzer(program);
			return buildNexusGraphModel(
				createNexusApplicationAnalyzer(analyzer).analyze(entryPoint),
			);
		}

		const CHILD_APP: [string, string][] = [
			[
				"/app/main.ts",
				`import { Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";
import { HttpModule } from "./http.module";
import { ProfileModule } from "./profile.module";

@Module({ imports: [HttpModule], children: [ProfileModule] })
export class AppModule {}

NexusApplicationServer.create(AppModule).bootstrap();
`,
			],
			[
				"/app/http.module.ts",
				`import { Injectable, Module } from "@nexus-ioc/core";

@Injectable()
export class Http {}

@Module({ providers: [Http], exports: [Http] })
export class HttpModule {}
`,
			],
			[
				"/app/profile.module.ts",
				`import { inject, Inject, Injectable, Module } from "@nexus-ioc/core";
import { Http } from "./http.module";

@Injectable()
export class Local {}

@Injectable()
export class ProfileStore {
  readonly local = inject(Local);
  constructor(@Inject(Http) readonly http: Http) {}
}

@Module({ providers: [ProfileStore, Local] })
export class ProfileModule {}
`,
			],
		];

		const moduleNamed = (
			graphModel: ReturnType<typeof buildNexusGraphModel>,
			name: string,
		) => {
			const found = [...graphModel.modules.values()].find(
				(module) => module.name === name,
			);
			if (!found) throw new Error(`${name} not in graph`);
			return found;
		};

		it("contains the child scope's nodes, tagged with their scope", () => {
			const graphModel = buildFiles(CHILD_APP);
			const app = moduleNamed(graphModel, "AppModule");
			const http = moduleNamed(graphModel, "HttpModule");
			const profile = moduleNamed(graphModel, "ProfileModule");

			expect(graphModel.scopes).toEqual([
				{ rootId: app.id, moduleIds: [app.id, http.id] },
				{
					rootId: profile.id,
					declaredInId: app.id,
					parentRootId: app.id,
					moduleIds: [profile.id],
				},
			]);
			expect(app.scope).toBe(app.id);
			expect(http.scope).toBe(app.id);
			expect(profile.scope).toBe(profile.id);
			expect(app.children).toEqual([
				{
					id: profile.id,
					name: "ProfileModule",
					path: "/app/profile.module.ts",
				},
			]);
		});

		it("marks the ProfileStore -> Http edge as cross-scope", () => {
			const graphModel = buildFiles(CHILD_APP);
			const http = moduleNamed(graphModel, "HttpModule").providers[0];
			const store = moduleNamed(graphModel, "ProfileModule").providers.find(
				(provider) => provider.token === "ProfileStore",
			);
			const local = moduleNamed(graphModel, "ProfileModule").providers.find(
				(provider) => provider.token === "Local",
			);

			expect(store?.dependencies).toEqual([
				{ token: "Http", tokenId: http.id, optional: false, crossScope: true },
				{ token: "Local", tokenId: local?.id, optional: false },
			]);
		});

		it("shows the child scope in the JSON output", () => {
			const output = new JsonFormatter(
				buildFiles(CHILD_APP),
				"/app/main.ts",
			).format();

			expect(
				output.modules.map((module) => [module.name, module.scope]),
			).toEqual([
				["AppModule", "AppModule"],
				["HttpModule", "AppModule"],
				["ProfileModule", "ProfileModule"],
			]);
			expect(output.modules[0].children).toEqual([
				{ name: "ProfileModule", path: "/app/profile.module.ts" },
			]);
			const store = output.providers.find(
				(provider) => provider.token === "ProfileStore",
			);
			expect(store?.dependencies).toEqual([
				{ token: "Http", optional: false, crossScope: true },
				{ token: "Local", optional: false },
			]);
		});

		it("adds no scope fields for an app without children", () => {
			const graphModel =
				buildFrom(`import { Injectable, Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";

@Injectable()
export class Http {}

@Module({ providers: [Http] })
export class AppModule {}

NexusApplicationServer.create(AppModule).bootstrap();
`);
			const app = graphModel.modules.get(graphModel.entryModuleId);
			expect(graphModel.scopes).toBeUndefined();
			expect(app && "scope" in app).toBe(false);
			expect(app && "children" in app).toBe(false);

			const output = new JsonFormatter(graphModel, "/app/main.ts").format();
			expect("scope" in output.modules[0]).toBe(false);
			expect("children" in output.modules[0]).toBe(false);
		});

		it("does not report a false cycle across scopes", () => {
			const graphModel = buildFiles([
				[
					"/app/main.ts",
					`import { Inject, Injectable, Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";
import { ChildModule } from "./child.module";

@Injectable()
export class B {}

@Injectable()
export class A {
  constructor(@Inject(B) readonly b: B) {}
}

@Module({ providers: [A, B], children: [ChildModule] })
export class AppModule {}

NexusApplicationServer.create(AppModule).bootstrap();
`,
				],
				[
					"/app/child.module.ts",
					`import { inject, Module } from "@nexus-ioc/core";
import { A, B } from "./main";

@Module({ providers: [{ provide: B, useFactory: () => ({ a: inject(A) }) }] })
export class ChildModule {}
`,
				],
			]);

			const analysis = new CircularDependencyDetector(graphModel).analyze();
			expect(analysis.circularDependencies).toEqual([]);
		});

		it("still reports a real cycle inside a child scope", () => {
			const graphModel = buildFiles([
				[
					"/app/main.ts",
					`import { Module } from "@nexus-ioc/core";
import { NexusApplicationServer } from "./server";
import { ChildModule } from "./child.module";

@Module({ children: [ChildModule] })
export class AppModule {}

NexusApplicationServer.create(AppModule).bootstrap();
`,
				],
				[
					"/app/child.module.ts",
					`import { inject, Injectable, Module } from "@nexus-ioc/core";

@Injectable()
export class C {
  readonly d = inject(D);
}

@Injectable()
export class D {
  readonly c = inject(C);
}

@Module({ providers: [C, D] })
export class ChildModule {}
`,
				],
			]);

			const analysis = new CircularDependencyDetector(graphModel).analyze();
			expect(analysis.providerCircularCount).toBe(1);
			expect(analysis.circularDependencies[0].cycle).toEqual(["C", "D", "C"]);
		});
	});
});
