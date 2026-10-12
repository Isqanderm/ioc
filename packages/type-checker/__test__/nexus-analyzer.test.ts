import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import {
	createNexusAnalyzer,
	createNexusApplicationAnalyzer,
	createNexusApplicationGraphBuilder,
} from "../src";

const SOURCE = `
import {
  DynamicModule,
  Global as NexusGlobal,
  Inject as Dependency,
  Injectable as Service,
  Module,
  Optional as Maybe,
  Scope,
} from "@nexus-ioc/core";
import { Inject as ForeignInject, Injectable as ForeignService } from "./foreign";

const SYMBOL_TOKEN = Symbol("symbol");

class DependencyA {}
abstract class AbstractDependency {}
function FunctionDependency() {}

@Service()
class ServiceA {
  constructor(
    @Dependency(DependencyA) dependency: DependencyA,
    @Dependency("config") @Maybe() config: unknown,
    @Dependency(SYMBOL_TOKEN) symbol: unknown,
    @Dependency(AbstractDependency) abstractDependency: AbstractDependency,
    @Dependency(FunctionDependency) functionDependency: typeof FunctionDependency,
  ) {}

  @Dependency("logger")
  private logger!: unknown;
}

@Module({})
class AppModule {}

@Module({})
@NexusGlobal()
class GlobalModule {}

@Service()
class ProviderModuleService {}

@Service()
class ProviderModuleServiceImpl {}

@Module({
  providers: [
    ProviderModuleService,
    { provide: ProviderModuleService, useClass: ProviderModuleServiceImpl, scope: Scope.Transient },
    { provide: "CONFIG", useValue: { debug: true } },
    { provide: "DATABASE", useFactory: (config: unknown) => config, inject: ["CONFIG", DependencyA] },
  ],
})
class ProviderModule {}

const useValue = 42;

@Module({
  providers: [{ provide: "SHORTHAND_TOKEN", useValue }],
})
class ShorthandProviderModule {}

@Module({
  providers: [{ "provide": "QUOTED_TOKEN", "useValue": 1 }],
})
class QuotedKeyProviderModule {}

@Service()
class SpreadElementService {}

const commonProviders = [SpreadElementService];

@Module({
  providers: [...commonProviders],
})
class SpreadProviderModule {}

@Module({})
class LocalImportedModule {}

@Module({
  imports: [LocalImportedModule],
  exports: [ProviderModuleService, "CONFIG"],
})
class ExportingModule {}

@Module({})
class DynamicFeatureModule {
  static forRoot(): DynamicModule {
    return { module: DynamicFeatureModule };
  }
}

@Module({
  imports: [DynamicFeatureModule.forRoot()],
})
class DynamicImportingModule {}

@ForeignService()
class ForeignServiceClass {}

class ForeignInjected {
  constructor(@ForeignInject(DependencyA) dependency: DependencyA) {}
}

@Service()
class InjectableCandidate {}

class PlainCandidate {}

@Service()
class ServiceWithUndeclaredDependency {
  constructor(
    @Dependency(DependencyA) declared: DependencyA,
    injectable: InjectableCandidate,
    plain: PlainCandidate,
    primitive: string,
  ) {}

  plainProperty!: PlainCandidate;
}
`;

const FOREIGN = `
export function Inject(...args: unknown[]): ClassDecorator & ParameterDecorator {
  return () => undefined;
}

export function Injectable(): ClassDecorator {
  return () => undefined;
}
`;

function createProgram(): { program: ts.Program; sourceFile: ts.SourceFile } {
	const files = new Map<string, string>([
		["/nexus-test.ts", SOURCE],
		["/foreign.ts", FOREIGN],
	]);
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

				if (moduleName === "./foreign") {
					return {
						resolvedFileName: "/foreign.ts",
						extension: ts.Extension.Ts,
						isExternalLibraryImport: false,
					};
				}

				return ts.resolveModuleName(moduleName, containingFile, options, host)
					.resolvedModule;
			}),
	};

	const program = ts.createProgram(["/nexus-test.ts"], options, host);
	const sourceFile = program.getSourceFile("/nexus-test.ts");
	if (!sourceFile) throw new Error("Test source file was not created");

	return { program, sourceFile };
}

const NEXUS_IOC_SOURCE = `
import { Injectable as Service } from "nexus-ioc";

@Service()
class PublishedService {}
`;

