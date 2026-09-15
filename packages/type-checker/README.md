# @nexus-ioc/type-checker

Framework-agnostic type-checking logic for Nexus IoC dependency injection.

## Overview

This package provides the core type-checking, parsing, and analysis logic for Nexus IoC dependency injection. It's designed to be framework-agnostic and can be used by various tools:

- **TypeScript Language Service Plugins** (VS Code)
- **ESLint Plugins** (WebStorm, IntelliJ IDEA, and all IDEs)
- **CLI Tools** (CI/CD pipelines)
- **Custom tooling and integrations**

## Features

### Semantic analysis

- **NexusAnalyzer** - Converts TypeScript classes into AST-independent Nexus semantic entities
- **NexusApplicationAnalyzer** - Discovers reachable Nexus classes from an application entry point
- **NexusApplicationGraphBuilder** - Resolves dependencies to concrete providers across module scopes and detects provider cycles

### Parsers

- **InjectParser** - Extracts `@Inject` decorated parameters and properties from classes
- **InjectableParser** - Finds all `@Injectable` decorated classes in a source file
- **ModuleParser** - Parses `@Module` decorators and extracts module metadata
- **ModulesParser** - Finds all `@Module` decorated classes in a source file

### Helpers

- **compareTypes** - Compares TypeScript types for compatibility
- **checkTypesHelper** - Checks if two nodes represent the same type
- **getTypeOfNode** - Extracts TypeScript type from an AST node
- **findTypeReferences** - Finds all references to a type across the project
- **CircularDependencyDetectorHelper** - Detects circular dependencies in DI graph
- **findNodeAtPosition** - Finds AST node at a specific position

### Types

- **NexusClass** - Semantic representation of a Nexus class
- **NexusDependency** - Semantic representation of constructor/property injection
- **NexusDecorator** - Semantic Nexus decorator information
- **NexusToken** - Semantic injection token information
- **NexusSourceSpan** - Source location information
- **NexusApplication** - Semantic representation of classes reachable from an application entry point
- **NexusModule** - Semantic representation of an `@Module` class's `providers`/`imports`/`exports`
- **NexusProvider** - Semantic representation of one `providers` array entry (`class`/`useClass`/`useValue`/`useFactory`)
- **NexusApplicationGraph** - Resolved view of a `NexusApplication`: which provider satisfies each dependency, plus unresolved dependencies and provider cycles
- **NexusProviderCycle** - A detected `useFactory` `inject` cycle
- **ILogger** - Minimal logger interface for framework-agnostic logging
- **NoOpLogger** - No-op logger implementation

## Usage

### Class-level semantic analysis

```typescript
import * as ts from "typescript";
import {
  createNexusAnalyzer,
  type NexusClass,
} from "@nexus-ioc/type-checker";

const program = ts.createProgram(["src/app.ts"], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
});

const sourceFile = program.getSourceFile("src/app.ts");
if (!sourceFile) throw new Error("Source file not found");

const classDeclaration = sourceFile.statements.find(
  (node): node is ts.ClassDeclaration =>
    ts.isClassDeclaration(node) && node.name?.text === "UsersService",
);
if (!classDeclaration) throw new Error("UsersService not found");

const analyzer = createNexusAnalyzer(program);
const nexusClass: NexusClass = analyzer.getClass(classDeclaration);

console.log(nexusClass.name);
console.log(nexusClass.isInjectable);
console.log(nexusClass.dependencies);
```

The TypeScript AST is accepted at the analyzer boundary, but `NexusClass`, `NexusDependency`, and `NexusDecorator` do not expose TypeScript AST nodes.

### Module-level semantic analysis

```typescript
import * as ts from "typescript";
import {
  createNexusAnalyzer,
  type NexusModule,
} from "@nexus-ioc/type-checker";

const program = ts.createProgram(["src/app.ts"], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
});

const sourceFile = program.getSourceFile("src/app.ts");
if (!sourceFile) throw new Error("Source file not found");

const moduleDeclaration = sourceFile.statements.find(
  (node): node is ts.ClassDeclaration =>
    ts.isClassDeclaration(node) && node.name?.text === "UsersModule",
);
if (!moduleDeclaration) throw new Error("UsersModule not found");

const analyzer = createNexusAnalyzer(program);
const nexusModule: NexusModule | undefined =
  analyzer.getModule(moduleDeclaration);

console.log(nexusModule?.providers);
console.log(nexusModule?.imports);
console.log(nexusModule?.exports);
```

