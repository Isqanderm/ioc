# Contributing to Nexus IoC

Thank you for your interest in contributing to Nexus IoC! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Versioning and Publishing](#versioning-and-publishing)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ioc.git
   cd ioc
   ```

3. Install dependencies:
   ```bash
   npm ci
   ```

4. Build all packages:
   ```bash
   npm run build:all
   ```

5. Run tests to verify setup:
   ```bash
   npx lerna run test --stream
   ```

## Development Workflow

### Branch Naming Convention

Use descriptive branch names following this pattern:

- `feature/issue-XX-short-description` - New features
- `fix/issue-XX-short-description` - Bug fixes
- `docs/issue-XX-short-description` - Documentation updates
- `refactor/issue-XX-short-description` - Code refactoring
- `perf/issue-XX-short-description` - Performance improvements
- `test/issue-XX-short-description` - Test updates

### Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/issue-XX-your-feature
   ```

2. Make your changes following our [Coding Standards](#coding-standards)

3. Run linting and formatting:
   ```bash
   npx biome check --write .
   ```

4. Run tests:
   ```bash
   npx lerna run test --stream
   ```

5. Build packages:
   ```bash
   npm run build:all
   ```

## Coding Standards

### Code Style

We use [Biome](https://biomejs.dev/) for linting and formatting. The configuration is in `biome.json`.

**Key style rules:**

- Use **tabs** for indentation (width: 2)
- Maximum line length: **100 characters**
- Use **double quotes** for strings
- Always use **semicolons**
- Use **trailing commas** in multi-line structures
- Use **arrow parentheses** always: `(x) => x`

### TypeScript Guidelines

- Use **strict mode** TypeScript
- Prefer `const` over `let`, never use `var`
- Avoid `any` type - use `unknown` or proper types
- Use interfaces for object shapes
- Document public APIs with JSDoc comments
- Use meaningful variable and function names

### File Organization

```
packages/
├── ioc/              # Core IoC container
├── testing/          # Testing utilities
├── cli/              # CLI tools
└── shared/           # Shared interfaces
```

Each package should have:
- `src/` - Source code
- `__test__/` - Test files
- `dist/` - Compiled output (gitignored)
- `README.md` - Package documentation

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Test updates
- `build` - Build system changes
- `ci` - CI/CD changes
- `chore` - Other changes

### Scope

The scope should be the package name:
- `ioc` - @nexus-ioc/core
- `testing` - @nexus-ioc/testing
- `cli` - @nexus-ioc/cli
- `shared` - @nexus-ioc/shared
- `ci` - CI/CD changes

### Examples

```bash
feat(ioc): add support for async providers

fix(testing): resolve mock cleanup issue in TestingContainer

docs(cli): update README with new generate commands

perf(ioc): optimize dependency resolution algorithm
```

### Commit Message Rules

- Subject line max 100 characters
- Body lines max 100 characters
- Use imperative mood: "add" not "added"
- Reference issues: `Closes #123` or `Related to #456`

### Using Commitizen

We provide Commitizen for interactive commit messages:

```bash
npm run commit
```

This will guide you through creating a properly formatted commit message.

## Versioning and Publishing

**🎉 Good news!** Versioning and publishing are **fully automated** when your PR is merged to `main`.

### How It Works

1. **You commit** using conventional commit format (e.g., `feat:`, `fix:`)
2. **PR is merged** to `main` branch
3. **CI automatically:**
   - Analyzes your commits
   - Determines version bump (major/minor/patch)
   - Updates package.json versions
   - Generates CHANGELOG.md
   - Creates git tags
   - Publishes to NPM
   - Creates GitHub releases

### Version Bump Rules

- `feat:` → **Minor** version bump (0.x.0)
- `fix:` → **Patch** version bump (0.0.x)
- `BREAKING CHANGE:` → **Major** version bump (x.0.0)
- `docs:`, `chore:`, `style:` → **No** version bump

### Example

```bash
# Your commit
git commit -m "feat(core): add lazy loading support"

# After merge to main:
# @nexus-ioc/core: 0.4.2 → 0.5.0 ✅
# Automatically published to NPM ✅
```

**📚 For detailed information, see [docs/VERSIONING.md](docs/VERSIONING.md)**

## Pull Request Process

### Before Submitting

1. ✅ All tests pass locally
2. ✅ Code is properly formatted (`npx biome check --write .`)
3. ✅ No linting errors
4. ✅ Coverage maintained or improved
5. ✅ Documentation updated
6. ✅ Commits follow conventional commit format
7. ✅ **No need to update versions or CHANGELOG** - automated!

### Submitting a PR

1. Push your branch to your fork
2. Create a Pull Request against `main` branch
3. Fill out the PR template completely
4. Link related issues
5. Wait for CI checks to pass
6. Request review from maintainers

### PR Requirements

- ✅ Descriptive title following commit convention
- ✅ Completed PR template
- ✅ All CI checks passing
- ✅ No merge conflicts
- ✅ At least one approval from maintainers
- ✅ Coverage check passed (no coverage decrease)

### CI/CD Pipeline

Our CI pipeline runs the following checks:

**Stage 1: Unit Tests & Coverage**
- Linting (Biome)
- Unit tests with coverage
- Build all packages

**Stage 2: Coverage Protection**
- Compare coverage with main branch
- Block PR if coverage decreases

**Stage 3: Build Validation**
- Test builds on Node.js 18, 20, 22
- Verify package imports

**Stage 4: PR Validation**
- Create comprehensive validation comment

## Testing Guidelines

### Test Structure

```typescript
describe('Feature Name', () => {
  describe('Specific Functionality', () => {
    it('should do something specific', () => {
      // Arrange
      const input = ...;
      
      // Act
      const result = ...;
      
      // Assert
      expect(result).toBe(...);
    });
  });
});
```

### Coverage Requirements

- **@nexus-ioc/core**: 80% lines, 80% statements, 70% functions, 80% branches
- **@nexus-ioc/testing**: 80% lines, 80% statements, 70% functions, 80% branches
- **@nexus-ioc/cli**: 70% lines, 70% statements, 60% functions, 70% branches

### Running Tests

```bash
# Run all tests
npx lerna run test --stream

# Run tests with coverage
npx lerna run test:coverage --stream

# Run tests for specific package
cd packages/ioc && npm test

# Run tests in watch mode
cd packages/ioc && npm run test:watch
```

## Documentation

### Code Documentation

- Use JSDoc for public APIs
- Include examples in JSDoc
- Document parameters and return types
- Explain complex logic with comments

### README Updates

Update package README.md when:
- Adding new features
- Changing public APIs
- Adding new configuration options
- Updating usage examples

### CHANGELOG

Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Unreleased]

### Added
- New feature description

### Changed
- Changed feature description

### Fixed
- Bug fix description
```

## Questions?

If you have questions, please:
1. Check existing issues and discussions
2. Create a new issue with the `question` label
3. Join our community discussions

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for contributing to Nexus IoC! 🚀

