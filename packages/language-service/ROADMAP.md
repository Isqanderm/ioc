# TypeScript Language Service Plugin - Feature Roadmap

## Current State (Phase 1 - ✅ Completed)

### Implemented Features

#### 1. **IntelliSense & Auto-completion**
- ✅ Auto-completion for `@Inject()` decorator parameters
- ✅ Suggests available providers from connected modules
- ✅ Supports both class tokens and string tokens
- ✅ Searches through module imports to find exported providers

#### 2. **Go-to-Definition**
- ✅ Navigate from `@Inject(Token)` to provider definition
- ✅ Searches through module providers and exports
- ✅ Handles both direct providers and imported/exported providers

#### 3. **Semantic Diagnostics**
- ✅ Detects missing dependencies (not provided in any module)
- ✅ Detects type mismatches between injected and provided types
- ✅ Detects services not connected to any module
- ✅ Provides related information showing which module has the issue

#### 4. **Supported Decorators**
- ✅ `@Injectable()` - Parses injectable classes
- ✅ `@Inject(token)` - Parses injection tokens in constructors
- ✅ `@NsModule(metadata)` - Parses module metadata (providers, imports, exports)
- ✅ `@Optional()` - Marks dependencies as optional (no error if missing)
- ✅ `@Global()` - Marks modules as global (providers available everywhere)

#### 5. **Code Quality**
- ✅ Migrated from Jest to Vitest
- ✅ Zero Biome linting errors
- ✅ TypeScript strict mode compliance
- ✅ Comprehensive JSDoc documentation for public APIs
- ✅ Internationalized error messages (English)

### Known Limitations

1. **No Quick Fixes**: Diagnostics show errors but don't offer automated fixes
2. **No Refactoring Support**: No rename, extract, or move refactorings
3. **Limited Provider Types**: Only handles class providers and simple value providers
4. **No Circular Dependency Detection**: Despite JSDoc claiming it, not implemented
5. **No Scope Validation**: Doesn't check if scope mismatches could cause issues
6. **No Performance Optimization**: Re-parses entire project on every keystroke

---

## Phase 2: Enhanced Diagnostics & Core Features (Priority: High)

**Goal**: Improve diagnostic accuracy and add support for missing core features

### 2.1 Support for `@Optional()` Decorator ✅ COMPLETED
**Priority**: Critical
**Effort**: Medium (2-3 days)
**Completed**: 2025-10-19

- [x] Parse `@Optional()` decorator in `InjectParser`
- [x] Modify `getSemanticDiagnosticsActions` to skip "missing dependency" errors for optional deps
- [x] Add tests for optional dependencies (10 tests total: 6 parser + 4 diagnostics)
- [x] Update example project with optional dependency demonstrations
- [x] Update documentation (README.md and TESTING_GUIDE.md)
- [ ] Update auto-completion to indicate optional vs required dependencies (deferred to Phase 5)

**Impact**: ✅ Eliminates false positive errors for optional dependencies

**Implementation Notes**:
- Added `isOptional: boolean` field to `InjectParameterDeclaration` type
- Implemented `hasOptionalDecorator()` method supporting both `@Optional()` and `@Optional` syntax
- Handles decorator order independence (`@Optional() @Inject()` or `@Inject() @Optional()`)
- Fixed pre-existing bug in `find-type-references.helper.ts` (textSpan initialization)
- All 10 new tests passing
- Example project includes 3 new files demonstrating optional dependencies

### 2.2 Support for `@Global()` Modules ✅ COMPLETED
**Priority**: High
**Effort**: Medium (2-3 days)
**Completed**: 2025-10-19

- [x] Parse `@Global()` decorator in module parser
- [x] Modify module resolution to make global module providers available everywhere
- [x] Update semantic diagnostics to search global modules
- [x] Add tests for global module scenarios (10 tests total: 6 parser + 4 diagnostics)
- [x] Update example project with global module demonstrations
- [x] Update documentation (README.md and TESTING_GUIDE.md)

**Impact**: ✅ Correctly handles global modules, eliminating false "missing dependency" errors

**Implementation Notes**:
- Added `isGlobal: boolean` field to `NsModuleDeclaration` type
- Implemented `hasGlobalDecorator()` method supporting both `@Global()` and `@Global` syntax
- Created `findGlobalModules()` helper function to search all global modules in the project
- Updated semantic diagnostics to search global modules for dependencies (both in modules and orphan services)
- All 10 new tests passing
- Example project includes 6 new files demonstrating global modules
- Go-to-definition works for global module providers

