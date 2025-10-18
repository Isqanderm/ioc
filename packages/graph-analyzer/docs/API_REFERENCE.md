# API Reference

Complete API documentation for using the Graph Analyzer programmatically.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Classes](#core-classes)
- [Interfaces](#interfaces)
- [Usage Examples](#usage-examples)
- [Advanced Topics](#advanced-topics)

## Installation

```bash
npm install --save-dev graph-analyzer
```

## Quick Start

```typescript
import { GraphAnalyzer, ParseEntryFile, ParseTsConfig } from 'graph-analyzer';
import * as fs from 'fs';
import * as ts from 'typescript';

// Load and parse entry file
const entryContent = fs.readFileSync('src/main.ts', 'utf8');
const sourceFile = ts.createSourceFile(
  'src/main.ts',
  entryContent,
  ts.ScriptTarget.Latest,
  true
);

// Parse TypeScript config
const tsConfigContent = fs.readFileSync('tsconfig.json', 'utf8');
const tsConfig = new ParseTsConfig(tsConfigContent, process.cwd());

// Parse entry file
const entryFile = new ParseEntryFile(sourceFile, 'src/main.ts', tsConfig);
entryFile.parse();

// Build module graph (simplified - see full example below)
const modulesGraph = new Map();
modulesGraph.set('entry', entryFile);

// Analyze and generate output
const analyzer = new GraphAnalyzer(modulesGraph, 'src/main.ts', {
  outputFormat: 'json',
  jsonOutputPath: './graph.json'
});

const output = analyzer.parse();
console.log(output);
```

## Core Classes

### GraphAnalyzer

Main class for analyzing dependency graphs and generating output.

#### Constructor

```typescript
constructor(
  graph: Map<string, ParseNsModule | ParseEntryFile>,
  entryPoint: string,
  options?: GraphAnalyzerOptions
)
```

**Parameters**:
- `graph`: Map of module name to parsed module
- `entryPoint`: Path to entry file
- `options`: Optional configuration

**Options**:
```typescript
interface GraphAnalyzerOptions {
  outputFormat?: 'json' | 'png' | 'both';
  outputPath?: string;
  jsonOutputPath?: string;
  pngOutputPath?: string;
}
```

#### Methods

##### `parse(): GraphOutput | void`

Analyze the graph and generate output based on format option.

**Returns**:
- `GraphOutput` if format is 'json' or 'both'
- `void` if format is 'png'

**Example**:
```typescript
const analyzer = new GraphAnalyzer(graph, 'src/main.ts', {
  outputFormat: 'json'
});
const output = analyzer.parse();
```

##### `generateJson(): GraphOutput`

Generate JSON output.

**Returns**: `GraphOutput` object

**Example**:
```typescript
const jsonOutput = analyzer.generateJson();
console.log(jsonOutput.metadata.totalProviders);
```

##### `generatePng(): void`

Generate PNG visualization using Graphviz.

**Side Effects**: Writes PNG file to disk

**Example**:
```typescript
analyzer.generatePng();
```

---

### JsonFormatter

Formats dependency graph as structured JSON.

#### Constructor

```typescript
constructor(
  graph: Map<string, ParseNsModule | ParseEntryFile>,
  entryPoint: string
)
```

**Parameters**:
- `graph`: Module graph to format
- `entryPoint`: Entry file path

#### Methods

##### `format(): GraphOutput`

Format graph as structured object.

**Returns**: `GraphOutput` with modules, providers, and metadata

**Example**:
```typescript
const formatter = new JsonFormatter(graph, 'src/main.ts');
const output = formatter.format();
```

##### `formatAsString(indent?: number): string`

Format graph as JSON string.

**Parameters**:
- `indent`: Number of spaces for indentation (default: 2)

**Returns**: JSON string

**Example**:
```typescript
const jsonString = formatter.formatAsString(4);
fs.writeFileSync('graph.json', jsonString);
```

---

### DependencyExtractor

Extracts dependency injection metadata from classes.

#### Constructor

```typescript
constructor(
  sourceFile: ts.SourceFile,
  tsConfig: ParseTsConfig
)
```

**Parameters**:
- `sourceFile`: TypeScript source file
- `tsConfig`: TypeScript configuration

#### Methods

##### `extractDependencies(classDeclaration: ts.ClassDeclaration): Dependency[]`

Extract all dependencies from a class.

**Parameters**:
- `classDeclaration`: TypeScript class declaration node

**Returns**: Array of `Dependency` objects

**Example**:
```typescript
const extractor = new DependencyExtractor(sourceFile, tsConfig);
const dependencies = extractor.extractDependencies(classNode);
```

---

### ParseTsConfig

Parses and manages TypeScript configuration.

#### Constructor

```typescript
constructor(
  configContent: string,
  basePath: string
)
```

**Parameters**:
- `configContent`: tsconfig.json content as string
- `basePath`: Base directory path

**Example**:
```typescript
const content = fs.readFileSync('tsconfig.json', 'utf8');
const tsConfig = new ParseTsConfig(content, process.cwd());
```

#### Methods

##### `getCompilerOptions(): ts.CompilerOptions`

Get TypeScript compiler options.

**Returns**: Compiler options object

---

### ParseEntryFile

Parses application entry point file.

#### Constructor

```typescript
constructor(
  sourceFile: ts.SourceFile,
  filePath: string,
  tsConfig: ParseTsConfig
)
```

**Parameters**:
- `sourceFile`: TypeScript source file
- `filePath`: File path
- `tsConfig`: TypeScript configuration

#### Methods

##### `parse(): void`

Parse entry file and extract root module.

**Side Effects**: Populates internal state

##### `getName(): string | null`

Get root module name.

**Returns**: Module name or null

**Example**:
```typescript
const entryFile = new ParseEntryFile(sourceFile, 'src/main.ts', tsConfig);
entryFile.parse();
const rootModule = entryFile.getName(); // 'AppModule'
```

---

### ParseNsModule

Parses Nexus IoC module.

#### Constructor

```typescript
constructor(
  sourceFile: ts.SourceFile,
  filePath: string,
  tsConfig: ParseTsConfig
)
```

#### Methods

##### `parse(): void`

Parse module decorator and metadata.

##### `getProviders(): Provider[]`

Get module's providers.

**Returns**: Array of provider objects

##### `getImports(): string[]`

Get imported module names.

**Returns**: Array of module names

##### `getExports(): string[]`

Get exported provider tokens.

**Returns**: Array of token names

**Example**:
```typescript
const module = new ParseNsModule(sourceFile, 'app.module.ts', tsConfig);
module.parse();

const providers = module.getProviders();
const imports = module.getImports();
const exports = module.getExports();
```

---

## Interfaces

### GraphOutput

Complete graph analysis output.

```typescript
interface GraphOutput {
  modules: ModuleInfo[];
  providers: ProviderInfo[];
  metadata: GraphMetadata;
}
```

### ModuleInfo

Information about a single module.

```typescript
interface ModuleInfo {
  name: string;
  path: string;
  imports: string[];
  exports: string[];
  providers: string[];
  isGlobal: boolean;
}
```

### ProviderInfo

Information about a single provider.

```typescript
interface ProviderInfo {
  token: string;
  type: 'Class' | 'UseValue' | 'UseFactory' | 'UseClass';
  module: string;
  scope?: 'Singleton' | 'Transient' | 'Request';
  dependencies?: Dependency[];
  value?: any;
  factory?: string;
  useClass?: string;
}
```

### Dependency

Dependency injection metadata.

```typescript
interface Dependency {
  type: 'constructor' | 'property';
  index?: number;           // For constructor dependencies
  key?: string;             // For property dependencies
  token: string;
  tokenType: 'class' | 'string' | 'symbol';
  optional: boolean;
  raw?: string;
}
```

### GraphMetadata

Analysis metadata.

```typescript
interface GraphMetadata {
  entryPoint: string;
  rootModule: string;
  analyzedAt: string;
  version: string;
  totalModules: number;
  totalProviders: number;
}
```

---

## Usage Examples

### Example 1: Basic Analysis

```typescript
import { GraphAnalyzer, ParseEntryFile, ParseTsConfig } from 'graph-analyzer';
import * as fs from 'fs';
import * as ts from 'typescript';

function analyzeApplication(entryPath: string): void {
  // Load files
  const entryContent = fs.readFileSync(entryPath, 'utf8');
  const tsConfigContent = fs.readFileSync('tsconfig.json', 'utf8');
  
  // Parse
  const sourceFile = ts.createSourceFile(
    entryPath,
    entryContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  const tsConfig = new ParseTsConfig(tsConfigContent, process.cwd());
  const entryFile = new ParseEntryFile(sourceFile, entryPath, tsConfig);
  entryFile.parse();
  
  // Build graph
  const graph = new Map();
  graph.set('entry', entryFile);
  
  // Analyze
  const analyzer = new GraphAnalyzer(graph, entryPath, {
    outputFormat: 'both',
    jsonOutputPath: './output/graph.json',
    pngOutputPath: './output/graph.png'
  });
  
  analyzer.parse();
  console.log('Analysis complete!');
}

analyzeApplication('src/main.ts');
```

### Example 2: Extract Specific Information

```typescript
import { JsonFormatter } from 'graph-analyzer';

function findCircularDependencies(graph: Map<any, any>): string[] {
  const formatter = new JsonFormatter(graph, 'src/main.ts');
  const output = formatter.format();
  
  const circular: string[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  
  function visit(moduleName: string): void {
    if (stack.has(moduleName)) {
      circular.push(moduleName);
      return;
    }
    if (visited.has(moduleName)) return;
    
    visited.add(moduleName);
    stack.add(moduleName);
    
    const module = output.modules.find(m => m.name === moduleName);
    if (module) {
      module.imports.forEach(visit);
    }
    
    stack.delete(moduleName);
  }
  
  output.modules.forEach(m => visit(m.name));
  return circular;
}
```

### Example 3: Custom Output Processing

```typescript
import { JsonFormatter } from 'graph-analyzer';

interface DependencyReport {
  totalProviders: number;
  providersByType: Record<string, number>;
  unusedProviders: string[];
  globalModules: string[];
}

function generateReport(graph: Map<any, any>): DependencyReport {
  const formatter = new JsonFormatter(graph, 'src/main.ts');
  const output = formatter.format();
  
  // Count providers by type
  const providersByType: Record<string, number> = {};
  output.providers.forEach(p => {
    providersByType[p.type] = (providersByType[p.type] || 0) + 1;
  });
  
  // Find unused providers (not injected anywhere)
  const usedTokens = new Set<string>();
  output.providers.forEach(p => {
    p.dependencies?.forEach(d => usedTokens.add(d.token));
  });
  
  const unusedProviders = output.providers
    .map(p => p.token)
    .filter(token => !usedTokens.has(token));
  
  // Find global modules
  const globalModules = output.modules
    .filter(m => m.isGlobal)
    .map(m => m.name);
  
  return {
    totalProviders: output.metadata.totalProviders,
    providersByType,
    unusedProviders,
    globalModules
  };
}
```

### Example 4: Integration with Build Tools

```typescript
// webpack-plugin.ts
import { GraphAnalyzer } from 'graph-analyzer';

class DependencyGraphPlugin {
  apply(compiler: any) {
    compiler.hooks.emit.tapAsync(
      'DependencyGraphPlugin',
      (compilation: any, callback: any) => {
        // Analyze during build
        const analyzer = new GraphAnalyzer(/* ... */);
        const output = analyzer.parse();
        
        // Add to build assets
        compilation.assets['dependency-graph.json'] = {
          source: () => JSON.stringify(output, null, 2),
          size: () => JSON.stringify(output).length
        };
        
        callback();
      }
    );
  }
}
```

### Example 5: Validation Rules

```typescript
import { JsonFormatter, GraphOutput } from 'graph-analyzer';

interface ValidationRule {
  name: string;
  validate: (output: GraphOutput) => string[];
}

const rules: ValidationRule[] = [
  {
    name: 'No circular dependencies',
    validate: (output) => {
      // Implementation from Example 2
      return [];
    }
  },
  {
    name: 'All providers used',
    validate: (output) => {
      const errors: string[] = [];
      const usedTokens = new Set<string>();
      
      output.providers.forEach(p => {
        p.dependencies?.forEach(d => usedTokens.add(d.token));
      });
      
      output.providers.forEach(p => {
        if (!usedTokens.has(p.token) && !output.modules.some(m => m.exports.includes(p.token))) {
          errors.push(`Unused provider: ${p.token}`);
        }
      });
      
      return errors;
    }
  },
  {
    name: 'No missing dependencies',
    validate: (output) => {
      const errors: string[] = [];
      const availableTokens = new Set(output.providers.map(p => p.token));
      
      output.providers.forEach(p => {
        p.dependencies?.forEach(d => {
          if (!d.optional && !availableTokens.has(d.token)) {
            errors.push(`Missing dependency: ${d.token} required by ${p.token}`);
          }
        });
      });
      
      return errors;
    }
  }
];

function validateGraph(graph: Map<any, any>): void {
  const formatter = new JsonFormatter(graph, 'src/main.ts');
  const output = formatter.format();
  
  let hasErrors = false;
  
  rules.forEach(rule => {
    const errors = rule.validate(output);
    if (errors.length > 0) {
      console.error(`\n❌ ${rule.name}:`);
      errors.forEach(err => console.error(`  - ${err}`));
      hasErrors = true;
    } else {
      console.log(`✅ ${rule.name}`);
    }
  });
  
  if (hasErrors) {
    process.exit(1);
  }
}
```

## Advanced Topics

### Custom Parsers

Extend the parser system for custom provider types:

```typescript
import { ProviderParser } from 'graph-analyzer';

class CustomProviderParser extends ProviderParser {
  parse(): Provider {
    // Custom parsing logic
    return {
      token: 'CustomToken',
      type: 'Custom',
      // ...
    };
  }
}
```

### AST Manipulation

Work directly with TypeScript AST:

```typescript
import * as ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';

function findAllInjectDecorators(sourceFile: ts.SourceFile): ts.Decorator[] {
  return tsquery(
    sourceFile,
    'Decorator[expression.expression.name="Inject"]'
  ) as ts.Decorator[];
}
```

### Performance Optimization

For large codebases:

```typescript
// Cache parsed modules
const moduleCache = new Map<string, ParseNsModule>();

function getOrParseModule(path: string): ParseNsModule {
  if (moduleCache.has(path)) {
    return moduleCache.get(path)!;
  }
  
  const module = new ParseNsModule(/* ... */);
  module.parse();
  moduleCache.set(path, module);
  return module;
}
```

## TypeScript Types

All types are exported and can be imported:

```typescript
import type {
  GraphOutput,
  ModuleInfo,
  ProviderInfo,
  Dependency,
  GraphMetadata,
  GraphAnalyzerOptions
} from 'graph-analyzer';
```

## Error Handling

```typescript
try {
  const analyzer = new GraphAnalyzer(graph, entryPoint);
  const output = analyzer.parse();
} catch (error) {
  if (error.message.includes('Empty entry module')) {
    console.error('No root module found in entry file');
  } else if (error.message.includes('File not found')) {
    console.error('Entry file does not exist');
  } else {
    console.error('Analysis failed:', error);
  }
}
```

## See Also

- [README](../README.md) - Overview and quick start
- [CLI Guide](./CLI_GUIDE.md) - Command-line usage
- [Architecture](./ARCHITECTURE.md) - Technical details