function createNexusIocProgram(): {
	program: ts.Program;
	sourceFile: ts.SourceFile;
} {
	const files = new Map<string, string>([
		["/nexus-ioc-test.ts", NEXUS_IOC_SOURCE],
	]);
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
				if (moduleName === "nexus-ioc") {
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

	const program = ts.createProgram(["/nexus-ioc-test.ts"], options, host);
	const sourceFile = program.getSourceFile("/nexus-ioc-test.ts");
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
	expectedText: string,
): void {
	expect(span.fileName).toBe(sourceFile.fileName);
	expect(span.end - span.start).toBe(span.length);
	expect(sourceFile.text.slice(span.start, span.end)).toBe(expectedText);
}

describe("NexusAnalyzer", () => {
	it("returns an AST-independent NexusClass", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const service = analyzer.getClass(getClass(sourceFile, "ServiceA"));

		expect(service.name).toBe("ServiceA");
		expect(service.isInjectable).toBe(true);
		expect(service.isModule).toBe(false);
		expect(service.isGlobal).toBe(false);
		expect(service).not.toHaveProperty("node");
		expectSourceSpan(
			sourceFile,
			service.source,
			'@Service()\nclass ServiceA {\n  constructor(\n    @Dependency(DependencyA) dependency: DependencyA,\n    @Dependency("config") @Maybe() config: unknown,\n    @Dependency(SYMBOL_TOKEN) symbol: unknown,\n    @Dependency(AbstractDependency) abstractDependency: AbstractDependency,\n    @Dependency(FunctionDependency) functionDependency: typeof FunctionDependency,\n  ) {}\n\n  @Dependency("logger")\n  private logger!: unknown;\n}',
		);
	});

	it("preserves semantic dependency information without AST declarations", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const service = analyzer.getClass(getClass(sourceFile, "ServiceA"));
		const [dependency, config, , , , property] = service.dependencies;

		expect(dependency).toMatchObject({
			location: "constructor",
			name: "dependency",
			optional: false,
		});
		expect(dependency).not.toHaveProperty("declaration");
		expect(dependency).not.toHaveProperty("parameterType");
		expectSourceSpan(
			sourceFile,
			dependency.source,
			"@Dependency(DependencyA) dependency: DependencyA",
		);

		expect(config).toMatchObject({
			location: "constructor",
			name: "config",
			optional: true,
		});
		expect(config).not.toHaveProperty("declaration");

		expect(property).toMatchObject({
			location: "property",
			name: "logger",
			optional: false,
		});
		expect(property).not.toHaveProperty("declaration");
	});

	it("returns semantic decorators without AST nodes", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const service = analyzer.getClass(getClass(sourceFile, "ServiceA"));
		const injectable = service.decorators.find(
			(decorator) => decorator.kind === "Injectable",
		);

		expect(injectable).toBeDefined();
		if (!injectable) throw new Error("Injectable decorator not found");
		expect(injectable).not.toHaveProperty("declaration");
		expect(injectable).not.toHaveProperty("expression");
		expectSourceSpan(sourceFile, injectable.source, "@Service()");
	});

	it("returns semantic tokens for every ProviderToken variant", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const service = analyzer.getClass(getClass(sourceFile, "ServiceA"));
		const [
			classDependency,
			stringDependency,
			symbolDependency,
			abstractDependency,
			functionDependency,
		] = service.dependencies;

		expect(classDependency.token).toMatchObject({ kind: "reference" });
		if (classDependency.token?.kind !== "reference") {
			throw new Error("Class token was not resolved");
		}
		expect(classDependency.token.symbol.getName()).toBe("DependencyA");
		expectSourceSpan(sourceFile, classDependency.token.source, "DependencyA");

		expect(stringDependency.token).toMatchObject({
			kind: "string",
			value: "config",
		});
		if (stringDependency.token?.kind !== "string") {
			throw new Error("String token was not resolved");
		}
		expectSourceSpan(sourceFile, stringDependency.token.source, '"config"');

		expect(symbolDependency.token).toMatchObject({ kind: "symbol" });
		if (symbolDependency.token?.kind !== "symbol") {
			throw new Error("Symbol token was not resolved");
		}
		expectSourceSpan(sourceFile, symbolDependency.token.source, "SYMBOL_TOKEN");

		expect(abstractDependency.token).toMatchObject({ kind: "reference" });
		if (abstractDependency.token?.kind !== "reference") {
			throw new Error("Abstract token was not resolved");
		}
		expect(abstractDependency.token.symbol.getName()).toBe(
			"AbstractDependency",
		);
		expectSourceSpan(
			sourceFile,
			abstractDependency.token.source,
			"AbstractDependency",
		);

		expect(functionDependency.token).toMatchObject({ kind: "reference" });
		if (functionDependency.token?.kind !== "reference") {
			throw new Error("Function token was not resolved");
		}
		expect(functionDependency.token.symbol.getName()).toBe(
			"FunctionDependency",
		);
		expectSourceSpan(
			sourceFile,
			functionDependency.token.source,
			"FunctionDependency",
		);
	});

	it("preserves module and global module semantics", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const module = analyzer.getClass(getClass(sourceFile, "AppModule"));
		const globalModule = analyzer.getClass(
			getClass(sourceFile, "GlobalModule"),
		);

		expect(module.isModule).toBe(true);
		expect(module.isGlobal).toBe(false);
		expect(globalModule.isModule).toBe(true);
		expect(globalModule.isGlobal).toBe(true);
	});

	it("does not treat same-named foreign decorators as Nexus decorators", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const foreignService = analyzer.getClass(
			getClass(sourceFile, "ForeignServiceClass"),
		);
		const foreignInjected = analyzer.getClass(
			getClass(sourceFile, "ForeignInjected"),
		);

		expect(foreignService.isInjectable).toBe(false);
		expect(foreignService.decorators).toHaveLength(0);
		expect(foreignInjected.dependencies).toHaveLength(0);
	});

	it('recognizes decorators imported from the published "nexus-ioc" package by default', () => {
		const { program, sourceFile } = createNexusIocProgram();
		const analyzer = createNexusAnalyzer(program);

		const service = analyzer.getClass(getClass(sourceFile, "PublishedService"));

		expect(service.isInjectable).toBe(true);
		expect(service.decorators).toHaveLength(1);
		expect(service.decorators[0].kind).toBe("Injectable");
	});

	it("keeps getClassModel as a compatibility wrapper", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const service = analyzer.getClassModel(getClass(sourceFile, "ServiceA"));

		expect(service.name).toBe("ServiceA");
		expect(service).not.toHaveProperty("node");
	});

	it("parses @Module providers into semantic NexusProvider entries", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const providers = analyzer.getModuleProviders(
			getClass(sourceFile, "ProviderModule"),
		);

		expect(providers).toHaveLength(4);

		const [
			classProvider,
			useClassProvider,
			useValueProvider,
			useFactoryProvider,
		] = providers;

		expect(classProvider.kind).toBe("class");
		expect(classProvider.provide).toMatchObject({ kind: "reference" });
		expect(classProvider.factoryInject).toEqual([]);

		expect(useClassProvider.kind).toBe("useClass");
		expect(useClassProvider.provide).toMatchObject({ kind: "reference" });
		expect(useClassProvider.useClass).toMatchObject({ kind: "reference" });
		expect(useClassProvider.scope).toMatchObject({ kind: "reference" });

		expect(useValueProvider.kind).toBe("useValue");
		expect(useValueProvider.provide).toMatchObject({
			kind: "string",
			value: "CONFIG",
		});
		expect(useValueProvider.useClass).toBeUndefined();

		expect(useFactoryProvider.kind).toBe("useFactory");
		expect(useFactoryProvider.provide).toMatchObject({
			kind: "string",
			value: "DATABASE",
		});
		expect(useFactoryProvider.factoryInject).toHaveLength(2);
		expect(useFactoryProvider.factoryInject[0]).toMatchObject({
			kind: "string",
			value: "CONFIG",
		});
		expect(useFactoryProvider.factoryInject[1]).toMatchObject({
			kind: "reference",
		});

		for (const provider of providers) {
			expect(provider).not.toHaveProperty("declaration");
			expect(provider).not.toHaveProperty("expression");
		}
	});

	it("parses @Module imports and exports into semantic tokens", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const module = analyzer.getModule(getClass(sourceFile, "ExportingModule"));
		if (!module)
			throw new Error("Expected ExportingModule to be a NexusModule");

		expect(module.imports).toHaveLength(1);
		expect(module.imports[0].isDynamic).toBe(false);
		expect(module.imports[0].module).toMatchObject({ kind: "reference" });
		if (module.imports[0].module.kind !== "reference")
			throw new Error("unreachable");
		expect(module.imports[0].module.symbol.getName()).toBe(
			"LocalImportedModule",
		);

		expect(module.exports).toHaveLength(2);
		expect(module.exports[0].token).toMatchObject({ kind: "reference" });
		expect(module.exports[1].token).toMatchObject({
			kind: "string",
			value: "CONFIG",
		});
	});

	it("returns undefined for getModule() on a non-module class", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		expect(
			analyzer.getModule(getClass(sourceFile, "ServiceA")),
		).toBeUndefined();
	});

	it("resolves a dynamic-module import (Foo.forRoot()) to the concrete module class", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const module = analyzer.getModule(
			getClass(sourceFile, "DynamicImportingModule"),
		);
		if (!module) {
			throw new Error("Expected DynamicImportingModule to be a NexusModule");
		}

		expect(module.imports).toHaveLength(1);
		expect(module.imports[0].isDynamic).toBe(true);
		expect(module.imports[0].module).toMatchObject({ kind: "reference" });
		if (module.imports[0].module.kind !== "reference") {
			throw new Error("unreachable");
		}
		expect(module.imports[0].module.symbol.getName()).toBe(
			"DynamicFeatureModule",
		);
	});

	it("attaches module metadata to NexusClass.module for @Module classes", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const exportingModule = analyzer.getClass(
			getClass(sourceFile, "ExportingModule"),
		);
		expect(exportingModule.module).toBeDefined();
		expect(exportingModule.module?.imports).toHaveLength(1);

		const service = analyzer.getClass(getClass(sourceFile, "ServiceA"));
		expect(service.module).toBeUndefined();
	});

	it("resolves a shorthand useValue provider property (`{ provide, useValue }`)", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const providers = analyzer.getModuleProviders(
			getClass(sourceFile, "ShorthandProviderModule"),
		);

		expect(providers).toHaveLength(1);
		const [provider] = providers;
		expect(provider.kind).toBe("useValue");
		expect(provider.provide).toMatchObject({
			kind: "string",
			value: "SHORTHAND_TOKEN",
		});
	});

	it('resolves a quoted-key provider object literal (`{ "provide": ..., "useValue": ... }`)', () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const providers = analyzer.getModuleProviders(
			getClass(sourceFile, "QuotedKeyProviderModule"),
		);

		expect(providers).toHaveLength(1);
		const [provider] = providers;
		expect(provider.kind).toBe("useValue");
		expect(provider.provide).toMatchObject({
			kind: "string",
			value: "QUOTED_TOKEN",
		});
	});

	it("skips a spread element in a providers array instead of emitting a bogus class provider", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const providers = analyzer.getModuleProviders(
			getClass(sourceFile, "SpreadProviderModule"),
		);

		expect(providers).toEqual([]);
	});

	it("assigns a stable file:line:col id to a class", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const node = getClass(sourceFile, "ServiceA");

		const service = analyzer.getClass(node);
		const { line, character } = ts.getLineAndCharacterOfPosition(
			sourceFile,
			node.getStart(),
		);

		expect(service.id).toBe(
			`${sourceFile.fileName}:${line + 1}:${character + 1}`,
		);
	});

	it("gives different classes in the same file different ids", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const service = analyzer.getClass(getClass(sourceFile, "ServiceA"));
		const appModule = analyzer.getClass(getClass(sourceFile, "AppModule"));

		expect(service.id).not.toBe(appModule.id);
	});

	it("flags typed constructor parameters and properties without @Inject as undeclared dependencies", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const service = analyzer.getClass(
			getClass(sourceFile, "ServiceWithUndeclaredDependency"),
		);

		expect(service.dependencies).toHaveLength(1);
		expect(service.dependencies[0]).toMatchObject({
			name: "declared",
			index: 0,
		});

		const [injectable, plainParameter, plainProperty] =
			service.undeclaredDependencies;

		expect(injectable).toMatchObject({
			location: "constructor",
			name: "injectable",
			index: 1,
			isInferredTypeInjectable: true,
		});
		if (injectable.inferredType.kind !== "reference") {
			throw new Error(
				"Expected InjectableCandidate to resolve to a reference token",
			);
		}
		expect(injectable.inferredType.symbol.getName()).toBe(
			"InjectableCandidate",
		);

		expect(plainParameter).toMatchObject({
			location: "constructor",
			name: "plain",
			index: 2,
			isInferredTypeInjectable: false,
		});

		expect(plainProperty).toMatchObject({
			location: "property",
			name: "plainProperty",
			isInferredTypeInjectable: false,
		});
		expect(plainProperty.index).toBeUndefined();

		expect(
			service.undeclaredDependencies.some((item) => item.name === "primitive"),
		).toBe(false);
		expect(service.undeclaredDependencies).toHaveLength(3);
	});
});

