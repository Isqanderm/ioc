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

class DependencyA {}

@Service()
class ServiceA {
  constructor(
    @Dependency(DependencyA) dependency: DependencyA,
    @Dependency("config") @Maybe() config: unknown,
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

  const defaultHost = ts.createCompilerHost(options, true);
  const host: ts.CompilerHost = {
    ...defaultHost,
    fileExists: (fileName) => files.has(fileName) || defaultHost.fileExists(fileName),
    readFile: (fileName) => files.get(fileName) ?? defaultHost.readFile(fileName),
    getSourceFile: (fileName, languageVersion) => {
      const text = files.get(fileName);
      if (text !== undefined) {
        return ts.createSourceFile(fileName, text, languageVersion, true);
      }
      return defaultHost.getSourceFile(fileName, languageVersion);
    },
    resolveModuleNames: (moduleNames, containingFile) =>
      moduleNames.map((moduleName) => {
        if (moduleName === "./foreign") {
          return {
            resolvedFileName: "/foreign.ts",
            extension: ts.Extension.Ts,
            isExternalLibraryImport: false,
          };
        }

        const resolved = ts.resolveModuleName(moduleName, containingFile, options, host).resolvedModule;
        return resolved;
      }),
  };

  const program = ts.createProgram(["/nexus-test.ts"], options, host);
  const sourceFile = program.getSourceFile("/nexus-test.ts");
  if (!sourceFile) throw new Error("Test source file was not created");

  return { program, sourceFile };
}

function getClass(sourceFile: ts.SourceFile, name: string): ts.ClassDeclaration {
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.ClassDeclaration => ts.isClassDeclaration(statement) && statement.name?.text === name,
  );
  if (!declaration) throw new Error(`Class ${name} not found`);
  return declaration;
}

describe("NexusAnalyzer", () => {
  it("recognizes aliased Nexus decorators by symbol identity", () => {
    const { program, sourceFile } = createProgram();
    const analyzer = createNexusAnalyzer(program);

    const service = analyzer.getClassModel(getClass(sourceFile, "ServiceA"));

    expect(service.isInjectable).toBe(true);
    expect(service.decorators.map((decorator) => decorator.kind)).toContain("Injectable");
  });

  it("extracts constructor and property injections with optional metadata", () => {
    const { program, sourceFile } = createProgram();
    const analyzer = createNexusAnalyzer(program);

    const service = analyzer.getClassModel(getClass(sourceFile, "ServiceA"));

    expect(service.dependencies).toHaveLength(3);
    expect(service.dependencies[0]).toMatchObject({
      location: "constructor",
      parameterName: "dependency",
      isOptional: false,
    });
    expect(service.dependencies[1]).toMatchObject({
      location: "constructor",
      parameterName: "config",
      isOptional: true,
    });
    expect(service.dependencies[2]).toMatchObject({
      location: "property",
      parameterName: "logger",
      isOptional: false,
    });
  });

  it("recognizes modules and global modules", () => {
    const { program, sourceFile } = createProgram();
    const analyzer = createNexusAnalyzer(program);

    const module = analyzer.getClassModel(getClass(sourceFile, "AppModule"));
    const globalModule = analyzer.getClassModel(getClass(sourceFile, "GlobalModule"));

    expect(module.isModule).toBe(true);
    expect(module.isGlobal).toBe(false);
    expect(globalModule.isModule).toBe(true);
    expect(globalModule.isGlobal).toBe(true);
  });

  it("does not treat same-named foreign decorators as Nexus decorators", () => {
    const { program, sourceFile } = createProgram();
    const analyzer = createNexusAnalyzer(program);

    const foreignService = analyzer.getClassModel(getClass(sourceFile, "ForeignServiceClass"));
    const foreignInjected = analyzer.getClassModel(getClass(sourceFile, "ForeignInjected"));

    expect(foreignService.isInjectable).toBe(false);
    expect(foreignService.decorators).toHaveLength(0);
    expect(foreignInjected.dependencies).toHaveLength(0);
  });
});
