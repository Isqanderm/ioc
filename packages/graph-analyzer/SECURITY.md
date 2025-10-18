# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in @nexus-ioc/graph-analyzer, please report it by emailing **aleksandr.melnik.personal@gmail.com**.

**Please do not report security vulnerabilities through public GitHub issues.**

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: Within 7 days
  - High: Within 14 days
  - Medium: Within 30 days
  - Low: Next regular release

## Security Considerations

### Input Validation

The graph-analyzer performs static analysis on TypeScript code. While it doesn't execute user code, it does:

1. **Parse TypeScript Files**: Uses TypeScript Compiler API to parse source files
2. **Read Configuration**: Parses `tsconfig.json` files
3. **Generate Output**: Creates JSON, HTML, and PNG files

### Known Limitations

#### Dev Dependencies Vulnerabilities

As of version 0.1.0, there are **7 moderate severity vulnerabilities** in development dependencies (vitest and related packages):

- **Package**: esbuild <=0.24.2
- **Vulnerability**: GHSA-67mh-4wv8-2f99
- **Severity**: Moderate
- **Impact**: Development environment only (not included in published package)
- **Status**: Requires vitest v3 upgrade (breaking change)
- **Mitigation**: These vulnerabilities only affect the development/testing environment and are not included in the published npm package

**Why not fixed immediately?**
- Upgrading to vitest v3 would be a breaking change for contributors
- The vulnerabilities are in dev dependencies only and don't affect end users
- The published package does not include these dependencies
- We plan to upgrade in the next major version

### Security Best Practices Implemented

#### 1. Input Sanitization

**DOT Graph Generation** (`src/visualize/generator.ts`):
- All user input (module names, provider tokens) is escaped before being included in DOT format
- Prevents injection attacks in generated Graphviz files
- Escapes: backslashes, quotes, newlines, carriage returns

```typescript
private escapeDotString(str: string): string {
  return str
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/"/g, '\\"')    // Escape quotes
    .replace(/\n/g, "\\n")   // Escape newlines
    .replace(/\r/g, "\\r");  // Escape carriage returns
}
```

#### 2. Safe Configuration Parsing

**TypeScript Config Parser** (`src/parser/parse-ts-config.ts`):
- Guards against missing `compilerOptions` in tsconfig.json
- Prevents crashes when parsing malformed configuration files
- Returns safe defaults when configuration is incomplete

```typescript
if (!config.compilerOptions) {
  this.aliasPaths = {};
  this.srcPath = "";
  return;
}
```

#### 3. Circular Dependency Protection

**PNG Generation** (`src/visualize/graph-analyzer.ts`):
- Tracks visited modules to prevent infinite loops
- Protects against stack overflow from circular module imports
- Uses Set-based tracking for O(1) lookup performance

```typescript
const visited = new Set<string>();
for (const module of modules) {
  if (visited.has(module)) {
    continue;
  }
  visited.add(module);
  // ... process module
}
```

#### 4. No Sensitive Data

- No API keys, tokens, or credentials in codebase
- Example code uses placeholder values only
- `.gitignore` properly configured to exclude sensitive files
- `files` field in package.json limits published content

#### 5. Dependency Security

**Production Dependencies** (included in published package):
- `@phenomnomnominal/tsquery`: ^6.1.3 - No known vulnerabilities
- `cli-spinners`: ^3.2.0 - No known vulnerabilities

**Development Dependencies** (not included in published package):
- Regular security audits with `npm audit`
- Documented known vulnerabilities
- Plan to upgrade when breaking changes are acceptable

### What We Don't Do

To maintain security, the graph-analyzer:

1. **Does NOT execute user code** - Only performs static analysis using TypeScript AST
2. **Does NOT make network requests** - All analysis is local
3. **Does NOT access environment variables** - No runtime configuration from env
4. **Does NOT use eval() or Function()** - No dynamic code execution
5. **Does NOT access file system outside project** - Respects tsconfig.json boundaries

### Recommendations for Users

When using @nexus-ioc/graph-analyzer:

1. **Run in trusted environments** - The tool reads your source code
2. **Review generated HTML** - Before sharing, ensure no sensitive data is included
3. **Use in CI/CD safely** - The tool is safe for automated pipelines
4. **Keep dependencies updated** - Run `npm update` regularly
5. **Report issues** - If you find a security issue, please report it privately

### Security Checklist for Contributors

Before submitting code:

- [ ] No hardcoded credentials or API keys
- [ ] Input validation for all user-provided data
- [ ] No use of `eval()`, `Function()`, or similar dynamic execution
- [ ] Proper error handling that doesn't leak sensitive information
- [ ] No command injection vulnerabilities in CLI code
- [ ] No path traversal vulnerabilities in file operations
- [ ] Regular expressions tested for ReDoS vulnerabilities
- [ ] Dependencies reviewed for known vulnerabilities

## Security Updates

Security updates will be released as patch versions (e.g., 0.1.1, 0.1.2) and announced through:

1. GitHub Security Advisories
2. npm package changelog
3. GitHub Releases

## Contact

For security concerns, contact:
- **Email**: aleksandr.melnik.personal@gmail.com
- **GitHub**: [@Isqanderm](https://github.com/Isqanderm)

---

**Last Updated**: 2025-01-18

