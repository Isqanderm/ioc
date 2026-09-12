import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import { createNexusAnalyzer } from "../src";

const SOURCE = `
import {
  Global as NexusGlobal,
  Inject as Dependency,
  Injectable as Service,
  NsModule as Module,
  Optional as Maybe,
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
			"@Service()\nclass ServiceA {\n  constructor(\n    @Dependency(DependencyA) dependency: DependencyA,\n    @Dependency(\"config\") @Maybe() config: unknown,\n    @Dependency(SYMBOL_TOKEN) symbol: unknown,\n    @Dependency(AbstractDependency) abstractDependency: AbstractDependency,\n    @Dependency(FunctionDependency) functionDependency: typeof FunctionDependency,\n  ) {}\n\n  @Dependency(\"logger\")\n  private logger!: unknown;\n}",
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
		const [classDependency, stringDependency, symbolDependency, abstractDependency, functionDependency] =
			service.dependencies;

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
		expect(abstractDependency.token.symbol.getName()).toBe("AbstractDependency");
		expectSourceSpan(
			sourceFile,
			abstractDependency.token.source,
			"AbstractDependency",
		);

		expect(functionDependency.token).toMatchObject({ kind: "reference" });
		if (functionDependency.token?.kind !== "reference") {
			throw new Error("Function token was not resolved");
		}
		expect(functionDependency.token.symbol.getName()).toBe("FunctionDependency");
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

	it("keeps getClassModel as a compatibility wrapper", () => {
		const { program, sourceFile } = createProgram();
		const analyzer = createNexusAnalyzer(program);

		const service = analyzer.getClassModel(getClass(sourceFile, "ServiceA"));

		expect(service.name).toBe("ServiceA");
		expect(service).not.toHaveProperty("node");
	});
});