`getModule()` parses an `@Module({ providers, imports, exports })` decorator argument into `providers: readonly NexusProvider[]`, `imports: readonly NexusModuleImport[]`, and `exports: readonly NexusModuleExport[]`. Each `NexusProvider` captures one `providers` entry — a bare class reference (`kind: "class"`) or an object literal (`useClass`/`useValue`/`useFactory`, the latter carrying its `inject` tokens on `factoryInject`). `getClass()` calls `getModule()` internally and exposes the result as `NexusClass.module`, which is populated only for classes carrying an `@Module(...)` decorator — every other class has `module: undefined`.

A dynamic-module import (`FooModule.forRoot(...)` inside `imports: [...]`) resolves to the concrete module class via the factory's inferred return type, so this works for any body shape as long as the factory has no explicit return-type annotation. A factory explicitly annotated `: DynamicModule` erases that inferred type, so it only resolves when the body is a single, unconditional `return { module: FooModule, ... };` statement — anything more complex falls back to an unresolvable `expression`-kind token for that import.

### Application-level semantic analysis

```typescript
import * as ts from "typescript";
import {
  createNexusAnalyzer,
  createNexusApplicationAnalyzer,
} from "@nexus-ioc/type-checker";

const program = ts.createProgram(["src/app.ts"], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
});

const sourceFile = program.getSourceFile("src/app.ts");
if (!sourceFile) throw new Error("Source file not found");

const entryPoint = sourceFile.statements.find(
  (node): node is ts.ClassDeclaration =>
    ts.isClassDeclaration(node) && node.name?.text === "AppModule",
);
if (!entryPoint) throw new Error("AppModule not found");

const analyzer = createNexusAnalyzer(program);
const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);
const application = applicationAnalyzer.analyze(entryPoint);

for (const nexusClass of application.classes) {
  console.log(nexusClass.name);
}
```

`NexusApplicationAnalyzer` starts from the supplied class and follows resolvable class-reference injection tokens, as well as module structure (`imports`, `providers`) as reachability edges. Results are deterministic and de-duplicated; unrelated classes are excluded.

### Application graph

```typescript
import * as ts from "typescript";
import {
  createNexusAnalyzer,
  createNexusApplicationAnalyzer,
  createNexusApplicationGraphBuilder,
} from "@nexus-ioc/type-checker";

const program = ts.createProgram(["src/app.ts"], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
});

const sourceFile = program.getSourceFile("src/app.ts");
if (!sourceFile) throw new Error("Source file not found");

const entryPoint = sourceFile.statements.find(
  (node): node is ts.ClassDeclaration =>
    ts.isClassDeclaration(node) && node.name?.text === "AppModule",
);
if (!entryPoint) throw new Error("AppModule not found");

const analyzer = createNexusAnalyzer(program);
const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);
const application = applicationAnalyzer.analyze(entryPoint);

const graphBuilder = createNexusApplicationGraphBuilder(analyzer);
const graph = graphBuilder.build(application);

for (const dependency of graph.resolved) {
  console.log(dependency.class.name, "->", dependency.provider.provide);
}
for (const dependency of graph.unresolved) {
  console.log("unresolved:", dependency.class.name, dependency.dependencyName);
}
for (const cycle of graph.cycles) {
  console.log("cycle:", cycle.path.map((provider) => provider.provide));
}
```

`NexusApplicationGraphBuilder.build()` resolves every class's dependency tokens to the concrete `NexusProvider` that satisfies them, honoring module scoping: a module's own `providers`, providers its imported modules `export` (including transitively re-exported ones), and providers exported by any `@Global()` module anywhere in the application. Each match is reported as a `NexusResolvedDependency` (`class`, `dependencyName`, `provider`, `providingModule`); a *required* dependency with no match is reported as a `NexusUnresolvedDependency` instead — an unmatched optional dependency is silently skipped. `NexusProviderCycle` reports a cycle found among `useFactory` providers' `inject` tokens, matched by `ts.Symbol`/token identity rather than class-name strings.

Cycle detection is scoped per module: it walks each module's own `providers` registrations independently, so it will not detect a cycle that spans factory `inject` tokens registered as *own* providers of two different modules — only cycles within a single module's own provider registrations are found. This is a deliberate, documented limitation (see the `detectCycles()` comment in `nexus-application-graph-builder.ts`).

### Custom logger

```typescript
import { type ILogger, InjectParser } from "@nexus-ioc/type-checker";

class CustomLogger implements ILogger {
  log(message: string): void {
    console.log(`[TypeChecker] ${message}`);
  }
}

const logger = new CustomLogger();
const params = InjectParser.execute(classDeclaration, logger);
```

## API Documentation

### NexusAnalyzer

Converts a TypeScript class declaration into the semantic `NexusClass` representation.

```typescript
class NexusAnalyzer {
  getClass(node: ts.ClassDeclaration): NexusClass;

  /** @deprecated Use getClass() instead. */
  getClassModel(node: ts.ClassDeclaration): NexusClass;

  getModule(node: ts.ClassDeclaration): NexusModule | undefined;
}
```

