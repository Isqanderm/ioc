import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import { createNexusAnalyzer } from "../src";

const SOURCE = `
import {
  DynamicModule,
  Global as NexusGlobal,
  Inject as Dependency,
  Injectable as Service,
  NsModule as Module,
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

	it("returns semantic tokens for every InjectionToken variant", () => {
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

	it("parses @NsModule providers into semantic NexusProvider entries", () => {
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

	it("parses @NsModule imports and exports into semantic tokens", () => {
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

	it("attaches module metadata to NexusClass.module for @NsModule classes", () => {
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
});