function createMultiFileProgram(files: Map<string, string>): ts.Program {
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
			files.has(fileName) || defaultHost.fileExists(fileName),
		readFile: (fileName) =>
			files.get(fileName) ?? defaultHost.readFile(fileName),
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
					const resolvedFileName = `${path.posix.join(
						path.posix.dirname(containingFile),
						moduleName,
					)}.ts`;
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
	return ts.createProgram([...files.keys()], options, host);
}

describe("InjectionToken identity", () => {
	it("gives the same id to @Inject(CONFIG) and { provide: CONFIG } across a re-export", () => {
		const program = createMultiFileProgram(
			new Map([
				[
					"/app/tokens.ts",
					`import { InjectionToken } from "@nexus-ioc/core";
export const CONFIG = new InjectionToken<{ url: string }>("CONFIG");
`,
				],
				["/app/index.ts", `export { CONFIG } from "./tokens";\n`],
				[
					"/app/app.module.ts",
					`import { Module } from "@nexus-ioc/core";
import { CONFIG } from "./index";
import { Svc } from "./svc";

@Module({ providers: [Svc, { provide: CONFIG, useValue: { url: "x" } }] })
export class AppModule {}
`,
				],
				[
					"/app/svc.ts",
					`import { Inject, Injectable } from "@nexus-ioc/core";
import { CONFIG } from "./tokens";

@Injectable()
export class Svc {
  constructor(@Inject(CONFIG) cfg: { url: string }) {}
}
`,
				],
			]),
		);
		const analyzer = createNexusAnalyzer(program);
		const moduleFile = program.getSourceFile("/app/app.module.ts");
		const svcFile = program.getSourceFile("/app/svc.ts");
		if (!moduleFile || !svcFile) throw new Error("Source files not created");

		const appModule = analyzer.getClass(getClass(moduleFile, "AppModule"));
		const svc = analyzer.getClass(getClass(svcFile, "Svc"));

		const providerToken = appModule.module?.providers[1].provide;
		const dependencyToken = svc.dependencies[0].token;
		expect(providerToken?.kind).toBe("reference");
		expect(dependencyToken?.kind).toBe("reference");
		if (
			providerToken?.kind !== "reference" ||
			dependencyToken?.kind !== "reference"
		) {
			throw new Error("InjectionToken was not resolved to a reference");
		}
		expect(providerToken.symbol.getName()).toBe("CONFIG");
		expect(dependencyToken.id).toBe(providerToken.id);
		expect(dependencyToken.id).toContain("/app/tokens.ts:");

		const application = createNexusApplicationAnalyzer(analyzer).analyze(
			getClass(moduleFile, "AppModule"),
		);
		const graph =
			createNexusApplicationGraphBuilder(analyzer).build(application);
		expect(graph.unresolved).toEqual([]);
		const edge = graph.resolved.find(
			(entry) => entry.class.name === "Svc" && entry.dependencyName === "cfg",
		);
		expect(edge).toBeDefined();
		const provide = edge?.provider.provide;
		expect(provide?.kind).toBe("reference");
		if (provide?.kind === "reference") {
			expect(provide.symbol.getName()).toBe("CONFIG");
		}
	});

	it("gives different ids to two InjectionTokens with the same description", () => {
		const program = createMultiFileProgram(
			new Map([
				[
					"/app/tokens.ts",
					`import { InjectionToken } from "@nexus-ioc/core";
export const A = new InjectionToken<string>("SAME");
export const B = new InjectionToken<string>("SAME");
`,
				],
				[
					"/app/svc.ts",
					`import { Inject, Injectable } from "@nexus-ioc/core";
import { A, B } from "./tokens";

@Injectable()
export class Svc {
  constructor(@Inject(A) a: string, @Inject(B) b: string) {}
}
`,
				],
			]),
		);
		const analyzer = createNexusAnalyzer(program);
		const svcFile = program.getSourceFile("/app/svc.ts");
		if (!svcFile) throw new Error("Source file not created");

		const svc = analyzer.getClass(getClass(svcFile, "Svc"));
		const [a, b] = svc.dependencies.map((dependency) => dependency.token);
		if (a?.kind !== "reference" || b?.kind !== "reference") {
			throw new Error("InjectionToken was not resolved to a reference");
		}
		expect(a.id).not.toBe(b.id);
	});
});

