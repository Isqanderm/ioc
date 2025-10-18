# Graph Analyzer Architecture

This document explains the technical architecture of the Nexus IoC Graph Analyzer, including how it works internally and the design decisions behind it.

## Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Core Components](#core-components)
- [Analysis Pipeline](#analysis-pipeline)
- [Dependency Extraction](#dependency-extraction)
- [Design Decisions](#design-decisions)
- [Performance Considerations](#performance-considerations)

## Overview

The Graph Analyzer is a static analysis tool that builds a complete dependency injection graph from TypeScript source code without executing it. It uses the TypeScript Compiler API to parse and analyze code, extracting metadata about modules, providers, and their dependencies.

### Key Principles

1. **Static Analysis Only** - No code execution required
2. **AST-Based** - Uses TypeScript's Abstract Syntax Tree
3. **Decorator-Aware** - Understands both legacy and TC39 Stage 3 decorators
4. **Import Resolution** - Follows module imports to build complete graph
5. **Type-Safe** - Leverages TypeScript's type system

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Entry Point                          │
│                      (CLI or API)                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ParseTsConfig                             │
│              (Load TypeScript Config)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ParseEntryFile                            │
│            (Find Root Module from Entry)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Module Traversal                           │
│         (Recursively Parse All Modules)                     │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ ParseNsModule│───▶│ ParseNsModule│───▶│ ParseNsModule│ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Provider Analysis                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ ClassParser  │  │UseValueParser│  │UseFactoryPar.│     │
│  └──────┬───────┘  └──────────────┘  └──────────────┘     │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────┐                      │
│  │   DependencyExtractor            │                      │
│  │ (Extract @Inject, @Optional)     │                      │
│  └──────────────────────────────────┘                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Graph Building                             │
│         (Construct Dependency Graph)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Output Generation                           │
│                                                             │
│  ┌──────────────┐              ┌──────────────┐           │
│  │JsonFormatter │              │GraphVisualizer│           │
│  │  (JSON Data) │              │  (PNG Image)  │           │
│  └──────────────┘              └──────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. ParseTsConfig

**Purpose**: Load and parse TypeScript configuration

**Responsibilities**:
- Read tsconfig.json
- Parse compiler options
- Resolve path aliases
- Provide configuration to other components

**Key Methods**:
- `constructor(configContent, basePath)` - Initialize with config
- `getCompilerOptions()` - Get TypeScript compiler options

### 2. ParseEntryFile

**Purpose**: Parse the application entry point

**Responsibilities**:
- Find the root module from entry file
- Extract bootstrap information
- Identify the starting point for graph traversal

**Key Methods**:
- `parse()` - Parse entry file and find root module
- `getName()` - Get root module name

### 3. ParseNsModule

**Purpose**: Parse individual Nexus IoC modules

**Responsibilities**:
- Extract module metadata (@NsModule decorator)
- Parse imports, exports, providers
- Identify global modules
- Trigger provider parsing

**Key Methods**:
- `parse()` - Parse module decorator and metadata
- `getProviders()` - Get module's providers
- `getImports()` - Get imported modules

### 4. Provider Parsers

**ClassParser**: Parses class providers
- Extracts class metadata
- Triggers dependency extraction
- Handles scope (Singleton, Transient, Request)

**UseValueParser**: Parses value providers
- Extracts static values
- No dependency extraction needed

**UseFactoryParser**: Parses factory providers
- Extracts factory function
- Analyzes factory dependencies

**UseClassParser**: Parses class-based providers
- Similar to ClassParser
- Handles interface-to-implementation mapping

### 5. DependencyExtractor

**Purpose**: Extract dependency injection metadata from classes

**Responsibilities**:
- Parse @Inject decorators on constructor parameters
- Parse @Inject decorators on properties
- Detect @Optional decorators
- Support TC39 Stage 3 static dependencies
- Identify token types (class, string, symbol)

**Key Methods**:
- `extractDependencies(classDeclaration)` - Main extraction method
- `extractConstructorDependencies()` - Constructor injection
- `extractPropertyDependencies()` - Property injection
- `extractStaticDependencies()` - TC39 Stage 3 pattern

**Algorithm**:

```typescript
1. Find class declaration in AST
2. Check for static dependencies array (TC39 Stage 3)
   - If found, parse structured dependency objects
   - Return early
3. Find constructor
   - For each parameter:
     - Check for @Inject decorator
     - Extract token (class, string, or symbol)
     - Check for @Optional decorator
     - Store with index
4. Find properties
   - For each property:
     - Check for @Inject decorator
     - Extract token
     - Check for @Optional decorator
     - Store with property name
5. Return combined dependencies
```

### 6. GraphAnalyzer

**Purpose**: Coordinate analysis and output generation

**Responsibilities**:
- Accept module graph
- Generate JSON output via JsonFormatter
- Generate PNG output via Graphviz
- Handle output format options

**Key Methods**:
- `parse()` - Main analysis method
- `generateJson()` - Create JSON output
- `generatePng()` - Create PNG visualization

### 7. JsonFormatter

**Purpose**: Format graph as structured JSON

**Responsibilities**:
- Traverse module graph
- Extract all metadata
- Create structured output
- Generate statistics

**Output Structure**:
```typescript
interface GraphOutput {
  modules: ModuleInfo[];
  providers: ProviderInfo[];
  metadata: GraphMetadata;
}
```

## Analysis Pipeline

### Phase 1: Configuration Loading

```typescript
const tsConfig = new ParseTsConfig(configContent, basePath);
```

- Loads tsconfig.json
- Parses compiler options
- Sets up path alias resolution

### Phase 2: Entry Point Analysis

```typescript
const entryFile = new ParseEntryFile(sourceFile, filePath, tsConfig);
entryFile.parse();
const rootModuleName = entryFile.getName();
```

- Parses entry file (e.g., main.ts)
- Finds bootstrap call
- Extracts root module name

### Phase 3: Module Graph Traversal

```typescript
const modulesGraph = new Map();
// Recursive traversal
function traverseModule(moduleName) {
  const module = new ParseNsModule(sourceFile, filePath, tsConfig);
  module.parse();
  modulesGraph.set(moduleName, module);
  
  for (const importedModule of module.getImports()) {
    if (!modulesGraph.has(importedModule)) {
      traverseModule(importedModule);
    }
  }
}
```

- Starts from root module
- Recursively follows imports
- Builds complete module graph
- Detects circular imports

### Phase 4: Provider Analysis

For each module:

```typescript
const providers = module.getProviders();
for (const provider of providers) {
  const parser = selectParser(provider); // ClassParser, UseValueParser, etc.
  const metadata = parser.parse();
  
  if (parser instanceof ClassParser) {
    const dependencies = dependencyExtractor.extractDependencies(classNode);
    metadata.dependencies = dependencies;
  }
}
```

- Parses each provider
- Extracts provider metadata
- For class providers, extracts dependencies

### Phase 5: Output Generation

```typescript
const analyzer = new GraphAnalyzer(modulesGraph, entryPoint, options);
const output = analyzer.parse();
```

- Creates GraphAnalyzer instance
- Generates requested output format(s)
- Writes to file(s)

## Dependency Extraction

### Legacy Decorators (TypeScript Experimental)

```typescript
@Injectable()
class UserService {
  constructor(
    @Inject(UserRepository) private repo: UserRepository
  ) {}
}
```

**AST Pattern**:
```
ClassDeclaration
└── Constructor
    └── Parameter
        └── Decorator (@Inject)
            └── CallExpression
                └── Argument (UserRepository)
```

**Extraction**:
1. Find constructor node
2. Iterate parameters
3. Find @Inject decorator
4. Extract argument as token
5. Check for @Optional decorator

### TC39 Stage 3 Decorators

```typescript
@Injectable()
class UserService {
  static dependencies = [
    { index: 0, token: UserRepository, optional: false }
  ];
}
```

**AST Pattern**:
```
ClassDeclaration
└── PropertyDeclaration (static dependencies)
    └── ArrayLiteralExpression
        └── ObjectLiteralExpression
            ├── index: 0
            ├── token: UserRepository
            └── optional: false
```

**Extraction**:
1. Find static dependencies property
2. Parse array literal
3. Extract structured objects
4. Map to Dependency interface

### Token Type Detection

```typescript
function detectTokenType(token: ts.Node): 'class' | 'string' | 'symbol' {
  if (ts.isIdentifier(token)) return 'class';
  if (ts.isStringLiteral(token)) return 'string';
  if (isSymbolExpression(token)) return 'symbol';
}
```

## Design Decisions

### Why TypeScript Compiler API?

**Pros**:
- Accurate AST parsing
- Type information available
- Handles all TypeScript syntax
- Well-maintained by Microsoft

**Cons**:
- Large dependency
- Complex API
- Performance overhead

**Decision**: The accuracy and completeness outweigh the complexity.

### Why tsquery?

**Pros**:
- CSS-selector-like syntax for AST queries
- Simpler than manual AST traversal
- Good for finding specific patterns

**Usage**:
```typescript
const decorators = tsquery(node, 'Decorator[expression.expression.name="Inject"]');
```

### Why Separate Parsers?

Each provider type (Class, UseValue, UseFactory, UseClass) has different parsing logic:
- **Separation of Concerns**: Each parser handles one type
- **Extensibility**: Easy to add new provider types
- **Testability**: Each parser can be tested independently

### Why Two-Phase Analysis?

1. **Module Traversal** - Build complete graph
2. **Dependency Extraction** - Extract detailed metadata

**Rationale**:
- Allows circular dependency detection
- Enables lazy loading of class files
- Separates graph structure from implementation details

## Performance Considerations

### Caching

- Parsed modules are cached in Map
- Prevents re-parsing same module
- Reduces file I/O

### Lazy Loading

- Class files loaded only when needed
- Import resolution on-demand
- Reduces memory footprint

### AST Reuse

- TypeScript AST is reused across parsers
- No re-parsing of same file
- Faster analysis

### Optimization Opportunities

1. **Parallel Parsing**: Parse independent modules in parallel
2. **Incremental Analysis**: Only re-analyze changed files
3. **AST Caching**: Cache parsed ASTs to disk
4. **Selective Analysis**: Only analyze specific modules

## Error Handling

### File Not Found

```typescript
if (!fs.existsSync(filePath)) {
  throw new Error(`File not found: ${filePath}`);
}
```

### Invalid Decorator

```typescript
if (!decorator || !decorator.expression) {
  console.warn(`Invalid decorator on ${className}`);
  continue;
}
```

### Circular Dependencies

```typescript
const visited = new Set();
function detectCircular(module, path = []) {
  if (visited.has(module)) {
    console.warn(`Circular dependency: ${path.join(' -> ')}`);
    return;
  }
  visited.add(module);
  // Continue traversal
}
```

## Future Enhancements

1. **Incremental Analysis**: Only re-analyze changed files
2. **Watch Mode**: Continuously monitor and update graph
3. **Plugin System**: Allow custom analyzers
4. **Performance Profiling**: Identify bottlenecks
5. **Validation Rules**: Detect anti-patterns
6. **Interactive Visualization**: Web-based graph explorer