### NexusModule

```typescript
type NexusModule = {
  providers: readonly NexusProvider[];
  imports: readonly NexusModuleImport[];
  exports: readonly NexusModuleExport[];
};

type NexusProvider = {
  kind: "class" | "useClass" | "useValue" | "useFactory";
  provide: NexusToken;
  useClass?: NexusToken;
  factoryInject: readonly NexusToken[];
  scope?: NexusToken;
  source: NexusSourceSpan;
};

type NexusModuleImport = {
  module: NexusToken;
  isDynamic: boolean;
  source: NexusSourceSpan;
};

type NexusModuleExport = {
  token: NexusToken;
  source: NexusSourceSpan;
};
```

`undefined` for `NexusAnalyzer.getModule()` (and `NexusClass.module`) means the class has no `@Module(...)` decorator; `providers`/`imports`/`exports` are otherwise always present, defaulting to `[]` when the corresponding decorator property is omitted.

### NexusApplicationAnalyzer

Performs whole-application semantic traversal starting from an explicit root class, discovering classes reachable both through direct `@Inject()` references and through module structure (`imports`, `providers`).

```typescript
class NexusApplicationAnalyzer {
  analyze(entryPoint: ts.ClassDeclaration): NexusApplication;
}
```

### NexusApplication

```typescript
type NexusApplication = {
  entryPoint: NexusSourceSpan;
  classes: readonly NexusClass[];
};
```

### NexusApplicationGraphBuilder

Resolves a `NexusApplication` into a module-scoped dependency graph: which `NexusProvider` satisfies each class's dependency tokens, and which provider registrations form a cycle.

```typescript
class NexusApplicationGraphBuilder {
  build(application: NexusApplication): NexusApplicationGraph;
}
```

### NexusApplicationGraph

```typescript
type NexusApplicationGraph = {
  resolved: readonly NexusResolvedDependency[];
  unresolved: readonly NexusUnresolvedDependency[];
  cycles: readonly NexusProviderCycle[];
};

type NexusResolvedDependency = {
  class: NexusClass;
  dependencyName: string;
  provider: NexusProvider;
  providingModule: NexusClass;
};

type NexusUnresolvedDependency = {
  class: NexusClass;
  dependencyName: string;
  token: NexusToken | undefined;
  source: NexusSourceSpan;
};

type NexusProviderCycle = {
  path: readonly NexusProvider[];
};
```

`unresolved` only ever contains *required* (non-optional) dependencies — see the "Application graph" usage section above for how module `imports`/`exports` scoping and `@Global()` modules affect resolution, and for the known per-module scoping limit on cycle detection.

This package now covers `@Module` metadata, module-structure-aware reachability, module-scoped provider resolution (own/imported/global), and per-module `ts.Symbol`-identity cycle detection. It intentionally does not cover: migrating `packages/language-service` off its legacy AST/tsquery parser stack (`ModuleParser`, `ModulesParser`, `InjectParser`, `InjectableParser`, `CircularDependencyDetectorHelper`, `checkTypesHelper`, `compareTypes`, `findTypeReferences`) onto this model; `Scope.Singleton`/`Request`/`Transient` instance semantics, which are captured only as inert token metadata on `NexusProvider.scope` and are never interpreted; and ESLint rules or compiler code generation consuming the graph.

### InjectParser

Extracts all `@Inject` decorated parameters and properties from a class declaration.

```typescript
class InjectParser {
  static execute(
    classDeclaration: ts.ClassDeclaration,
    logger: ILogger
  ): InjectParameterDeclaration[];
}
```

### InjectableParser

Finds all `@Injectable` decorated classes in a source file.

```typescript
class InjectableParser {
  static execute(sourceFile: ts.SourceFile): ts.ClassDeclaration[];
}
```

### ModuleParser

Parses `@Module` decorators and extracts module metadata.

```typescript
class ModuleParser {
  static execute(
    modules: ts.ClassDeclaration[],
    typeChecker: ts.TypeChecker,
    context: { tsLS: any; logger: ILogger }
  ): ModuleDeclaration[];
}
```

### compareTypes

Compares two TypeScript types for compatibility.

```typescript
function compareTypes(
  keywordNode: ts.Node | undefined,
  literalNode: ts.Node | undefined,
  typeChecker: ts.TypeChecker
): boolean;
```

## Requirements

- TypeScript >= 4.0.0
- Node.js >= 14.0.0

## License

MIT

## Contributing

See the main [Nexus IoC repository](https://github.com/Isqanderm/ioc) for contribution guidelines.

## Related Packages

- **Language Service** - TypeScript Language Service Plugin
- **ESLint Plugin** - ESLint integration
- **Core** - Nexus IoC runtime
