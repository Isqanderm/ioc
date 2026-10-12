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
		`import { Injectable as Service, Module } from "@nexus-ioc/core";

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
		`import { Injectable as Service, Inject as Dependency, Module } from "@nexus-ioc/core";
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
		`import { Injectable as Service, Module } from "@nexus-ioc/core";

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
		`import { Injectable as Service, Inject as Dependency, Module, Optional as Maybe } from "@nexus-ioc/core";

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
		`import { Injectable as Service, Inject as Dependency, Module } from "@nexus-ioc/core";
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
		`import { Global as NexusGlobal, Module } from "@nexus-ioc/core";

@Module({ providers: [{ provide: "LOGGER", useValue: console }], exports: ["LOGGER"] })
@NexusGlobal()
export class LoggerModule {}
`,
	],
]);

const OWN_PROVIDER_PRECEDENCE_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, Module } from "@nexus-ioc/core";
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
		`import { Module } from "@nexus-ioc/core";

@Module({
  providers: [{ provide: "SHARED_TOKEN", useValue: "imported" }],
  exports: ["SHARED_TOKEN"],
})
export class ImportedModule {}
`,
	],
]);

const END_TO_END_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, Module, Optional as Maybe } from "@nexus-ioc/core";
import { CoreModule } from "./core.module";
import { LoggerModule } from "./logger.module";

@Service()
export class ApiService {
  constructor(
    @Dependency("DATABASE") db: unknown,
    @Dependency("LOGGER") logger: unknown,
    @Dependency("MISSING") @Maybe() missing: unknown,
  ) {}
}

@Module({ imports: [CoreModule, LoggerModule], providers: [ApiService] })
export class AppModule {}
`,
	],
	[
		"/app/core.module.ts",
		`import { Module } from "@nexus-ioc/core";
import { DatabaseModule } from "./database.module";

@Module({ imports: [DatabaseModule], exports: [DatabaseModule] })
export class CoreModule {}
`,
	],
	[
		"/app/database.module.ts",
		`import { Module } from "@nexus-ioc/core";

@Module({
  providers: [{ provide: "DATABASE", useFactory: () => ({}) }],
  exports: ["DATABASE"],
})
export class DatabaseModule {}
`,
	],
	[
		"/app/logger.module.ts",
		`import { Global as NexusGlobal, Module } from "@nexus-ioc/core";

@Module({ providers: [{ provide: "LOGGER", useValue: console }], exports: ["LOGGER"] })
@NexusGlobal()
export class LoggerModule {}
`,
	],
]);

const TOKEN_RE_EXPORT_CHAIN_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, Module } from "@nexus-ioc/core";
import { CoreModule } from "./core.module";

@Service()
export class ApiService {
  constructor(@Dependency("DATABASE") db: unknown) {}
}

@Module({ imports: [CoreModule], providers: [ApiService] })
export class AppModule {}
`,
	],
	[
		"/app/core.module.ts",
		`import { Module } from "@nexus-ioc/core";
import { DatabaseModule } from "./database.module";

@Module({ imports: [DatabaseModule], exports: ["DATABASE"] })
export class CoreModule {}
`,
	],
	[
		"/app/database.module.ts",
		`import { Module } from "@nexus-ioc/core";

@Module({
  providers: [{ provide: "DATABASE", useFactory: () => ({}) }],
  exports: ["DATABASE"],
})
export class DatabaseModule {}
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

	it("resolves an individual token re-exported through an imported module (not the whole module)", () => {
		const { program, entryPoint } = createProgram(
			"/app/app.module.ts",
			"AppModule",
			TOKEN_RE_EXPORT_CHAIN_FILES,
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
	});

	it("resolves a realistic multi-module application end to end", () => {
		const { program, entryPoint } = createProgram(
			"/app/app.module.ts",
			"AppModule",
			END_TO_END_FILES,
		);
		const analyzer = createNexusAnalyzer(program);
		const application =
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
		const graph =
			createNexusApplicationGraphBuilder(analyzer).build(application);

		const resolvedByName = new Map(
			graph.resolved.map((item) => [item.dependencyName, item]),
		);

		expect(resolvedByName.get("db")?.providingModule.name).toBe(
			"DatabaseModule",
		);
		expect(resolvedByName.get("logger")?.providingModule.name).toBe(
			"LoggerModule",
		);
		expect(graph.unresolved).toEqual([]);
	});
});

