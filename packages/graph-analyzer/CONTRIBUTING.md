# Contributing to @nexus-ioc/graph-analyzer

Thank you for your interest in contributing to the Nexus IoC Graph Analyzer! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js >= 14.0.0
- npm >= 6.0.0
- Git
- TypeScript knowledge
- Familiarity with dependency injection patterns

### Finding Issues to Work On

- Check the [issue tracker](https://github.com/Isqanderm/ioc/issues)
- Look for issues labeled `good first issue` or `help wanted`
- Comment on the issue to let others know you're working on it

## Development Setup

1. **Fork the repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/ioc.git
   cd ioc/packages/graph-analyzer
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Build the package**

   ```bash
   npm run build
   ```

5. **Run tests**

   ```bash
   npm test
   ```

## Making Changes

### Branch Naming

Create a descriptive branch name:

- `feature/add-new-analyzer` - For new features
- `fix/circular-detection-bug` - For bug fixes
- `docs/update-readme` - For documentation
- `test/add-parser-tests` - For test additions
- `refactor/simplify-extractor` - For refactoring

```bash
git checkout -b feature/your-feature-name
```

### Code Organization

The project is organized as follows:

```
src/
├── analyzer/          # Analysis features (circular, unused, depth, scope)
├── cli.ts            # Command-line interface
├── config/           # Configuration schema and loader
├── interfaces/       # TypeScript interfaces
├── parser/           # AST parsing (entry, modules, providers)
├── utils/            # Utility functions
└── visualize/        # Output generation (JSON, HTML, PNG)
```

### Adding New Features

1. **Create tests first** (TDD approach recommended)
2. **Implement the feature**
3. **Update documentation**
4. **Add examples if applicable**

### Example: Adding a New Analyzer

```typescript
// src/analyzer/my-new-analyzer.ts
export class MyNewAnalyzer {
  constructor(private readonly graph: Map<string, ParseNsModule | ParseEntryFile>) {}

  analyze(): MyAnalysisResult {
    // Implementation
  }
}

// src/analyzer/__tests__/my-new-analyzer.spec.ts
describe('MyNewAnalyzer', () => {
  it('should analyze correctly', () => {
    // Test implementation
  });
});
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- my-new-analyzer
```

### Writing Tests

- Use Vitest as the test framework
- Follow the existing test patterns
- Aim for high coverage (>80%)
- Test edge cases and error conditions

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should handle normal case', () => {
    // Arrange
    const input = createTestInput();
    
    // Act
    const result = myFeature(input);
    
    // Assert
    expect(result).toBe(expected);
  });

  it('should handle edge case', () => {
    // Test edge cases
  });

  it('should throw error for invalid input', () => {
    expect(() => myFeature(null)).toThrow();
  });
});
```

## Submitting Changes

### Before Submitting

1. **Run all tests**
   ```bash
   npm test
   ```

2. **Run linter**
   ```bash
   npm run code:check
   ```

3. **Build the package**
   ```bash
   npm run build
   ```

4. **Update documentation** if needed

### Creating a Pull Request

1. **Push your changes**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub

3. **Fill out the PR template** with:
   - Description of changes
   - Related issue number
   - Testing performed
   - Screenshots (if UI changes)

4. **Wait for review** and address feedback

### Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation as needed
- Ensure all CI checks pass
- Respond to review comments promptly

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide type annotations for public APIs
- Avoid `any` type unless absolutely necessary
- Use interfaces for object shapes

### Code Style

We use Biome for code formatting and linting:

```bash
# Check code style
npm run code:check

# Auto-fix issues
npm run code:check:apply

# Format code
npm run code:format
```

### Naming Conventions

- **Classes**: PascalCase (`CircularDependencyDetector`)
- **Interfaces**: PascalCase with descriptive names (`GraphOutput`, `ProviderInfo`)
- **Functions**: camelCase (`analyzeGraph`, `extractDependencies`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_THRESHOLD`)
- **Files**: kebab-case (`circular-dependency-detector.ts`)

### Documentation

- Add JSDoc comments for public APIs
- Include `@example` blocks for complex functions
- Document parameters and return types
- Explain non-obvious logic with inline comments

```typescript
/**
 * Detects circular dependencies in the dependency graph
 *
 * Uses depth-first search (DFS) to find cycles in both module imports
 * and provider dependencies.
 *
 * @param graph - Map of module names to parsed modules
 * @returns Analysis results with detected circular dependencies
 *
 * @example
 * ```typescript
 * const detector = new CircularDependencyDetector(graph);
 * const result = detector.analyze();
 * if (result.hasCircularDependencies) {
 *   console.error('Circular dependencies found!');
 * }
 * ```
 */
export function detectCircularDependencies(graph: ModuleGraph): AnalysisResult {
  // Implementation
}
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions or changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks
- `style`: Code style changes (formatting)

### Examples

```
feat(analyzer): add unused provider detection

Implement UnusedProviderDetector to find providers that are
registered but never injected as dependencies.

Closes #123
```

```
fix(parser): handle factory providers with inject arrays

Remove extra quotes from tokens in factory provider inject arrays.
This fixes incorrect dependency resolution for useFactory providers.

Fixes #456
```

### Scope

Use the component being modified:
- `analyzer` - Analysis features
- `parser` - AST parsing
- `cli` - Command-line interface
- `visualize` - Output generation
- `config` - Configuration
- `docs` - Documentation

## Questions?

If you have questions:

1. Check the [documentation](./docs)
2. Search [existing issues](https://github.com/Isqanderm/ioc/issues)
3. Ask in [discussions](https://github.com/Isqanderm/ioc/discussions)
4. Create a new issue

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to @nexus-ioc/graph-analyzer! 🎉

