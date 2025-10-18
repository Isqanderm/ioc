# Nexus IoC Graph Analyzer

> Static analysis tool for Nexus IoC dependency injection graphs

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-35%20passing-brightgreen.svg)](./src)
[![Coverage](https://img.shields.io/badge/coverage-80.79%25-green.svg)](./coverage)

Analyze and visualize dependency injection graphs in Nexus IoC applications. Extract complete metadata about modules, providers, and dependencies without running your application.

## ✨ Features

- 🔍 **Static Analysis** - Analyze DI graphs without executing code
- 📊 **Multiple Output Formats** - JSON data and PNG visualizations
- 🎯 **Complete Dependency Extraction** - Constructor and property injection
- 🔧 **CLI & Programmatic API** - Use as a command-line tool or library
- 🎨 **Modern Decorator Support** - Both legacy and TC39 Stage 3 decorators
- 📦 **TypeScript Path Aliases** - Resolves tsconfig.json path mappings
- 🌳 **Module Graph Traversal** - Follows imports to build complete graph

## 📦 Installation

```bash
npm install --save-dev graph-analyzer
```

Or install globally:

```bash
npm install -g graph-analyzer
```

## 🚀 Quick Start

### CLI Usage

Analyze your application's entry point:

```bash
# Generate both JSON and PNG outputs
graph-analyzer src/main.ts

# Generate only JSON
graph-analyzer -f json -o graph.json src/main.ts

# Generate only PNG visualization
graph-analyzer -f png -o graph.png src/main.ts

# Specify custom tsconfig.json
graph-analyzer -c tsconfig.app.json src/main.ts
```

### Programmatic Usage

```typescript
import { GraphAnalyzer, ParseEntryFile, ParseNsModule, ParseTsConfig } from 'graph-analyzer';
import * as fs from 'fs';
import * as ts from 'typescript';

// Parse entry file
const entryContent = fs.readFileSync('src/main.ts', 'utf8');
const sourceFile = ts.createSourceFile('src/main.ts', entryContent, ts.ScriptTarget.Latest, true);

const tsConfig = new ParseTsConfig('{}', process.cwd());
const entryFile = new ParseEntryFile(sourceFile, 'src/main.ts', tsConfig);
entryFile.parse();

// Build module graph
const modulesGraph = new Map();
modulesGraph.set('entry', entryFile);
// ... add more modules

// Analyze and generate output
const analyzer = new GraphAnalyzer(modulesGraph, 'src/main.ts', {
  outputFormat: 'json',
  jsonOutputPath: './graph.json'
});

const output = analyzer.parse();
console.log(output);
```

## 📖 CLI Reference

### Command Syntax

```
graph-analyzer [options] <entry-file>
```

### Arguments

- `<entry-file>` - Path to your application's entry point file (e.g., `src/main.ts`)

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--config <path>` | `-c` | Path to tsconfig.json | `./tsconfig.json` |
| `--output <path>` | `-o` | Output file path | `./graph.json` or `./graph.png` |
| `--format <format>` | `-f` | Output format: `json`, `png`, or `both` | `both` |
| `--help` | `-h` | Display help message | - |
| `--version` | `-v` | Display version number | - |

### Examples

```bash
# Basic usage - generates graph.json and graph.png
graph-analyzer src/main.ts

# JSON only with custom output path
graph-analyzer -f json -o output/dependency-graph.json src/main.ts

# PNG only with custom output path
graph-analyzer -f png -o docs/architecture.png src/main.ts

# Custom tsconfig location
graph-analyzer -c config/tsconfig.build.json src/main.ts

# Both formats with custom paths
graph-analyzer -f both src/main.ts
# Creates: ./graph.json and ./graph.png
```

## 📊 Output Format

### JSON Output

The JSON output provides a structured representation of your dependency graph:

```json
{
  "modules": [
    {
      "name": "UserModule",
      "path": "/path/to/user.module.ts",
      "imports": ["DatabaseModule"],
      "exports": ["UserService"],
      "providers": ["UserService", "UserRepository"],
      "isGlobal": false
    }
  ],
  "providers": [
    {
      "token": "UserService",
      "type": "Class",
      "module": "UserModule",
      "scope": "Singleton",
      "dependencies": [
        {
          "type": "constructor",
          "index": 0,
          "token": "UserRepository",
          "tokenType": "class",
          "optional": false
        }
      ]
    }
  ],
  "metadata": {
    "entryPoint": "/path/to/main.ts",
    "rootModule": "AppModule",
    "analyzedAt": "2025-01-18T12:00:00.000Z",
    "version": "1.0.0",
    "totalModules": 5,
    "totalProviders": 12
  }
}
```

### PNG Output

The PNG output is a visual graph showing:
- Modules as nodes
- Dependencies as directed edges
- Global modules highlighted
- Provider relationships

## 🎯 What Gets Analyzed

### Supported Patterns

✅ **Constructor Injection**
```typescript
@Injectable()
class UserService {
  constructor(
    @Inject(UserRepository) private repo: UserRepository,
    @Inject('CONFIG') private config: Config
  ) {}
}
```

✅ **Property Injection**
```typescript
@Injectable()
class UserService {
  @Inject(Logger)
  private logger: Logger;
}
```

✅ **Optional Dependencies**
```typescript
@Injectable()
class UserService {
  constructor(
    @Optional() @Inject(CacheService) private cache?: CacheService
  ) {}
}
```

✅ **TC39 Stage 3 Decorators**
```typescript
@Injectable()
class UserService {
  static dependencies = [
    { index: 0, token: UserRepository, optional: false }
  ];
}
```

✅ **Different Provider Types**
```typescript
@NsModule({
  providers: [
    UserService,                                    // Class
    { provide: 'CONFIG', useValue: config },       // UseValue
    { provide: 'FACTORY', useFactory: factory },   // UseFactory
    { provide: IService, useClass: ServiceImpl }   // UseClass
  ]
})
```

### Token Types

The analyzer detects three types of injection tokens:

- **Class tokens**: `@Inject(UserService)`
- **String tokens**: `@Inject('CONFIG')`
- **Symbol tokens**: `@Inject(Symbol.for('key'))`

## 🏗️ Architecture

The graph analyzer works in several phases:

1. **Entry Point Parsing** - Finds the root module from your entry file
2. **Module Traversal** - Recursively follows module imports
3. **Provider Analysis** - Extracts provider metadata from each module
4. **Dependency Extraction** - Analyzes decorators to find dependencies
5. **Graph Building** - Constructs the complete dependency graph
6. **Output Generation** - Produces JSON and/or PNG visualization

For detailed architecture documentation, see [ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## 📚 API Reference

For complete API documentation, see [API_REFERENCE.md](./docs/API_REFERENCE.md).

### Key Classes

- `GraphAnalyzer` - Main analyzer class
- `JsonFormatter` - JSON output formatter
- `DependencyExtractor` - Dependency metadata extraction
- `ParseNsModule` - Module parser
- `ParseEntryFile` - Entry point parser

## 🧪 Testing

The package includes comprehensive tests:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- dependency-extractor
```

**Test Coverage**: 35 tests, 80.79% coverage

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT © [IsqanderM](https://github.com/Isqanderm)

## 🔗 Related

- [Nexus IoC](https://github.com/Isqanderm/ioc) - The dependency injection framework
- [TypeScript](https://www.typescriptlang.org/) - Language used
- [Graphviz](https://graphviz.org/) - Graph visualization engine

## 📞 Support

- 🐛 [Report a bug](https://github.com/Isqanderm/ioc/issues)
- 💡 [Request a feature](https://github.com/Isqanderm/ioc/issues)
- 📖 [Documentation](https://github.com/Isqanderm/ioc#readme)

