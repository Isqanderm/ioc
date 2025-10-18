# CLI Usage Guide

Complete guide to using the Nexus IoC Graph Analyzer command-line interface.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Command Reference](#command-reference)
- [Output Formats](#output-formats)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Installation

### Local Installation (Recommended)

Install as a development dependency in your project:

```bash
npm install --save-dev graph-analyzer
```

Then use via npm scripts or npx:

```bash
# Via npx
npx graph-analyzer src/main.ts

# Via npm script (add to package.json)
{
  "scripts": {
    "analyze": "graph-analyzer src/main.ts"
  }
}
npm run analyze
```

### Global Installation

Install globally to use from anywhere:

```bash
npm install -g graph-analyzer
```

Then use directly:

```bash
graph-analyzer src/main.ts
```

## Basic Usage

### Simplest Command

```bash
graph-analyzer src/main.ts
```

This will:
1. Analyze `src/main.ts` as the entry point
2. Look for `tsconfig.json` in the current directory
3. Generate `graph.json` with dependency data
4. Generate `graph.png` with visualization

### Common Patterns

```bash
# JSON output only
graph-analyzer -f json src/main.ts

# PNG output only
graph-analyzer -f png src/main.ts

# Custom output path
graph-analyzer -o output/dependencies.json src/main.ts

# Custom tsconfig
graph-analyzer -c tsconfig.build.json src/main.ts

# All options combined
graph-analyzer -c config/tsconfig.json -f json -o dist/graph.json src/main.ts
```

## Command Reference

### Syntax

```
graph-analyzer [options] <entry-file>
```

### Arguments

#### `<entry-file>` (Required)

Path to your application's entry point file.

**Examples**:
```bash
graph-analyzer src/main.ts
graph-analyzer ./app/index.ts
graph-analyzer packages/server/src/bootstrap.ts
```

**Requirements**:
- Must be a TypeScript file (.ts)
- Must contain a Nexus IoC bootstrap call
- Must be accessible from current directory

### Options

#### `-c, --config <path>`

Specify path to tsconfig.json file.

**Default**: `./tsconfig.json`

**Examples**:
```bash
# Use tsconfig in subdirectory
graph-analyzer -c config/tsconfig.json src/main.ts

# Use build-specific config
graph-analyzer -c tsconfig.build.json src/main.ts

# Absolute path
graph-analyzer -c /path/to/tsconfig.json src/main.ts
```

**Behavior**:
- If file not found, searches parent directories
- If still not found, uses default TypeScript options
- Path aliases from tsconfig are respected

#### `-o, --output <path>`

Specify output file path.

**Default**: 
- `./graph.json` for JSON format
- `./graph.png` for PNG format

**Examples**:
```bash
# Custom JSON output
graph-analyzer -f json -o dependencies.json src/main.ts

# Custom PNG output
graph-analyzer -f png -o docs/architecture.png src/main.ts

# Output to subdirectory
graph-analyzer -o output/graph.json src/main.ts
```

**Notes**:
- Directory must exist (not created automatically)
- Existing files will be overwritten
- For "both" format, creates two files with appropriate extensions

#### `-f, --format <format>`

Specify output format.

**Options**: `json`, `png`, `both`

**Default**: `both`

**Examples**:
```bash
# JSON only
graph-analyzer -f json src/main.ts

# PNG only
graph-analyzer -f png src/main.ts

# Both formats (default)
graph-analyzer -f both src/main.ts
graph-analyzer src/main.ts  # Same as above
```

**Format Details**:

| Format | Output | Use Case |
|--------|--------|----------|
| `json` | Structured JSON data | Programmatic analysis, CI/CD, documentation generation |
| `png` | Visual graph image | Documentation, presentations, quick overview |
| `both` | JSON + PNG | Complete analysis with both data and visualization |

#### `-h, --help`

Display help message and exit.

```bash
graph-analyzer --help
graph-analyzer -h
```

**Output**:
```
Nexus IoC Graph Analyzer

Analyze and visualize dependency injection graphs in Nexus IoC applications.

Usage:
  graph-analyzer [options] <entry-file>

Arguments:
  entry-file              Path to application entry point (e.g., src/main.ts)

Options:
  -c, --config <path>     Path to tsconfig.json (default: ./tsconfig.json)
  -o, --output <path>     Output file path (default: ./graph.json or ./graph.png)
  -f, --format <format>   Output format: json, png, or both (default: both)
  -h, --help              Display this help message
  -v, --version           Display version number

Examples:
  graph-analyzer src/main.ts
  graph-analyzer -f json -o output.json src/main.ts
  graph-analyzer -c tsconfig.build.json src/main.ts

For more information, visit: https://github.com/Isqanderm/ioc
```

#### `-v, --version`

Display version number and exit.

```bash
graph-analyzer --version
graph-analyzer -v
```

**Output**:
```
0.0.1
```

## Output Formats

### JSON Format

Structured data representation of the dependency graph.

**File**: `graph.json` (or custom path)

**Structure**:
```json
{
  "modules": [...],      // Array of module information
  "providers": [...],    // Array of provider information
  "metadata": {...}      // Analysis metadata
}
```

**Use Cases**:
- Automated analysis in CI/CD pipelines
- Generating documentation
- Detecting circular dependencies
- Finding unused providers
- Validating architecture rules

**Example Analysis**:
```bash
# Generate JSON
graph-analyzer -f json src/main.ts

# Analyze with jq
cat graph.json | jq '.providers | length'  # Count providers
cat graph.json | jq '.modules[] | select(.isGlobal == true)'  # Find global modules
```

### PNG Format

Visual graph representation using Graphviz.

**File**: `graph.png` (or custom path)

**Visual Elements**:
- **Nodes**: Modules
- **Edges**: Dependencies
- **Colors**: Different provider types
- **Shapes**: Global vs regular modules

**Use Cases**:
- Documentation
- Architecture presentations
- Onboarding new developers
- Quick visual overview

**Requirements**:
- Graphviz must be installed on the system
- `dot` command must be in PATH

**Install Graphviz**:
```bash
# macOS
brew install graphviz

# Ubuntu/Debian
sudo apt-get install graphviz

# Windows
choco install graphviz
```

### Both Formats

Generate both JSON and PNG outputs.

**Files**: `graph.json` and `graph.png`

**Example**:
```bash
graph-analyzer src/main.ts
# Creates:
# - ./graph.json
# - ./graph.png
```

## Configuration

### TypeScript Configuration

The analyzer respects your tsconfig.json settings:

**Path Aliases**:
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@app/*": ["app/*"],
      "@shared/*": ["shared/*"]
    }
  }
}
```

These aliases are resolved when analyzing imports.

**Compiler Options**:
- `target`: Affects AST parsing
- `module`: Affects module resolution
- `experimentalDecorators`: Required for legacy decorators
- `emitDecoratorMetadata`: Not required (static analysis)

### Project Structure

**Monorepo**:
```bash
# Analyze specific package
cd packages/api
graph-analyzer -c tsconfig.json src/main.ts

# Or from root
graph-analyzer -c packages/api/tsconfig.json packages/api/src/main.ts
```

**Multiple Entry Points**:
```bash
# Analyze different entry points
graph-analyzer -o api-graph.json src/api/main.ts
graph-analyzer -o worker-graph.json src/worker/main.ts
```

## Examples

### Example 1: Basic Analysis

```bash
graph-analyzer src/main.ts
```

**Output**:
```
Analyzing: /path/to/src/main.ts
Using tsconfig: /path/to/tsconfig.json
JSON output written to: ./graph.json
PNG output written to: ./graph.png

Analysis complete!
```

### Example 2: CI/CD Integration

```bash
#!/bin/bash
# analyze-dependencies.sh

# Generate JSON for analysis
graph-analyzer -f json -o dist/dependencies.json src/main.ts

# Check for circular dependencies
if grep -q "circular" dist/dependencies.json; then
  echo "Error: Circular dependencies detected!"
  exit 1
fi

# Count providers
PROVIDER_COUNT=$(cat dist/dependencies.json | jq '.providers | length')
echo "Total providers: $PROVIDER_COUNT"
```

### Example 3: Documentation Generation

```bash
# Generate PNG for docs
graph-analyzer -f png -o docs/architecture/dependency-graph.png src/main.ts

# Generate JSON for automated docs
graph-analyzer -f json -o docs/data/dependencies.json src/main.ts
```

### Example 4: Multiple Configurations

```bash
# Development config
graph-analyzer -c tsconfig.dev.json -o dev-graph.json src/main.ts

# Production config
graph-analyzer -c tsconfig.prod.json -o prod-graph.json src/main.ts

# Compare differences
diff dev-graph.json prod-graph.json
```

### Example 5: NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "analyze": "graph-analyzer src/main.ts",
    "analyze:json": "graph-analyzer -f json -o dist/graph.json src/main.ts",
    "analyze:png": "graph-analyzer -f png -o docs/graph.png src/main.ts",
    "analyze:ci": "graph-analyzer -f json -o coverage/dependencies.json src/main.ts"
  }
}
```

Usage:
```bash
npm run analyze
npm run analyze:json
npm run analyze:ci
```

## Troubleshooting

### Error: "File not found"

**Problem**: Entry file doesn't exist

**Solution**:
```bash
# Check file exists
ls -la src/main.ts

# Use correct path
graph-analyzer ./src/main.ts  # Relative
graph-analyzer /absolute/path/to/main.ts  # Absolute
```

### Error: "tsconfig.json not found"

**Problem**: TypeScript config not found

**Solution**:
```bash
# Specify config explicitly
graph-analyzer -c path/to/tsconfig.json src/main.ts

# Or create tsconfig.json
echo '{}' > tsconfig.json
```

### Error: "Empty entry module"

**Problem**: Entry file doesn't bootstrap a module

**Solution**:
Ensure your entry file has a bootstrap call:
```typescript
// src/main.ts
import { NexusFactory } from '@nexus-ioc/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NexusFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
```

### Error: "Graphviz not found"

**Problem**: PNG generation requires Graphviz

**Solution**:
```bash
# Install Graphviz
brew install graphviz  # macOS
sudo apt-get install graphviz  # Linux

# Or use JSON only
graph-analyzer -f json src/main.ts
```

### Warning: "Could not resolve import"

**Problem**: Import path cannot be resolved

**Solution**:
1. Check tsconfig.json path aliases
2. Ensure all dependencies are installed
3. Verify import paths are correct

### Performance Issues

**Problem**: Analysis is slow

**Solutions**:
- Reduce number of modules
- Use more specific entry point
- Check for circular dependencies
- Ensure tsconfig.json is optimized

## Advanced Usage

### Programmatic Usage

For more control, use the programmatic API:

```typescript
import { GraphAnalyzer } from 'graph-analyzer';
// See API_REFERENCE.md for details
```

### Custom Output Processing

```bash
# Generate JSON and process
graph-analyzer -f json -o - src/main.ts | jq '.providers'

# Pipe to custom script
graph-analyzer -f json src/main.ts
node process-graph.js graph.json
```

### Integration with Other Tools

```bash
# Generate and commit
graph-analyzer -o docs/graph.png src/main.ts
git add docs/graph.png
git commit -m "docs: update dependency graph"

# Generate and upload
graph-analyzer -f png -o graph.png src/main.ts
aws s3 cp graph.png s3://my-bucket/docs/
```

## Getting Help

- 📖 [README](../README.md) - Overview and quick start
- 🏗️ [Architecture](./ARCHITECTURE.md) - Technical details
- 📚 [API Reference](./API_REFERENCE.md) - Programmatic usage
- 🐛 [Issues](https://github.com/Isqanderm/ioc/issues) - Report bugs
- 💡 [Discussions](https://github.com/Isqanderm/ioc/discussions) - Ask questions

