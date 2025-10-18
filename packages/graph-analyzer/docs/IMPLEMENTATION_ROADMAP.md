# Graph Analyzer - Complete Implementation Roadmap

## 📋 Executive Summary

This document provides a complete roadmap for finishing the `graph-analyzer` package. The package is currently ~40% complete with basic AST parsing and module traversal working. The remaining work is organized into 3 phases with clear priorities.

## 🎯 Current Status

### ✅ What's Working
- Basic TypeScript AST parsing with `@phenomnomnominal/tsquery`
- Entry point file parsing to find root module
- @NsModule decorator parsing (imports, providers, exports)
- Module traversal and graph building
- Provider type detection (Class, UseValue, UseFactory, UseClass)
- TypeScript path alias resolution
- Graphviz DOT format generation
- PNG visualization output

### ❌ What's Missing (Critical)
- **Dependency injection metadata extraction** (P0) - No extraction of @Inject decorators
- **JSON output format** (P0) - Only PNG visualization exists
- **CLI interface** (P0) - Entry point is hardcoded
- **Error handling** (P1) - No validation or error messages
- **Tests** (P1) - No test coverage
- **Documentation** (P1) - Placeholder README

## 🗺️ Implementation Phases

### Phase 1: Core Functionality (P0) - 2-3 days

**Goal**: Make the tool actually usable with complete dependency extraction and JSON output.

#### 1.1 Dependency Injection Metadata Extraction (8-10 hours)
**Priority**: P0 - CRITICAL
**Complexity**: High
**Detailed Plan**: See `DEPENDENCY_EXTRACTION_IMPLEMENTATION_PLAN.md`

**What to Build:**
- Extract constructor dependencies from @Inject decorators
- Extract property dependencies from @Inject decorators
- Support class, string, and symbol tokens
- Detect @Optional decorator
- Support TC39 Stage 3 static dependencies pattern

**Files to Modify:**
- `src/parser/provider/class-parser.ts` - Add dependency extraction
- `src/interfaces/providers.interface.ts` - Add Dependency interface

**Deliverables:**
- ClassParser extracts complete dependency metadata
- Unit tests for all dependency patterns
- Integration test with example app

#### 1.2 JSON Output Format (4-6 hours)
**Priority**: P0 - CRITICAL
**Complexity**: Medium

**What to Build:**
Implement JSON serialization of the complete dependency graph:

```typescript
interface GraphOutput {
  modules: ModuleInfo[];
  providers: ProviderInfo[];
  metadata: {
    entryPoint: string;
    rootModule: string;
    analyzedAt: string;
    version: string;
  };
}

interface ModuleInfo {
  name: string;
  path: string;
  imports: string[];
  exports: string[];
  providers: string[];
  isGlobal: boolean;
}

interface ProviderInfo {
  token: string;
  type: "Class" | "UseValue" | "UseFactory" | "UseClass";
  module: string;
  scope?: "Singleton" | "Request" | "Transient";
  dependencies: Dependency[];
  value?: string;  // For UseValue
  factory?: string;  // For UseFactory
}

interface Dependency {
  type: "constructor" | "property";
  index?: number;
  key?: string;
  token: string;
  tokenType: "class" | "string" | "symbol";
  optional: boolean;
}
```

**Files to Create:**
- `src/output/json-serializer.ts` - JSON serialization logic
- `src/output/json-writer.ts` - File writing logic
- `src/interfaces/output.interface.ts` - Output type definitions

**Files to Modify:**
- `src/visualize/graph-analyzer.ts` - Add `toJSON()` and `saveJSON()` methods

**Deliverables:**
- Complete JSON output with all metadata
- File writing with proper error handling
- Schema validation
- Example JSON output in docs

#### 1.3 CLI Interface (3-4 hours)
**Priority**: P0 - CRITICAL
**Complexity**: Low

**What to Build:**
Command-line interface for running the analyzer:

```bash
# Basic usage
graph-analyzer analyze ./src/main.ts --output ./graph.json

# With options
graph-analyzer analyze ./src/main.ts \
  --output ./graph.json \
  --format json \
  --tsconfig ./tsconfig.json \
  --visualize ./graph.png

# Help
graph-analyzer --help
```