### 2.3 Property Injection Support ✅ COMPLETED
**Priority**: High
**Effort**: Medium (3-4 days)
**Completed**: 2025-10-19

- [x] Extend `InjectParser` to parse property decorators
- [x] Add property injection to semantic diagnostics
- [x] Add comprehensive tests (13 tests total: 9 parser + 4 diagnostics)
- [x] Update example project with property injection demonstrations
- [x] Update documentation (README.md and TESTING_GUIDE.md)
- [ ] Add property injection to auto-completion (deferred - already works via existing code)
- [ ] Add property injection to go-to-definition (deferred - already works via existing code)

**Impact**: ✅ Full support for all injection patterns used in Nexus IoC

**Implementation Notes**:
- Updated `InjectParameterDeclaration` type to accept both `ts.ParameterDeclaration | ts.PropertyDeclaration`
- Added property parsing logic using tsquery selector for properties with `@Inject` decorator
- Implemented separate methods for checking optional decorators on parameters vs properties
- Semantic diagnostics automatically work with property injection (no changes needed)
- Auto-completion and go-to-definition already work with property injection (no changes needed)
- All 13 new tests passing
- Example project includes 3 new files demonstrating property injection
- Supports mixed constructor and property injection
- Supports optional property injection with `@Optional()` decorator

### 2.4 Circular Dependency Detection
**Priority**: Medium
**Effort**: Medium (3-4 days)
**Completed**: 2025-10-19

- [x] Implement graph-based circular dependency detection
- [x] Add diagnostic error for circular dependencies
- [x] Suggest using `forwardRef()` in error message
- [x] Add tests with circular dependency scenarios (12 tests total: 8 helper + 4 diagnostics)
- [x] Update example project with circular dependency demonstrations
- [x] Update documentation (README.md and TESTING_GUIDE.md)

**Impact**: ✅ Catches circular dependency bugs at development time

**Implementation Notes**:
- Created `CircularDependencyDetectorHelper` class using DFS algorithm to detect cycles
- Adapted from existing `CircularDependencyDetector` in `graph-analyzer` package
- Only tracks class dependencies (not string tokens) and non-optional dependencies
- Optional dependencies break circular dependency cycles (by design)
- Detects simple cycles (A → B → A), longer cycles (A → B → C → A), and self-references (A → A)
- Error messages include full cycle path and suggest using `forwardRef()` to resolve
- Related information shows the complete circular dependency path
- All 12 new tests passing (8 helper unit tests + 4 semantic diagnostics integration tests)
- Example project includes 4 new files demonstrating circular dependencies and fixes
- Supports detection of multiple independent circular dependencies in the same file

### 2.5 Enhanced Provider Type Support ✅ **COMPLETED** (2025-10-19)
**Priority**: Medium
**Effort**: Medium (2-3 days)

- [x] Support `useClass` providers
- [x] Support `useFactory` providers
- [x] Support `useValue` providers
- [x] Parse `inject` property from `useFactory` providers
- [x] Validate factory provider dependencies
- [x] Update type checking for factory return types
- [ ] Support `useExisting` (alias) providers (NOT IMPLEMENTED in @nexus-ioc/core - excluded from scope)

**Impact**: Accurate diagnostics for all provider types

**Implementation Notes**:
- Fixed bug in `findPropertyInObject` helper (removed nested find)
- Updated `ProviderType` interface to include `inject` property for factory providers
- Updated `getTypeOfNode` helper to handle arrow functions and function expressions
- Added factory provider dependency validation in semantic diagnostics
- All 13 new tests passing (8 parser tests + 5 semantic diagnostics tests)
- Example project includes 2 new files demonstrating all provider types
- Validates both string tokens and class tokens in `inject` arrays
- Supports mixed inject arrays (string + class tokens)

### 2.6 Scope Validation
**Priority**: Low  
**Effort**: Small (1-2 days)

- [ ] Parse `@Injectable({ scope })` options
- [ ] Warn when singleton depends on transient/request-scoped service
- [ ] Add diagnostic for scope mismatch issues
- [ ] Add tests for scope validation

**Impact**: Prevents subtle runtime bugs related to scope mismatches