describe("inject() dependencies", () => {
	const TOKENS = `import { InjectionToken } from "@nexus-ioc/core";
export const CONFIG = new InjectionToken<{ url: string }>("CONFIG");
export class Http {}
export class X {}
export class Late {}
`;

	function analyze(source: string, extra: [string, string][] = []) {
		const program = createMultiFileProgram(
			new Map([["/app/tokens.ts", TOKENS], ...extra, ["/app/svc.ts", source]]),
		);
		const analyzer = createNexusAnalyzer(program);
		const file = program.getSourceFile("/app/svc.ts");
		const tokensFile = program.getSourceFile("/app/tokens.ts");
		if (!file || !tokensFile) throw new Error("Source files not created");
		const idOf = (name: string) => {
			const statement = tokensFile.statements.find(
				(item) =>
					(ts.isClassDeclaration(item) && item.name?.text === name) ||
					(ts.isVariableStatement(item) &&
						item.declarationList.declarations.some(
							(declaration) =>
								ts.isIdentifier(declaration.name) &&
								declaration.name.text === name,
						)),
			);
			if (!statement) throw new Error(`${name} not found`);
			const node = ts.isVariableStatement(statement)
				? statement.declarationList.declarations[0]
				: statement;
			const { line, character } = ts.getLineAndCharacterOfPosition(
				tokensFile,
				node.getStart(),
			);
			return `/app/tokens.ts:${line + 1}:${character + 1}`;
		};
		return { analyzer, file, idOf };
	}

	const tokenId = (token: unknown) =>
		(token as { id?: string } | undefined)?.id;

	it("reports a field-initializer inject() as a dependency named after the field", () => {
		const { analyzer, file, idOf } =
			analyze(`import { inject, Injectable } from "@nexus-ioc/core";
import { Http } from "./tokens";

@Injectable()
export class Api {
  readonly http: Http = inject(Http);
}
`);
		const api = analyzer.getClass(getClass(file, "Api"));
		expect(api.dependencies).toHaveLength(1);
		const [dependency] = api.dependencies;
		expect(dependency.location).toBe("inject");
		expect(dependency.name).toBe("http");
		expect(dependency.index).toBeUndefined();
		expect(dependency.optional).toBe(false);
		expect(dependency.token?.kind).toBe("reference");
		expect(tokenId(dependency.token)).toBe(idOf("Http"));
		expectSourceSpan(file, dependency.source, "inject(Http)");
		// Typed + initialised by inject() must not be flagged as missing @Inject.
		expect(api.undeclaredDependencies).toEqual([]);
	});

	it("reports a constructor-body inject() with optional: true", () => {
		const { analyzer, file, idOf } =
			analyze(`import { inject as get, Injectable } from "@nexus-ioc/core";
import { CONFIG } from "./tokens";

@Injectable()
export class Api {
  private cfg: { url: string } | undefined;
  constructor() {
    this.cfg = get(CONFIG, { optional: true });
  }
}
`);
		const api = analyzer.getClass(getClass(file, "Api"));
		expect(api.dependencies).toHaveLength(1);
		const [dependency] = api.dependencies;
		expect(dependency.location).toBe("inject");
		expect(dependency.name).toBe("constructor");
		expect(dependency.optional).toBe(true);
		expect(tokenId(dependency.token)).toBe(idOf("CONFIG"));
	});

	it("treats a non-literal or false optional flag as not optional", () => {
		const { analyzer, file } =
			analyze(`import { inject, Injectable } from "@nexus-ioc/core";
import { Http, X } from "./tokens";
const opts = { optional: true };

@Injectable()
export class Api {
  a = inject(Http, { optional: false });
  b = inject(X, opts);
}
`);
		const api = analyzer.getClass(getClass(file, "Api"));
		expect(api.dependencies.map((item) => item.optional)).toEqual([
			false,
			false,
		]);
	});

	it("does not report inject() in methods, lifecycle hooks, nested functions or static fields", () => {
		const { analyzer, file } =
			analyze(`import { inject, Injectable } from "@nexus-ioc/core";
import { Http, X } from "./tokens";

@Injectable()
export class Api {
  static shared = inject(X);
  lazy = () => inject(X);
  nested = { get: function () { return inject(X); } };
  run() { inject(X); }
  onModuleInit() { inject(X); }
  get value() { return inject(X); }
  http = inject(Http);
  constructor() {
    setTimeout(() => inject(X));
  }
}
`);
		const api = analyzer.getClass(getClass(file, "Api"));
		expect(api.dependencies.map((item) => item.name)).toEqual(["http"]);
	});

	it("reports inject() in a constructor parameter default under the parameter name", () => {
		const { analyzer, file, idOf } =
			analyze(`import { inject, Injectable } from "@nexus-ioc/core";
import { Http } from "./tokens";

@Injectable()
export class Api {
  constructor(private readonly http: Http = inject(Http)) {}
}
`);
		const api = analyzer.getClass(getClass(file, "Api"));
		expect(api.dependencies.map((item) => [item.location, item.name])).toEqual([
			["inject", "http"],
		]);
		expect(tokenId(api.dependencies[0].token)).toBe(idOf("Http"));
		expect(api.undeclaredDependencies).toEqual([]);
	});

	it("does not report a local function named inject", () => {
		const { analyzer, file } =
			analyze(`import { Injectable } from "@nexus-ioc/core";
import { Http } from "./tokens";
function inject<T>(token: unknown): T { return undefined as T; }

@Injectable()
export class Api {
  http = inject<Http>(Http);
}
`);
		const api = analyzer.getClass(getClass(file, "Api"));
		expect(api.dependencies).toEqual([]);
	});

	it("recognises inject imported through a re-export of @nexus-ioc/core", () => {
		const { analyzer, file, idOf } = analyze(
			`import { Injectable } from "@nexus-ioc/core";
import { inject } from "./di";
import { Http } from "./tokens";

@Injectable()
export class Api {
  http = inject(Http);
}
`,
			[["/app/di.ts", `export { inject } from "@nexus-ioc/core";\n`]],
		);
		const api = analyzer.getClass(getClass(file, "Api"));
		expect(api.dependencies).toHaveLength(1);
		expect(tokenId(api.dependencies[0].token)).toBe(idOf("Http"));
	});

	it("keeps @Inject dependencies first and in their original order", () => {
		const { analyzer, file } =
			analyze(`import { Inject, inject, Injectable } from "@nexus-ioc/core";
import { Http, X } from "./tokens";

@Injectable()
export class Api {
  http = inject(Http);
  constructor(@Inject(X) readonly x: X) {}
}
`);
		const api = analyzer.getClass(getClass(file, "Api"));
		expect(
			api.dependencies.map((item) => [item.location, item.name, item.index]),
		).toEqual([
			["constructor", "x", 0],
			["inject", "http", undefined],
		]);
	});

	it("adds a useFactory's synchronous inject() calls to factoryInject, stopping at the first unconditional await", () => {
		const { analyzer, file, idOf } =
			analyze(`import { inject, Module } from "@nexus-ioc/core";
import { CONFIG, Http, Late, X } from "./tokens";

@Module({
  providers: [
    {
      provide: "A",
      useFactory: (cfg: unknown) => ({ cfg, http: inject(Http) }),
      inject: [CONFIG],
    },
    {
      provide: "B",
      useFactory: async () => {
        const x = inject(X);
        if (Math.random() > 0.5) {
          await Promise.resolve();
        }
        const cfg = inject(CONFIG);
        await load(inject(Http));
        const late = inject(Late);
        return { x, cfg, late };
      },
    },
  ],
})
export class AppModule {}

async function load(value: unknown) { return value; }
`);
		const module = analyzer.getClass(getClass(file, "AppModule")).module;
		const ids = (index: number) =>
			module?.providers[index].factoryInject.map((token) => tokenId(token));
		expect(ids(0)).toEqual([idOf("CONFIG"), idOf("Http")]);
		expect(ids(1)).toEqual([idOf("X"), idOf("CONFIG"), idOf("Http")]);
	});
});
