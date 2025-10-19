# @nexus-ioc/type-checker

Framework-agnostic type-checking logic for Nexus IoC dependency injection.

## Overview

This package provides the core type-checking, parsing, and analysis logic for Nexus IoC dependency injection. It's designed to be framework-agnostic and can be used by various tools:

- **TypeScript Language Service Plugins** (VS Code)
- **ESLint Plugins** (WebStorm, IntelliJ IDEA, and all IDEs)
- **CLI Tools** (CI/CD pipelines)
- **Custom tooling and integrations**

## Installation

```bash
npm install @nexus-ioc/type-checker
```

## Features

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

- **ILogger** - Minimal logger interface for framework-agnostic logging
- **NoOpLogger** - No-op logger implementation

## Usage

### Basic Example

```typescript
import {
  InjectParser,
  InjectableParser,
  NsModuleParser,
  compareTypes,
  NoOpLogger,
} from '@nexus-ioc/type-checker';
import * as ts from 'typescript';

// Create a TypeScript program
const program = ts.createProgram(['src/app.ts'], {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS,
});

const sourceFile = program.getSourceFile('src/app.ts');
const typeChecker = program.getTypeChecker();

// Parse @Injectable classes
const injectableClasses = InjectableParser.execute(sourceFile);

// Parse @Inject parameters for each class
const logger = new NoOpLogger();
for (const classDecl of injectableClasses) {
  const params = InjectParser.execute(classDecl, logger);
  console.log(`Found ${params.length} injected dependencies`);
}

// Parse @NsModule decorators
const modules = NsModulesParser.execute(sourceFile);
const nsModules = NsModuleParser.execute(modules, typeChecker, {
  tsLS: program,
  logger,
});

// Compare types for compatibility
const isCompatible = compareTypes(paramType, providerType, typeChecker);
```

### With Custom Logger

```typescript
import { ILogger, InjectParser } from '@nexus-ioc/type-checker';

class CustomLogger implements ILogger {
  log(message: string): void {
    console.log(`[TypeChecker] ${message}`);
  }
}

const logger = new CustomLogger();
const params = InjectParser.execute(classDeclaration, logger);
```

## API Documentation

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

## Integration Examples

### TypeScript Language Service Plugin

```typescript
import { InjectParser, compareTypes } from '@nexus-ioc/type-checker';

// In your language service plugin
const params = InjectParser.execute(classDecl, logger);
const isValid = compareTypes(paramType, providerType, checker);
```

### ESLint Plugin

```typescript
import { InjectParser, NoOpLogger } from '@nexus-ioc/type-checker';
import { ESLintUtils } from '@typescript-eslint/utils';

export default ESLintUtils.RuleCreator.withoutDocs({
  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();
    const logger = new NoOpLogger();

    return {
      ClassDeclaration(node) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        const params = InjectParser.execute(tsNode, logger);
        // Validate dependencies...
      },
    };
  },
});
```

## Requirements

- TypeScript >= 4.0.0
- Node.js >= 14.0.0

## License

MIT

## Contributing

See the main [Nexus IoC repository](https://github.com/Isqanderm/ioc) for contribution guidelines.

## Related Packages

- [@nexus-ioc/language-service](https://www.npmjs.com/package/@nexus-ioc/language-service) - TypeScript Language Service Plugin for VS Code
- [@nexus-ioc/eslint-plugin](https://www.npmjs.com/package/@nexus-ioc/eslint-plugin) - ESLint Plugin for WebStorm and all IDEs
- [@nexus-ioc/core](https://www.npmjs.com/package/@nexus-ioc/core) - Core Nexus IoC framework