**Estimated Total for Phase 2**: 4-5 weeks

---

## Phase 3: Quick Fixes & Code Actions (Priority: High)

**Goal**: Provide automated fixes for common DI issues

### 3.1 Quick Fix: Add Missing Provider
**Priority**: Critical  
**Effort**: Medium (3-4 days)

- [ ] Implement `getCodeFixesAtPosition` handler
- [ ] Detect "missing dependency" diagnostic
- [ ] Offer quick fix: "Add {Token} to module providers"
- [ ] Generate code to add provider to nearest module
- [ ] Handle both class and string token providers

**Impact**: Dramatically improves developer experience

### 3.2 Quick Fix: Import Module
**Priority**: High  
**Effort**: Medium (2-3 days)

- [ ] Detect when provider exists in another module
- [ ] Offer quick fix: "Import {ModuleName}"
- [ ] Generate code to add module to imports array
- [ ] Handle module export requirements

**Impact**: Reduces manual module wiring

### 3.3 Quick Fix: Fix Type Mismatch
**Priority**: Medium  
**Effort**: Small (1-2 days)

- [ ] Detect type mismatch diagnostic
- [ ] Offer quick fix: "Change parameter type to {CorrectType}"
- [ ] Update parameter type annotation

**Impact**: Quick resolution of type errors

### 3.4 Quick Fix: Add @Injectable Decorator
**Priority**: Medium  
**Effort**: Small (1-2 days)

- [ ] Detect when class is used as provider but missing `@Injectable()`
- [ ] Offer quick fix: "Add @Injectable() decorator"
- [ ] Add import for `Injectable` if needed

**Impact**: Catches common beginner mistake

### 3.5 Quick Fix: Add @Optional Decorator
**Priority**: Low  
**Effort**: Small (1 day)

- [ ] Detect missing optional dependency
- [ ] Offer quick fix: "Mark as @Optional()"
- [ ] Add `@Optional()` decorator and import

**Impact**: Easy way to handle optional dependencies

**Estimated Total for Phase 3**: 3-4 weeks

---

## Phase 4: Refactoring Support (Priority: Medium)

**Goal**: Enable safe refactoring of DI code

### 4.1 Rename Provider Token
**Priority**: High  
**Effort**: Large (5-7 days)