**Files to Create:**
- `src/cli/index.ts` - CLI entry point
- `src/cli/commands/analyze.command.ts` - Analyze command
- `src/cli/options.ts` - CLI options parser
- `bin/graph-analyzer` - Executable script

**Files to Modify:**
- `package.json` - Add bin entry and CLI dependencies

**Dependencies to Add:**
- `commander` - CLI framework
- `chalk` - Terminal colors
- `ora` - Loading spinners

**Deliverables:**
- Working CLI with all options
- Help documentation
- Error messages and validation
- Progress indicators

### Phase 2: Quality & Reliability (P1) - 2-3 days

**Goal**: Make the tool production-ready with tests, error handling, and documentation.

#### 2.1 Error Handling & Validation (4-6 hours)
**Priority**: P1 - Important
**Complexity**: Medium

**What to Build:**
- Input validation (file exists, is TypeScript, etc.)
- AST parsing error handling
- Circular dependency detection
- Missing import warnings
- Invalid decorator warnings
- Graceful degradation

**Files to Modify:**
- All parser files - Add try-catch and validation
- `src/parser/parser-rec.ts` - Add error collection
- Create `src/errors/` directory with custom error classes

**Deliverables:**
- Comprehensive error messages
- Warning system for non-critical issues
- Error recovery where possible
- Error documentation

#### 2.2 Testing (8-10 hours)
**Priority**: P1 - Important
**Complexity**: Medium

**What to Build:**
- Unit tests for all parsers
- Integration tests for complete flows
- Test fixtures with various patterns
- Edge case coverage

**Test Coverage Goals:**
- Parser functions: 90%+
- CLI commands: 80%+
- Overall: 80%+

**Files to Create:**
- `__tests__/` directories in each module
- `fixtures/` directory with test cases
- `jest.config.js` - Test configuration

**Deliverables:**
- Comprehensive test suite
- CI/CD integration
- Coverage reports
- Test documentation

#### 2.3 Documentation (4-6 hours)
**Priority**: P1 - Important
**Complexity**: Low

**What to Build:**
- Complete README with examples
- API documentation
- CLI usage guide
- Architecture documentation
- Contributing guide

**Files to Create/Update:**
- `README.md` - Complete user guide
- `docs/API.md` - API reference
- `docs/ARCHITECTURE.md` - System design
- `docs/EXAMPLES.md` - Usage examples
- `CONTRIBUTING.md` - Development guide

**Deliverables:**
- Professional documentation
- Code examples
- Troubleshooting guide
- FAQ section

### Phase 3: Advanced Features (P2) - 1-2 days

**Goal**: Add nice-to-have features that enhance usability.

#### 3.1 Integration with @nexus-ioc/cli (3-4 hours)
**Priority**: P2 - Nice to have
**Complexity**: Medium

**What to Build:**
- Add graph-analyzer as a command in @nexus-ioc/cli
- Shared configuration
- Unified output format

**Files to Modify:**
- `packages/cli/src/commands/` - Add analyze command
- `packages/cli/package.json` - Add dependency

**Deliverables:**
- Integrated CLI command
- Shared configuration
- Documentation update

#### 3.2 Advanced Analysis Features (4-6 hours)
**Priority**: P2 - Nice to have
**Complexity**: Medium-High

**What to Build:**
- Circular dependency detection and reporting
- Unused provider detection
- Module coupling metrics
- Dependency depth analysis
- Export/import mismatch detection

**Files to Create:**
- `src/analysis/circular-detector.ts`
- `src/analysis/unused-detector.ts`
- `src/analysis/metrics.ts`

**Deliverables:**
- Advanced analysis reports
- Actionable recommendations
- Metrics dashboard (JSON)

#### 3.3 Dynamic Module Support (2-3 hours)
**Priority**: P2 - Nice to have
**Complexity**: Medium

**What to Build:**
- Parse `forRoot()` and `forFeature()` methods
- Extract dynamic providers
- Handle conditional imports

**Files to Modify:**
- `src/parser/parse-ns-module.ts` - Add dynamic module parsing

**Deliverables:**
- Dynamic module support
- Test coverage
- Documentation

## 📊 Effort Estimation

