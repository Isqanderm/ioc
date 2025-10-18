# @nexus-ioc/graph-analyzer

> Static analysis and visualization tool for Nexus IoC dependency injection graphs

[![npm version](https://img.shields.io/npm/v/@nexus-ioc/graph-analyzer.svg)](https://www.npmjs.com/package/@nexus-ioc/graph-analyzer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-443%20passing-brightgreen.svg)](./src)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

Analyze and visualize dependency injection graphs in [Nexus IoC](https://github.com/Isqanderm/ioc) applications. Extract complete metadata about modules, providers, and dependencies **without running your application**. Detect circular dependencies, unused providers, scope mismatches, and visualize your architecture with interactive HTML graphs.

## ✨ Features

### Core Analysis
- 🔍 **Static Analysis** - Analyze DI graphs without executing code using TypeScript AST
- 🎯 **Complete Dependency Extraction** - Constructor and property injection with full metadata
- 🔧 **CLI & Programmatic API** - Use as a command-line tool or integrate into your build pipeline
- 🎨 **Modern Decorator Support** - Both legacy and TC39 Stage 3 decorators
- 📦 **TypeScript Path Aliases** - Resolves tsconfig.json path mappings automatically
- 🌳 **Module Graph Traversal** - Follows imports to build complete dependency graph

### Advanced Analysis Features
- 🔄 **Circular Dependency Detection** - Detect circular imports and provider dependencies
- 🗑️ **Unused Provider Detection** - Find providers that are registered but never injected
- 📊 **Module Depth Analysis** - Analyze module hierarchy depth and complexity metrics
- 🎯 **Provider Scope Analysis** - Detect scope mismatches (Singleton depending on Request-scoped)
- ⚠️ **Missing Decorator Detection** - Identify dependencies without explicit `@Inject` decorators

### Visualization & Output
- 📊 **Multiple Output Formats** - JSON data, interactive HTML, and PNG visualizations
- 🎨 **Interactive HTML Graphs** - Click nodes to explore, pan/zoom, dark theme support
- 🔗 **IDE Integration** - Clickable links to source code (VSCode, WebStorm, IntelliJ IDEA)
- ⚡ **Progress Indicators** - Real-time feedback with spinners and statistics
- 🎛️ **Flexible Output Control** - Verbose and quiet modes for different use cases

## 📦 Installation

Install as a development dependency in your project:

```bash
npm install --save-dev @nexus-ioc/graph-analyzer
```

Or install globally:

```bash
npm install -g @nexus-ioc/graph-analyzer
```

**Requirements:**
- Node.js >= 14.0.0
- TypeScript project with Nexus IoC

## 🚀 Quick Start

### CLI Usage

Analyze your application's entry point:

```bash
# Generate interactive HTML visualization (recommended)
npx graph-analyzer -f html -o graph.html src/main.ts

# Generate JSON data
npx graph-analyzer -f json -o graph.json src/main.ts

# Run all analysis checks
npx graph-analyzer --check-circular --check-unused --check-scope --check-depth src/main.ts

# Specify custom tsconfig.json
npx graph-analyzer -c tsconfig.app.json src/main.ts
```

### Programmatic Usage

```typescript
import { GraphAnalyzer, ParseEntryFile, ParseTsConfig } from '@nexus-ioc/graph-analyzer';
import * as fs from 'fs';
import * as ts from 'typescript';

// Load TypeScript configuration
const tsConfigContent = fs.readFileSync('tsconfig.json', 'utf8');
const tsConfig = new ParseTsConfig(tsConfigContent, process.cwd());

// Parse entry file
const entryContent = fs.readFileSync('src/main.ts', 'utf8');
const sourceFile = ts.createSourceFile('src/main.ts', entryContent, ts.ScriptTarget.Latest, true);
const entryFile = new ParseEntryFile(sourceFile, 'src/main.ts', tsConfig);
entryFile.parse();

// Build module graph (simplified - see full example in docs)
const modulesGraph = new Map();
modulesGraph.set('entry', entryFile);
// ... traverse and add all modules

// Analyze with all features enabled
const analyzer = new GraphAnalyzer(modulesGraph, 'src/main.ts', {
  outputFormat: 'json',
  jsonOutputPath: './graph.json',
  checkCircular: true,
  checkUnused: true,
  checkDepth: true,
  checkScope: true
});

const output = analyzer.parse();
console.log(`Analyzed ${output.metadata.totalModules} modules`);
console.log(`Found ${output.metadata.totalProviders} providers`);

// Check for issues
if (output.analysis?.circularDependencies?.length > 0) {
  console.error('Circular dependencies detected!');
}
```

## 📖 CLI Reference

### Command Syntax

```
graph-analyzer [options] <entry-file>
```

### Arguments

- `<entry-file>` - Path to your application's entry point file (e.g., `src/main.ts`)

### Options

#### Output Options
| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--config <path>` | `-c` | Path to tsconfig.json | `./tsconfig.json` |
| `--output <path>` | `-o` | Output file path | `./graph.json`, `./graph.png`, or `./graph.html` |
| `--format <format>` | `-f` | Output format: `json`, `png`, `html`, or `both` | `both` |

#### Analysis Options
| Option | Description | Default |
|--------|-------------|---------|
| `--check-circular` | Detect circular dependencies in modules and providers | `false` |
| `--check-unused` | Detect providers that are registered but never injected | `false` |
| `--check-depth` | Analyze module hierarchy depth and complexity | `false` |
| `--check-scope` | Detect provider scope mismatches | `false` |
| `--check-ci` | Enable all checks (circular, unused, depth, scope) | `false` |
| `--deep-module-threshold <n>` | Threshold for identifying deep modules | `5` |

#### Visualization Options
| Option | Description | Default |
|--------|-------------|---------|
| `--ide <protocol>` | IDE protocol for clickable links: `vscode`, `webstorm`, `idea` | `vscode` |
| `--dark` | Use dark theme for HTML output | `false` |

#### General Options
| Option | Alias | Description |
|--------|-------|-------------|
| `--verbose` | - | Show detailed progress information |
| `--quiet` | - | Suppress all output except errors |
| `--help` | `-h` | Display help message |
| `--version` | `-v` | Display version number |

### Examples

```bash
# Basic usage - generates interactive HTML
npx graph-analyzer -f html -o graph.html src/main.ts

# Run all analysis checks (recommended for CI/CD)
npx graph-analyzer --check-ci -f json -o graph.json src/main.ts

# Detect circular dependencies only
npx graph-analyzer --check-circular src/main.ts

# Detect unused providers
npx graph-analyzer --check-unused -f html src/main.ts

# Analyze module depth and complexity
npx graph-analyzer --check-depth --deep-module-threshold 3 src/main.ts

# Detect scope mismatches (Singleton depending on Request-scoped)
npx graph-analyzer --check-scope src/main.ts

# HTML with dark theme and WebStorm links
npx graph-analyzer -f html --ide webstorm --dark src/main.ts

# Custom tsconfig location
npx graph-analyzer -c config/tsconfig.build.json src/main.ts

# Verbose output for debugging
npx graph-analyzer --verbose --check-ci src/main.ts

# Quiet mode for CI/CD pipelines (exit code 1 if issues found)
npx graph-analyzer --quiet --check-ci -f json -o build/graph.json src/main.ts

# Complete example with all options
npx graph-analyzer \
  -c tsconfig.json \
  -f html \
  -o docs/architecture.html \
  --check-circular \
  --check-unused \
  --check-scope \
  --check-depth \
  --ide vscode \
  --dark \
  src/main.ts
```

## 📊 Analysis Features

### Circular Dependency Detection

Detects circular dependencies in both module imports and provider dependencies using depth-first search (DFS).

```bash
npx graph-analyzer --check-circular src/main.ts
```

**Detects:**
- Module-level circular imports (ModuleA → ModuleB → ModuleA)
- Provider-level circular dependencies (ServiceA → ServiceB → ServiceA)

**Example Output:**
```json
{
  "analysis": {
    "circularDependencies": [
      {
        "type": "module",
        "cycle": ["UserModule", "AuthModule", "UserModule"],
        "severity": "error",
        "message": "Circular module import detected: UserModule -> AuthModule -> UserModule"
      }
    ]
  }
}
```

### Unused Provider Detection

Finds providers that are registered but never injected as dependencies.

```bash
npx graph-analyzer --check-unused src/main.ts
```

**Identifies:**
- Providers registered in modules but not used anywhere
- Potential dead code that can be removed
- Providers that might be missing from exports

**Example Output:**
```json
{
  "analysis": {
    "unusedProviders": [
      {
        "token": "LegacyService",
        "module": "CoreModule",
        "type": "Class",
        "reason": "Not injected in any provider"
      }
    ]
  }
}
```

### Module Depth Analysis

Analyzes module hierarchy depth and complexity metrics using breadth-first search (BFS).

```bash
npx graph-analyzer --check-depth --deep-module-threshold 5 src/main.ts
```

**Calculates:**
- Maximum depth in module hierarchy
- Average depth across all modules
- Modules exceeding depth threshold
- Fan-in and fan-out metrics

**Example Output:**
```json
{
  "analysis": {
    "depthAnalysis": {
      "maxDepth": 4,
      "averageDepth": 2.3,
      "totalModules": 15,
      "deepModules": [
        {
          "name": "FeatureModule",
          "depth": 5,
          "fanIn": 3,
          "fanOut": 7
        }
      ]
    }
  }
}
```

### Provider Scope Analysis

Detects scope mismatches where Singleton providers depend on Request-scoped providers.

```bash
npx graph-analyzer --check-scope src/main.ts
```

**Detects:**
- Singleton providers depending on Request-scoped providers (memory leak risk)
- Scope inconsistencies that can cause unexpected behavior
- Provides suggestions for fixing scope issues

**Example Output:**
```json
{
  "analysis": {
    "scopeAnalysis": {
      "scopeMismatches": [
        {
          "provider": "UserService",
          "providerScope": "Singleton",
          "dependency": "RequestContext",
          "dependencyScope": "Request",
          "severity": "error",
          "message": "Singleton provider 'UserService' depends on Request-scoped provider 'RequestContext'",
          "suggestions": [
            "Change 'UserService' to Request scope",
            "Change 'RequestContext' to Singleton scope if it doesn't need request-specific state"
          ]
        }
      ]
    }
  }
}
```

### Missing Decorator Detection

Identifies dependencies that lack explicit `@Inject` decorators.

**Automatically detected in all analysis modes**

**Example Output:**
```json
{
  "providers": [
    {
      "token": "UserService",
      "dependencies": [
        {
          "type": "constructor",
          "index": 0,
          "token": "UserRepository",
          "hasExplicitDecorator": false,
          "raw": "private repo: UserRepository"
        }
      ]
    }
  ]
}
```

## 📊 Output Formats

### JSON Output

The JSON output provides a structured representation of your dependency graph with complete analysis results:

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
          "optional": false,
          "hasExplicitDecorator": true
        }
      ]
    }
  ],
  "analysis": {
    "circularDependencies": [],
    "unusedProviders": [],
    "depthAnalysis": { "maxDepth": 3, "averageDepth": 2.1 },
    "scopeAnalysis": { "scopeMismatches": [] }
  },
  "metadata": {
    "entryPoint": "/path/to/main.ts",
    "rootModule": "AppModule",
    "analyzedAt": "2025-01-18T12:00:00.000Z",
    "version": "0.1.0",
    "totalModules": 5,
    "totalProviders": 12
  }
}
```

### HTML Output (Interactive Visualization)

The HTML output provides an interactive graph visualization with:

**Features:**
- 🖱️ **Interactive Graph** - Click nodes to explore dependencies, pan and zoom
- 🎨 **Visual Hierarchy** - Modules as containers, providers as nodes
- 🔍 **Search** - Find modules and providers quickly
- 🎯 **Filtering** - View modules only, providers only, or all
- 🔗 **IDE Links** - Click to open source files in your IDE
- ⚠️ **Error Highlighting** - Visual indicators for circular dependencies, missing decorators
- 🌓 **Dark Theme** - Easy on the eyes
- 📊 **Statistics** - Module count, provider count, dependency count

**Example:**
```bash
npx graph-analyzer -f html --dark --ide vscode -o graph.html src/main.ts
```

Open `graph.html` in your browser to explore your dependency graph interactively.

### PNG Output

The PNG output is a static graph visualization showing:
- Modules as nodes
- Dependencies as directed edges
- Global modules highlighted
- Provider relationships

**Note:** Requires Graphviz to be installed on your system.

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

The package includes comprehensive tests covering all features:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

**Test Coverage**: 443 tests across 26 test files, covering:
- Parser components (entry file, modules, providers)
- Dependency extraction (constructor, property, TC39 decorators)
- Analysis features (circular, unused, depth, scope)
- Output formatters (JSON, HTML)
- Configuration and validation
- Error handling and edge cases

## 🔧 Troubleshooting

### Common Issues

#### "Cannot find module" errors

**Problem:** The analyzer can't resolve module imports.

**Solution:**
- Ensure your `tsconfig.json` has correct `paths` configuration
- Use the `-c` flag to specify the correct tsconfig file
- Check that all imported modules exist

```bash
npx graph-analyzer -c tsconfig.json src/main.ts
```

#### "No root module found" error

**Problem:** The entry file doesn't bootstrap a module.

**Solution:**
- Ensure your entry file calls `NsApplicationFactory.create()` or similar
- The entry file should import and bootstrap your root module

```typescript
// src/main.ts
import { NsApplicationFactory } from 'nexus-ioc';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NsApplicationFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

#### Circular dependency false positives

**Problem:** Circular dependencies reported for valid patterns.

**Solution:**
- Some circular dependencies are intentional (e.g., forwardRef)
- Review the reported cycles to determine if they're problematic
- Consider refactoring to break the cycle if it's causing issues

#### Missing decorators warnings

**Problem:** Warnings about missing `@Inject` decorators.

**Solution:**
- Add explicit `@Inject` decorators to all constructor parameters
- This is recommended for production code to avoid reflection issues

```typescript
// Before (may cause issues)
constructor(private service: MyService) {}

// After (recommended)
constructor(@Inject(MyService) private service: MyService) {}
```

#### HTML visualization not loading

**Problem:** HTML file opens but graph doesn't render.

**Solution:**
- Check browser console for errors
- Ensure the HTML file is opened from a local file or web server
- Try a different browser (Chrome, Firefox, Safari all supported)

#### Performance issues with large projects

**Problem:** Analysis takes too long or runs out of memory.

**Solution:**
- Analyze specific modules instead of the entire application
- Disable unnecessary analysis checks
- Increase Node.js memory limit:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx graph-analyzer src/main.ts
```

### Getting Help

If you encounter issues not covered here:

1. Check the [documentation](./docs)
2. Search [existing issues](https://github.com/Isqanderm/ioc/issues)
3. Create a [new issue](https://github.com/Isqanderm/ioc/issues/new) with:
   - Your environment (Node.js version, OS)
   - Complete error message
   - Minimal reproduction example

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Reporting Issues

- Use the [issue tracker](https://github.com/Isqanderm/ioc/issues)
- Include reproduction steps and environment details
- Check if the issue already exists before creating a new one

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Run linter (`npm run code:check`)
7. Commit your changes (`git commit -m 'feat: add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Isqanderm/ioc.git
cd ioc/packages/graph-analyzer

# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run code:check
```

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test additions or changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring

## 📄 License

MIT © 2024 [Aleksandr Melnik](https://github.com/Isqanderm)

See [LICENSE](./LICENSE) file for details.

## 🔗 Related Projects

- **[Nexus IoC](https://github.com/Isqanderm/ioc)** - The dependency injection framework this tool analyzes
- **[TypeScript](https://www.typescriptlang.org/)** - Language and compiler API used for static analysis
- **[Cytoscape.js](https://js.cytoscape.org/)** - Graph visualization library for HTML output
- **[Graphviz](https://graphviz.org/)** - Graph visualization engine for PNG output

## 📞 Support

- 🐛 **[Report a bug](https://github.com/Isqanderm/ioc/issues/new?labels=bug&template=bug_report.md)**
- 💡 **[Request a feature](https://github.com/Isqanderm/ioc/issues/new?labels=enhancement&template=feature_request.md)**
- 📖 **[Documentation](https://github.com/Isqanderm/ioc/tree/main/packages/graph-analyzer#readme)**
- 💬 **[Discussions](https://github.com/Isqanderm/ioc/discussions)**

## 🙏 Acknowledgments

- Built with [TypeScript Compiler API](https://github.com/microsoft/TypeScript)
- Inspired by [NestJS](https://nestjs.com/) and [Angular](https://angular.io/) dependency injection patterns
- Graph visualization powered by [Cytoscape.js](https://js.cytoscape.org/)

---

**Made with ❤️ by [Aleksandr Melnik](https://github.com/Isqanderm)**