- [ ] Implement `findRenameLocations` handler
- [ ] Find all references to a provider token
- [ ] Support renaming class tokens (uses TypeScript's built-in)
- [ ] Support renaming string tokens (custom implementation)
- [ ] Update all `@Inject('token')` references
- [ ] Update module provider declarations

**Impact**: Safe refactoring of string tokens

### 4.2 Extract to Module
**Priority**: Medium  
**Effort**: Large (7-10 days)

- [ ] Implement refactoring action: "Extract providers to new module"
- [ ] Select multiple providers
- [ ] Generate new module file
- [ ] Update imports in original module
- [ ] Move provider classes if needed

**Impact**: Helps organize large modules

### 4.3 Move Provider to Different Module
**Priority**: Low  
**Effort**: Medium (3-4 days)

- [ ] Implement refactoring action: "Move to {ModuleName}"
- [ ] Remove from current module providers
- [ ] Add to target module providers
- [ ] Update exports if needed

**Impact**: Easy module reorganization

**Estimated Total for Phase 4**: 4-5 weeks

---

## Phase 5: Performance & Developer Experience (Priority: Medium)

**Goal**: Optimize plugin performance and improve UX

### 5.1 Caching & Incremental Parsing
**Priority**: High  
**Effort**: Large (7-10 days)

- [ ] Implement file-level caching for parsed modules
- [ ] Invalidate cache only for changed files
- [ ] Cache type checker results
- [ ] Implement incremental module graph updates
- [ ] Add performance metrics logging

**Impact**: Dramatically faster response in large projects

### 5.2 Hover Information
**Priority**: Medium  
**Effort**: Medium (3-4 days)

- [ ] Implement `getQuickInfoAtPosition` handler
- [ ] Show provider metadata on hover over `@Inject(token)`
- [ ] Display: provider type, scope, source module
- [ ] Show dependency chain
- [ ] Format with Markdown

**Impact**: Better understanding of DI configuration

### 5.3 Signature Help
**Priority**: Low  
**Effort**: Small (2-3 days)

- [ ] Implement `getSignatureHelpItems` handler
- [ ] Show available tokens when typing `@Inject(`
- [ ] Display token type and description

**Impact**: Improved auto-completion experience

### 5.4 Inlay Hints
**Priority**: Low  
**Effort**: Medium (3-4 days)

- [ ] Implement `provideInlayHints` handler
- [ ] Show inferred injection tokens for parameters without `@Inject()`
- [ ] Show provider scope next to class names
- [ ] Make hints configurable

**Impact**: Better visibility of implicit DI behavior

### 5.5 Code Lens
**Priority**: Low  
**Effort**: Medium (3-4 days)

- [ ] Implement `provideCodeLenses` handler
- [ ] Show "X references" above provider classes
- [ ] Show "Provided by: ModuleName" above injectable classes
- [ ] Make lenses clickable to navigate

**Impact**: Quick navigation and understanding

**Estimated Total for Phase 5**: 5-6 weeks

---

## Phase 6: Advanced Features (Priority: Low)

**Goal**: Advanced IDE features for power users

### 6.1 Dependency Graph Visualization
**Priority**: Medium  
**Effort**: Large (10-14 days)

- [ ] Integrate with `@nexus-ioc/graph-visualizer`
- [ ] Add command: "Show Dependency Graph"
- [ ] Render interactive graph in webview
- [ ] Highlight current file's dependencies
- [ ] Click to navigate to providers

**Impact**: Visual understanding of complex DI graphs

### 6.2 Module Validation
**Priority**: Medium  
**Effort**: Medium (4-5 days)

- [ ] Validate module metadata structure
- [ ] Check for duplicate providers
- [ ] Check for conflicting exports
- [ ] Warn about unused imports
- [ ] Suggest module optimizations

**Impact**: Cleaner module organization

### 6.3 Testing Support
**Priority**: Low  
**Effort**: Medium (4-5 days)

- [ ] Generate test boilerplate for services
- [ ] Auto-generate mock providers
- [ ] Suggest test module configuration
- [ ] Integration with `@nexus-ioc/testing`

**Impact**: Faster test writing

### 6.4 Migration Assistance
**Priority**: Low  
**Effort**: Large (7-10 days)

- [ ] Detect legacy decorator patterns
- [ ] Offer migration to TC39 Stage 3 decorators
- [ ] Auto-generate `static dependencies` arrays
- [ ] Batch migration across project

**Impact**: Easier migration to modern decorators

**Estimated Total for Phase 6**: 6-8 weeks

---

## Summary & Prioritization

### Recommended Implementation Order

1. **Phase 2** (4-5 weeks) - Critical for correctness
   - Fixes false positives and adds missing core features
   - Highest ROI for user satisfaction

2. **Phase 3** (3-4 weeks) - Critical for productivity
   - Quick fixes dramatically improve developer experience
   - Most requested feature type in IDE plugins

3. **Phase 5** (5-6 weeks) - Important for performance
   - Caching is critical for large projects
   - Hover info and other UX improvements are high value

4. **Phase 4** (4-5 weeks) - Nice to have
   - Refactoring is powerful but less frequently used
   - Can be deferred if resources are limited

5. **Phase 6** (6-8 weeks) - Future enhancements
   - Advanced features for power users
   - Can be implemented incrementally

### Total Estimated Effort
- **Critical Path (Phases 2-3)**: 7-9 weeks
- **Full Implementation (Phases 2-6)**: 22-28 weeks (~6 months)

### Quick Wins (Can be done in 1-2 weeks)
1. Support for `@Optional()` decorator (Phase 2.1)
2. Quick fix: Add missing provider (Phase 3.1)
3. Hover information (Phase 5.2)

---

## Metrics for Success

### Phase 2 Success Criteria
- Zero false positive errors for optional dependencies
- Global modules work correctly in all scenarios
- Property injection fully supported

### Phase 3 Success Criteria
- 80%+ of diagnostics have associated quick fixes
- Quick fixes generate correct, compilable code
- Average time to fix DI error < 5 seconds

### Phase 5 Success Criteria
- Plugin response time < 100ms for typical operations
- Hover info available for all injection points
- Memory usage < 50MB for medium projects (100 files)

### Overall Success Criteria
- Plugin used in 80%+ of Nexus IoC projects
- Positive feedback from community
- Reduced DI-related bug reports