| Phase | Component | Hours | Priority |
|-------|-----------|-------|----------|
| **Phase 1** | Dependency Extraction | 8-10 | P0 |
| | JSON Output | 4-6 | P0 |
| | CLI Interface | 3-4 | P0 |
| **Phase 1 Total** | | **15-20** | **P0** |
| **Phase 2** | Error Handling | 4-6 | P1 |
| | Testing | 8-10 | P1 |
| | Documentation | 4-6 | P1 |
| **Phase 2 Total** | | **16-22** | **P1** |
| **Phase 3** | CLI Integration | 3-4 | P2 |
| | Advanced Analysis | 4-6 | P2 |
| | Dynamic Modules | 2-3 | P2 |
| **Phase 3 Total** | | **9-13** | **P2** |
| **Grand Total** | | **40-55 hours** | |

## 🎯 Recommended Approach

### Week 1: Core Functionality (Phase 1)
**Days 1-2**: Dependency Extraction
- Follow the detailed plan in `DEPENDENCY_EXTRACTION_IMPLEMENTATION_PLAN.md`
- Focus on getting constructor dependencies working first
- Add property dependencies second
- TC39 Stage 3 support last

**Day 3**: JSON Output
- Design the output schema
- Implement serialization
- Add file writing
- Test with example app

**Day 4**: CLI Interface
- Set up commander.js
- Implement analyze command
- Add options and validation
- Test end-to-end

### Week 2: Quality (Phase 2)
**Days 5-6**: Testing
- Write unit tests for all parsers
- Add integration tests
- Set up CI/CD
- Achieve 80%+ coverage

**Day 7**: Error Handling & Documentation
- Add error handling throughout
- Write comprehensive README
- Create API documentation
- Add examples

### Week 3 (Optional): Advanced Features (Phase 3)
**Days 8-10**: Nice-to-have features
- CLI integration
- Advanced analysis
- Dynamic modules

## 🚀 Quick Start for Implementation

1. **Start with Dependency Extraction** (Most Critical)
   - Read `DEPENDENCY_EXTRACTION_IMPLEMENTATION_PLAN.md`
   - Follow the 5-phase approach
   - Test incrementally

2. **Add JSON Output** (Enables actual usage)
   - Design schema first
   - Implement serialization
   - Add file writing

3. **Build CLI** (Makes it usable)
   - Simple commander.js setup
   - Wire up existing functionality
   - Add basic validation

4. **Add Tests** (Ensures quality)
   - Start with critical paths
   - Add edge cases
   - Achieve good coverage

5. **Polish** (Makes it professional)
   - Error handling
   - Documentation
   - Examples

## 📚 Key Resources

- **Detailed Implementation Plans:**
  - `DEPENDENCY_EXTRACTION_IMPLEMENTATION_PLAN.md` - Step-by-step guide for dependency extraction

- **Reference Code:**
  - `packages/ioc/src/decorators/inject.ts` - How @Inject works at runtime
  - `packages/ioc/src/core/graph/module-graph.ts` - How dependencies are resolved
  - `packages/graph-visualizer/src/index.ts` - Similar visualization tool

- **External Documentation:**
  - TypeScript Compiler API: https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
  - tsquery: https://github.com/phenomnomnominal/tsquery
  - Commander.js: https://github.com/tj/commander.js

## ✅ Definition of Done

The graph-analyzer package is complete when:

- [ ] **Phase 1 (P0) Complete:**
  - [ ] Dependency extraction working for all patterns
  - [ ] JSON output with complete metadata
  - [ ] CLI interface functional
  - [ ] Example app analysis working

- [ ] **Phase 2 (P1) Complete:**
  - [ ] 80%+ test coverage
  - [ ] Comprehensive error handling
  - [ ] Professional documentation
  - [ ] CI/CD pipeline working

- [ ] **Phase 3 (P2) Optional:**
  - [ ] Integrated with @nexus-ioc/cli
  - [ ] Advanced analysis features
  - [ ] Dynamic module support

- [ ] **Ready for Release:**
  - [ ] All tests passing
  - [ ] Documentation complete
  - [ ] Examples working
  - [ ] README professional
  - [ ] Version 1.0.0 published to npm

## 🎉 Success Metrics

After completion, the tool should:
1. Analyze any Nexus IoC application and produce complete JSON output
2. Extract 100% of dependency injection metadata
3. Provide actionable error messages
4. Have comprehensive documentation
5. Be easy to use via CLI
6. Be maintainable with good test coverage

