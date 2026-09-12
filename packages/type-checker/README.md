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

### Parsers

- **InjectParser** - Extracts `@Inject` decorated parameters and properties from classes
- **InjectableParser** - Finds all `@Injectable` decorated classes in a source file
- **NsModuleParser** - Parses `@NsModule` decorators and extracts module metadata
- **NsModulesParser** - Finds all `@NsModule` decorated classes in a source file

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

`NexusApplicationAnalyzer` starts from the supplied class and follows resolvable class-reference injection tokens. Results are deterministic and de-duplicated; unrelated classes are excluded.

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
}
```

### NexusApplicationAnalyzer

Performs whole-application semantic traversal starting from an explicit root class.

```typescript
class NexusApplicationAnalyzer {
  analyze(entryPoint: ts.ClassDeclaration): NexusApplication;
}
```

The current implementation intentionally stops at semantic reachability. It does not define provider resolution, a full application graph, lifecycle analysis, or circular dependency reporting.

### NexusApplication

```typescript
type NexusApplication = {
  entryPoint: NexusSourceSpan;
  classes: readonly NexusClass[];
};
```

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

### NsModuleParser

Parses `@NsModule` decorators and extracts module metadata.

```typescript
class NsModuleParser {
  static execute(
    modules: ts.ClassDeclaration[],
    typeChecker: ts.TypeChecker,
    context: { tsLS: any; logger: ILogger }
  ): NsModuleDeclaration[];
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