describe("child scopes declared via children", () => {
	const HTTP = `import { Injectable, Module } from "@nexus-ioc/core";

@Injectable()
export class Http {}

@Module({ providers: [Http], exports: [Http] })
export class HttpModule {}
`;
	const SECRET = `import { Injectable, Module } from "@nexus-ioc/core";

@Injectable()
export class Secret {}

@Module({ providers: [Secret] })
export class SecretModule {}
`;
	const PROFILE = `import { inject, Inject, Injectable, Module } from "@nexus-ioc/core";
import { Http } from "./http.module";
import { Secret } from "./secret.module";

@Injectable()
export class Local {}

@Injectable()
export class ProfileStore {
  readonly viaInject = inject(Http);
  readonly local = inject(Local);
  constructor(
    @Inject(Http) readonly http: Http,
    @Inject(Secret) readonly secret: Secret,
  ) {}
}

@Module({ providers: [ProfileStore, Local] })
export class ProfileModule {}
`;

	function analyzeApp(appSource: string, extra: [string, string][] = []) {
		const files = new Map<string, string>([
			["/app/app.module.ts", appSource],
			["/app/http.module.ts", HTTP],
			["/app/secret.module.ts", SECRET],
			["/app/profile.module.ts", PROFILE],
			...extra,
		]);
		const { program, entryPoint } = createProgram(
			"/app/app.module.ts",
			"AppModule",
			files,
		);
		const analyzer = createNexusAnalyzer(program);
		const application =
			createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
		const graph =
			createNexusApplicationGraphBuilder(analyzer).build(application);
		const idOf = (name: string) => {
			const found = application.classes.find((item) => item.name === name);
			if (!found) throw new Error(`${name} not in application`);
			return found.id;
		};
		const resolvedOf = (className: string, dependencyName: string) =>
			graph.resolved.filter(
				(item) =>
					item.class.name === className &&
					item.dependencyName === dependencyName,
			);
		const unresolvedOf = (className: string) =>
			graph.unresolved
				.filter((item) => item.class.name === className)
				.map((item) => item.dependencyName);
		return { application, graph, idOf, resolvedOf, unresolvedOf };
	}

	const APP = `import { Module } from "@nexus-ioc/core";
import { HttpModule } from "./http.module";
import { SecretModule } from "./secret.module";
import { ProfileModule } from "./profile.module";

@Module({ imports: [HttpModule, SecretModule], children: [ProfileModule] })
export class AppModule {}
`;

	it("gives an app without children exactly one root scope and no fromParentScope edges", () => {
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

		expect(application.scopes).toHaveLength(1);
		expect(application.scopes[0]).toEqual({
			rootId: application.classes[0].id,
			classIds: application.classes.map((item) => item.id),
		});
		expect(graph.resolved.length).toBeGreaterThan(0);
		expect(graph.resolved.every((item) => item.fromParentScope === false)).toBe(
			true,
		);
	});

	it("creates a child scope declared in AppModule", () => {
		const { application, idOf } = analyzeApp(APP);

		expect(application.scopes).toHaveLength(2);
		const [root, child] = application.scopes;
		expect(root.rootId).toBe(idOf("AppModule"));
		expect(root.declaredInId).toBeUndefined();
		expect(root.parentRootId).toBeUndefined();
		expect(root.classIds).not.toContain(idOf("ProfileStore"));
		expect(child.rootId).toBe(idOf("ProfileModule"));
		expect(child.declaredInId).toBe(idOf("AppModule"));
		expect(child.parentRootId).toBe(idOf("AppModule"));
		expect(child.classIds).toContain(idOf("ProfileStore"));
		expect(child.classIds).toContain(idOf("Local"));
	});

	it("resolves a parent-provided @Inject and inject() dependency with fromParentScope", () => {
		const { resolvedOf } = analyzeApp(APP);

		const [http] = resolvedOf("ProfileStore", "http");
		expect(http?.fromParentScope).toBe(true);
		expect(http?.providingModule.name).toBe("HttpModule");

		const [viaInject] = resolvedOf("ProfileStore", "viaInject");
		expect(viaInject?.fromParentScope).toBe(true);
		expect(viaInject?.providingModule.name).toBe("HttpModule");

		const [local] = resolvedOf("ProfileStore", "local");
		expect(local?.fromParentScope).toBe(false);
		expect(local?.providingModule.name).toBe("ProfileModule");
	});

	it("keeps a provider the declaring module cannot see unresolved", () => {
		const { unresolvedOf } = analyzeApp(APP);
		expect(unresolvedOf("ProfileStore")).toEqual(["secret"]);
	});

	it("resolves the same way for a lazy() child", () => {
		const { application, resolvedOf, unresolvedOf, idOf } =
			analyzeApp(`import { lazy, Module } from "@nexus-ioc/core";
import { HttpModule } from "./http.module";
import { SecretModule } from "./secret.module";

@Module({
  imports: [HttpModule, SecretModule],
  children: [lazy(() => import("./profile.module").then((m) => m.ProfileModule))],
})
export class AppModule {}
`);
		expect(application.scopes.map((scope) => scope.rootId)).toEqual([
			idOf("AppModule"),
			idOf("ProfileModule"),
		]);
		expect(resolvedOf("ProfileStore", "http")[0]?.fromParentScope).toBe(true);
		expect(unresolvedOf("ProfileStore")).toEqual(["secret"]);
	});

	it("lets a child's own provider win over the parent's", () => {
		const { resolvedOf } = analyzeApp(APP, [
			[
				"/app/profile.module.ts",
				`import { Inject, Injectable, Module } from "@nexus-ioc/core";
import { Http } from "./http.module";

@Injectable()
export class ProfileStore {
  constructor(@Inject(Http) readonly http: Http) {}
}

@Module({ providers: [ProfileStore, { provide: Http, useValue: {} }] })
export class ProfileModule {}
`,
			],
		]);
		const [http] = resolvedOf("ProfileStore", "http");
		expect(http?.fromParentScope).toBe(false);
		expect(http?.providingModule.name).toBe("ProfileModule");
	});

	it("falls back to the declaring module's visibility, not the root's", () => {
		const { application, resolvedOf, unresolvedOf, idOf } = analyzeApp(
			`import { Injectable, Module } from "@nexus-ioc/core";
import { FeatureModule } from "./feature.module";

@Injectable()
export class RootOnly {}

@Module({ imports: [FeatureModule], providers: [RootOnly] })
export class AppModule {}
`,
			[
				[
					"/app/feature.module.ts",
					`import { Injectable, Module } from "@nexus-ioc/core";
import { HttpModule } from "./http.module";
import { ProfileModule } from "./profile.module";

@Injectable()
export class FeatureOwn {}

@Module({ imports: [HttpModule], providers: [FeatureOwn], children: [ProfileModule] })
export class FeatureModule {}
`,
				],
				[
					"/app/profile.module.ts",
					`import { Inject, Injectable, Module } from "@nexus-ioc/core";
import { Http } from "./http.module";
import { FeatureOwn } from "./feature.module";
import { RootOnly } from "./app.module";

@Injectable()
export class ProfileStore {
  constructor(
    @Inject(Http) readonly http: Http,
    @Inject(FeatureOwn) readonly own: FeatureOwn,
    @Inject(RootOnly) readonly rootOnly: RootOnly,
  ) {}
}

@Module({ providers: [ProfileStore] })
export class ProfileModule {}
`,
				],
			],
		);
		const child = application.scopes[1];
		expect(child.declaredInId).toBe(idOf("FeatureModule"));
		expect(child.parentRootId).toBe(idOf("AppModule"));
		expect(resolvedOf("ProfileStore", "http")[0]?.fromParentScope).toBe(true);
		expect(resolvedOf("ProfileStore", "own")[0]?.providingModule.name).toBe(
			"FeatureModule",
		);
		expect(unresolvedOf("ProfileStore")).toEqual(["rootOnly"]);
	});

	it("recurses up the chain for a grandchild scope", () => {
		const { application, resolvedOf, idOf } = analyzeApp(APP, [
			[
				"/app/profile.module.ts",
				`import { Injectable, Module } from "@nexus-ioc/core";
import { SettingsModule } from "./settings.module";

@Injectable()
export class Local {}

@Module({ providers: [Local], children: [SettingsModule] })
export class ProfileModule {}
`,
			],
			[
				"/app/settings.module.ts",
				`import { Inject, Injectable, Module } from "@nexus-ioc/core";
import { Http } from "./http.module";
import { Local } from "./profile.module";

@Injectable()
export class SettingsStore {
  constructor(
    @Inject(Http) readonly http: Http,
    @Inject(Local) readonly local: Local,
  ) {}
}

@Module({ providers: [SettingsStore] })
export class SettingsModule {}
`,
			],
		]);
		expect(application.scopes).toHaveLength(3);
		const grandchild = application.scopes[2];
		expect(grandchild.rootId).toBe(idOf("SettingsModule"));
		expect(grandchild.declaredInId).toBe(idOf("ProfileModule"));
		expect(grandchild.parentRootId).toBe(idOf("ProfileModule"));
		expect(resolvedOf("SettingsStore", "http")[0]?.providingModule.name).toBe(
			"HttpModule",
		);
		expect(resolvedOf("SettingsStore", "http")[0]?.fromParentScope).toBe(true);
		expect(resolvedOf("SettingsStore", "local")[0]?.fromParentScope).toBe(true);
	});

	it("does not crash on an unresolvable lazy child and adds no scope for it", () => {
		const { application } =
			analyzeApp(`import { lazy, Module } from "@nexus-ioc/core";

declare function load(): Promise<any>;

@Module({ children: [lazy(() => load())] })
export class AppModule {}
`);
		expect(application.scopes).toHaveLength(1);
	});
});
