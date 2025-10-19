# Language Service Plugin Testing Guide

This guide provides detailed step-by-step instructions for manually testing each feature of the TypeScript Language Service Plugin.

## Prerequisites

Before testing, ensure:
- ✅ Plugin is built: `cd packages/language-service && npm run build`
- ✅ Example dependencies installed: `npm install` from monorepo root
- ✅ IDE is configured (see README.md)
- ✅ TypeScript version is selected (Use Workspace Version in VS Code)

---

## Test Suite 1: Auto-completion

### Test 1.1: Class Token Auto-completion

**File**: `src/user.service.ts`

**Steps**:
1. Open `src/user.service.ts`
2. Go to line with `@Inject(DatabaseService)`
3. Delete `DatabaseService` so you have `@Inject()`
4. Place cursor between parentheses: `@Inject(|)`
5. Press `Ctrl+Space` (or `Cmd+Space` on Mac)

**Expected Result**:
- Dropdown appears with suggestions:
  - `DatabaseService` (class icon)
  - `LoggerService` (class icon)
  - `'API_KEY'` (string icon)
  - `'DATABASE_CONFIG'` (string icon)

**Pass Criteria**: ✅ All 4 providers appear in the list

---

### Test 1.2: String Token Auto-completion

**File**: `src/config.service.ts`

**Steps**:
1. Open `src/config.service.ts`
2. Go to line with `@Inject("API_KEY")`
3. Delete `"API_KEY"` so you have `@Inject()`
4. Type a quote: `@Inject("|)`
5. Trigger auto-completion

**Expected Result**:
- Dropdown shows:
  - `API_KEY` (string icon)
  - `DATABASE_CONFIG` (string icon)

**Pass Criteria**: ✅ Both string tokens appear

---

### Test 1.3: Auto-completion in Different Module

**File**: `src/post.service.ts`

**Steps**:
1. Open `src/post.service.ts`
2. Go to line with `@Inject(UserService)`
3. Delete `UserService`
4. Trigger auto-completion inside `@Inject()`

**Expected Result**:
- `UserService` appears in the list
- This works because PostModule imports UserModule which exports UserService

**Pass Criteria**: ✅ UserService is suggested

---

## Test Suite 2: Go-to-Definition

### Test 2.1: Go-to-Definition for Class Token

**File**: `src/user.service.ts`

**Steps**:
1. Open `src/user.service.ts`
2. Find line: `@Inject(DatabaseService) private db: DatabaseService`
3. Place cursor on `DatabaseService` inside `@Inject()`
4. Press `F12` (or `Cmd+Click`)

**Expected Result**:
- IDE navigates to `src/database.service.ts`
- Cursor is on the `DatabaseService` class declaration

**Pass Criteria**: ✅ Navigates to correct file and location

---

### Test 2.2: Go-to-Definition for String Token

**File**: `src/config.service.ts`

**Steps**:
1. Open `src/config.service.ts`
2. Find line: `@Inject("API_KEY") private apiKey: string`
3. Place cursor on `"API_KEY"` inside `@Inject()`
4. Press `F12`

**Expected Result**:
- IDE navigates to `src/app.module.ts`
- Cursor is on the provider object: `{ provide: "API_KEY", useValue: ... }`

**Pass Criteria**: ✅ Navigates to provider definition in module

---

### Test 2.3: Go-to-Definition for Exported Service

**File**: `src/post.service.ts`

**Steps**:
1. Open `src/post.service.ts`
2. Find line: `@Inject(UserService) private userService: UserService`
3. Place cursor on `UserService` inside `@Inject()`
4. Press `F12`

**Expected Result**:
- IDE navigates to `src/user.service.ts`
- Cursor is on the `UserService` class declaration

**Pass Criteria**: ✅ Navigates correctly even though UserService is from imported module

---

## Test Suite 3: Semantic Diagnostics - Errors

### Test 3.1: Missing Dependency Error

**File**: `src/broken-examples/missing-dependency.service.ts`

**Steps**:
1. Open `src/broken-examples/missing-dependency.service.ts`
2. Look at the `@Inject(NonExistentService)` line
3. Hover over the red squiggly underline

**Expected Result**:
- Red squiggly underline appears
- Error message: `Class 'MissingDependencyService' is missing dependency: NonExistentService`
- Related information shows: `Module: BrokenModule`

**Pass Criteria**: ✅ Error appears with correct message

---

### Test 3.2: Type Mismatch Error

**File**: `src/broken-examples/type-mismatch.service.ts`

**Steps**:
1. Open `src/broken-examples/type-mismatch.service.ts`
2. Look at the `wrongTypeLogger` parameter
3. Hover over the red squiggly underline

**Expected Result**:
- Red squiggly underline appears
- Error message: `Type mismatch for dependency 'LoggerService'`
- Related information shows: `Module: BrokenModule`

**Pass Criteria**: ✅ Error appears with correct message

---

### Test 3.3: Orphan Service Error

**File**: `src/broken-examples/orphan.service.ts`

**Steps**:
1. Open `src/broken-examples/orphan.service.ts`
2. Look at the `@Inject(DatabaseService)` line
3. Hover over the red squiggly underline

**Expected Result**:
- Red squiggly underline appears
- Error message: `Class 'OrphanService' is missing dependency: DatabaseService`
- No related information (because service is not in any module)

**Pass Criteria**: ✅ Error appears because service is not in any module

---

## Test Suite 4: Semantic Diagnostics - No Errors

### Test 4.1: Properly Configured Service

**File**: `src/user.service.ts`

**Steps**:
1. Open `src/user.service.ts`
2. Check all `@Inject()` decorators
3. Look for any red squiggly underlines

**Expected Result**:
- NO errors appear
- All dependencies are properly provided

**Pass Criteria**: ✅ No errors in this file

---

### Test 4.2: Service with String Tokens

**File**: `src/config.service.ts`

**Steps**:
1. Open `src/config.service.ts`
2. Check all `@Inject()` decorators
3. Look for any red squiggly underlines

**Expected Result**:
- NO errors appear
- String tokens are properly provided in AppModule

**Pass Criteria**: ✅ No errors in this file

---

### Test 4.3: Service Using Imported Dependencies

**File**: `src/post.service.ts`

**Steps**:
1. Open `src/post.service.ts`
2. Check the `@Inject(UserService)` line
3. Look for any red squiggly underlines

**Expected Result**:
- NO errors appear
- UserService is available because PostModule imports UserModule

**Pass Criteria**: ✅ No errors in this file

---

## Test Suite 5: Module Import/Export Behavior

### Test 5.1: Break Module Import

**File**: `src/post.module.ts`

**Steps**:
1. Open `src/post.module.ts`
2. Comment out `UserModule` from the imports array:
   ```typescript
   imports: [/* UserModule */],
   ```
3. Save the file
4. Open `src/post.service.ts`
5. Look at the `@Inject(UserService)` line

**Expected Result**:
- Red squiggly underline appears in `post.service.ts`
- Error: `Class 'PostService' is missing dependency: UserService`

**Pass Criteria**: ✅ Error appears when import is removed

**Cleanup**: Uncomment `UserModule` in imports

---

### Test 5.2: Break Module Export

**File**: `src/user.module.ts`

**Steps**:
1. Open `src/user.module.ts`
2. Comment out `UserService` from the exports array:
   ```typescript
   exports: [/* UserService */],
   ```
3. Save the file
4. Open `src/post.service.ts`
5. Look at the `@Inject(UserService)` line

**Expected Result**:
- Red squiggly underline appears in `post.service.ts`
- Error: `Class 'PostService' is missing dependency: UserService`

**Pass Criteria**: ✅ Error appears when export is removed

**Cleanup**: Uncomment `UserService` in exports

---

## Test Suite 6: Optional Dependencies (@Optional() Decorator)

### Test 6.1: No Error for Missing Optional Dependency

**File**: `src/optional-dependencies.service.ts` and `src/optional-example.module.ts`

**Steps**:
1. Open `src/optional-dependencies.service.ts`
2. Observe the constructor with three dependencies:
   - `ConfigService` (required - no `@Optional()`)
   - `LoggerService` (optional - has `@Optional()`)
   - `CacheService` (optional - has `@Optional()` with string token)
3. Open `src/optional-example.module.ts`
4. Note that `CacheService` is NOT in the providers array
5. Check for errors in `optional-dependencies.service.ts`

**Expected Result**:
- ✅ NO error for missing `CacheService` (it's optional)
- ✅ NO error for `LoggerService` (it's provided)
- ✅ NO error for `ConfigService` (it's provided)

**Pass Criteria**: ✅ No red squiggly lines in the file

---

### Test 6.2: Error for Missing Required Dependency

**File**: `src/optional-dependencies.service.ts` and `src/optional-example.module.ts`

**Steps**:
1. Open `src/optional-example.module.ts`
2. Comment out `ConfigService` from the providers array:
   ```typescript
   providers: [
     // ConfigService,  // <-- Comment this out
     LoggerService,
     OptionalDependenciesService,
   ],
   ```
3. Open `src/optional-dependencies.service.ts`
4. Look for errors on the `@Inject(ConfigService)` line

**Expected Result**:
- ❌ Red squiggly underline appears
- Error message: `Class 'OptionalDependenciesService' is missing dependency: ConfigService`

**Pass Criteria**: ✅ Error appears for missing required dependency

**Cleanup**: Uncomment `ConfigService` in the providers array

---

### Test 6.3: All Dependencies Optional - No Errors

**File**: `src/all-optional.service.ts`

**Steps**:
1. Open `src/all-optional.service.ts`
2. Note that ALL dependencies have `@Optional()`
3. Note that this service is NOT added to any module
4. Check for errors

**Expected Result**:
- ✅ NO errors at all
- Even though the service isn't in any module, no errors appear
- This is because all dependencies are optional

**Pass Criteria**: ✅ No errors in the file

---

### Test 6.4: Mixed Optional and Required Dependencies

**File**: `src/optional-dependencies.service.ts` and `src/optional-example.module.ts`

**Steps**:
1. Open `src/optional-example.module.ts`
2. Comment out `LoggerService` from providers:
   ```typescript
   providers: [
     ConfigService,
     // LoggerService,  // <-- Comment this out
     OptionalDependenciesService,
   ],
   ```
3. Check `src/optional-dependencies.service.ts` for errors

**Expected Result**:
- ✅ NO error for missing `LoggerService` (it's optional)
- ✅ NO error for missing `CacheService` (it's optional)
- ✅ NO error for `ConfigService` (it's provided)

**Pass Criteria**: ✅ No errors appear

**Cleanup**: Uncomment `LoggerService`

---

### Test 6.5: Decorator Order Independence

**File**: `src/optional-dependencies.service.ts`

**Steps**:
1. Open `src/optional-dependencies.service.ts`
2. Find the `logger` parameter with decorators:
   ```typescript
   @Inject(LoggerService)
   @Optional()
   private readonly logger?: LoggerService,
   ```
3. Swap the decorator order:
   ```typescript
   @Optional()
   @Inject(LoggerService)
   private readonly logger?: LoggerService,
   ```
4. Check for errors

**Expected Result**:
- ✅ NO errors
- Plugin detects `@Optional()` regardless of order

**Pass Criteria**: ✅ Both decorator orders work correctly

**Cleanup**: Restore original order (optional)

---

### Test 6.6: Optional Without Parentheses

**File**: `src/optional-dependencies.service.ts`

**Steps**:
1. Open `src/optional-dependencies.service.ts`
2. Find the `logger` parameter
3. Remove parentheses from `@Optional()`:
   ```typescript
   @Inject(LoggerService)
   @Optional  // <-- No parentheses
   private readonly logger?: LoggerService,
   ```
4. Check for errors

**Expected Result**:
- ✅ NO errors
- Plugin handles both `@Optional()` and `@Optional`

**Pass Criteria**: ✅ Works without parentheses

**Cleanup**: Add parentheses back (optional)

---

## Test Suite 7: Edge Cases

### Test 6.1: Multiple Modules Providing Same Service

**Steps**:
1. Note that `DatabaseService` is provided in both `UserModule` and `PostModule`
2. Open `src/user.service.ts` and `src/post.service.ts`
3. Check that both can inject `DatabaseService` without errors

**Expected Result**:
- NO errors in either file
- Each module has its own instance of DatabaseService

**Pass Criteria**: ✅ No errors when service is provided in multiple modules

---

### Test 6.2: Auto-completion Shows Only Available Providers

**File**: `src/user.service.ts`

**Steps**:
1. Open `src/user.service.ts`
2. Trigger auto-completion inside `@Inject()`
3. Check if `PostService` appears in the list

**Expected Result**:
- `PostService` should NOT appear
- Only providers available to UserModule should appear

**Pass Criteria**: ✅ Auto-completion is context-aware

---

## Test Suite 7: Performance

### Test 7.1: Response Time

**Steps**:
1. Open any file with `@Inject()` decorators
2. Delete a token and trigger auto-completion
3. Measure time until dropdown appears

**Expected Result**:
- Auto-completion appears within 1 second
- No noticeable lag

**Pass Criteria**: ✅ Response time is acceptable

---

### Test 7.2: Large File Handling

**Steps**:
1. Open `src/app.module.ts`
2. Add 50 more providers to the providers array (copy-paste existing ones)
3. Open `src/user.service.ts`
4. Trigger auto-completion

**Expected Result**:
- Auto-completion still works
- All providers appear in the list

**Pass Criteria**: ✅ Plugin handles large provider arrays

**Cleanup**: Remove the extra providers

---

## Test Suite 7: Global Modules

### Test 7.1: Global Module Provider Recognition

**File**: `src/feature-with-global-deps.service.ts`

**Steps**:
1. Open `src/feature-with-global-deps.service.ts`
2. Observe the constructor with `GlobalConfigService` and `GlobalLoggerService`
3. Open `src/feature-with-global-deps.module.ts`
4. Verify that it does NOT import `GlobalConfigModule` or `GlobalLoggerModule`

**Expected Result**:
- ✅ NO errors for `GlobalConfigService` dependency
- ✅ NO errors for `GlobalLoggerService` dependency
- The plugin recognizes these are from global modules

**Pass Criteria**: No red squiggly lines on global dependencies

---

### Test 7.2: Removing @Global() Decorator

**File**: `src/global-config.module.ts`

**Steps**:
1. Open `src/global-config.module.ts`
2. Comment out the `@Global()` decorator line
3. Go back to `src/feature-with-global-deps.service.ts`
4. Observe the `GlobalConfigService` dependency

**Expected Result**:
- ❌ Error appears: "Class 'FeatureWithGlobalDepsService' is missing dependency: GlobalConfigService"
- This proves the plugin detects when a module is NOT global

**Pass Criteria**: Error appears when @Global() is removed

**Cleanup**: Uncomment `@Global()` to restore functionality

---

### Test 7.3: Global Module with Orphan Service

**File**: Create new file `src/test-orphan-global.service.ts`

**Steps**:
1. Create a new file with this content:
```typescript
import { Injectable, Inject } from "@nexus-ioc/core";
import { GlobalLoggerService } from "./global-logger.service";

@Injectable()
export class TestOrphanGlobalService {
  constructor(@Inject(GlobalLoggerService) private logger: GlobalLoggerService) {}
}
```
2. Save the file
3. Observe the `GlobalLoggerService` dependency

**Expected Result**:
- ✅ NO error for `GlobalLoggerService` dependency
- Even though this service is not in any module, global providers are available

**Pass Criteria**: No errors for global dependency in orphan service

**Cleanup**: Delete the test file after verification

---

### Test 7.4: Multiple Global Modules

**File**: `src/feature-with-global-deps.service.ts`

**Steps**:
1. Open `src/feature-with-global-deps.service.ts`
2. Verify it uses both `GlobalConfigService` and `GlobalLoggerService`
3. Open `src/global-config.module.ts` - verify it's marked `@Global()`
4. Open `src/global-logger.module.ts` - verify it's marked `@Global()`

**Expected Result**:
- ✅ NO errors for either global dependency
- The plugin handles multiple global modules correctly

**Pass Criteria**: No errors when using providers from multiple global modules

---

### Test 7.5: Go-to-Definition for Global Providers

**File**: `src/feature-with-global-deps.service.ts`

**Steps**:
1. Open `src/feature-with-global-deps.service.ts`
2. Place cursor on `GlobalConfigService` in the `@Inject()` decorator
3. Press F12 (or Cmd+Click)

**Expected Result**:
- Navigates to `src/global-config.service.ts`
- Shows the `GlobalConfigService` class definition

**Pass Criteria**: Go-to-definition works for global module providers

---

### Test 7.6: @Global Without Parentheses

**File**: Create a test module

**Steps**:
1. Create a new file `src/test-global-no-parens.module.ts`:
```typescript
import { Global, NsModule } from "@nexus-ioc/core";

@Global  // Without parentheses
@NsModule({
  providers: [],
  exports: [],
})
export class TestGlobalNoParensModule {}
```
2. Save the file
3. Verify no syntax errors

**Expected Result**:
- ✅ Plugin recognizes `@Global` without parentheses
- No errors in the file

**Pass Criteria**: Both `@Global()` and `@Global` syntax work

**Cleanup**: Delete the test file after verification

---

## Test Suite 8: Property Injection

### Test 8.1: Basic Property Injection

**File**: `src/property-injection.service.ts`

**Steps**:
1. Open `src/property-injection.service.ts`
2. Observe the property injection:
   ```typescript
   @Inject(DatabaseService)
   private database!: DatabaseService;
   ```
3. Verify no errors are shown

**Expected Result**:
- ✅ NO errors for property injection
- The plugin recognizes `@Inject()` on properties

**Pass Criteria**: No errors for property-injected dependencies

---

### Test 8.2: Missing Property Dependency Error

**File**: `src/property-injection.service.ts` and `src/property-injection.module.ts`

**Steps**:
1. Open `src/property-injection.module.ts`
2. Comment out `DatabaseService` from the providers array
3. Go back to `src/property-injection.service.ts`
4. Observe the `@Inject(DatabaseService)` decorator on the property

**Expected Result**:
- ❌ Error appears: `Class 'PropertyInjectionService' is missing dependency: DatabaseService`
- Error is shown on the property decorator

**Pass Criteria**: Error is correctly reported for missing property dependency

**Cleanup**: Uncomment `DatabaseService` in the module

---

### Test 8.3: Optional Property Injection

**File**: `src/optional-property-injection.service.ts`

**Steps**:
1. Open `src/optional-property-injection.service.ts`
2. Observe the optional property injection:
   ```typescript
   @Inject(CacheService)
   @Optional()
   private cache?: CacheService;
   ```
3. Open `src/property-injection.module.ts`
4. Verify that `CacheService` is commented out (not provided)

**Expected Result**:
- ✅ NO error for missing `CacheService`
- The `@Optional()` decorator works on properties

**Pass Criteria**: No errors for optional property dependencies

---

### Test 8.4: Mixed Constructor and Property Injection

**File**: `src/property-injection.service.ts`

**Steps**:
1. Open `src/property-injection.service.ts`
2. Observe both injection types:
   ```typescript
   @Inject(DatabaseService)
   private database!: DatabaseService;  // Property

   constructor(
     @Inject("API_KEY") private apiKey: string  // Constructor
   ) {}
   ```
3. Verify no errors are shown

**Expected Result**:
- ✅ Both injection types work together
- No errors for either type

**Pass Criteria**: Mixed injection types work correctly

---

### Test 8.5: Auto-completion for Property Injection

**File**: `src/property-injection.service.ts`

**Steps**:
1. Open `src/property-injection.service.ts`
2. Add a new property:
   ```typescript
   @Inject()
   private test!: any;
   ```
3. Place cursor between parentheses: `@Inject(|)`
4. Trigger auto-completion (Ctrl+Space or Cmd+Space)

**Expected Result**:
- Dropdown shows available providers
- Same providers as constructor injection

**Pass Criteria**: Auto-completion works for property decorators

**Cleanup**: Remove the test property

---

### Test 8.6: Go-to-Definition for Property Injection

**File**: `src/property-injection.service.ts`

**Steps**:
1. Open `src/property-injection.service.ts`
2. Find the line: `@Inject(DatabaseService)`
3. Place cursor on `DatabaseService` inside `@Inject()`
4. Press F12 (or Cmd+Click)

**Expected Result**:
- Navigates to `src/database.service.ts`
- Shows the `DatabaseService` class definition

**Pass Criteria**: Go-to-definition works from property decorators

---

## Test Suite 9: Edge Cases

Use this template to record your test results:

```
Date: ___________
IDE: ___________
TypeScript Version: ___________
Plugin Version: ___________

Test Suite 1: Auto-completion
- Test 1.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 1.2: [ ] Pass [ ] Fail - Notes: ___________
- Test 1.3: [ ] Pass [ ] Fail - Notes: ___________

Test Suite 2: Go-to-Definition
- Test 2.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 2.2: [ ] Pass [ ] Fail - Notes: ___________
- Test 2.3: [ ] Pass [ ] Fail - Notes: ___________

Test Suite 3: Semantic Diagnostics - Errors
- Test 3.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 3.2: [ ] Pass [ ] Fail - Notes: ___________
- Test 3.3: [ ] Pass [ ] Fail - Notes: ___________

Test Suite 4: Semantic Diagnostics - No Errors
- Test 4.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 4.2: [ ] Pass [ ] Fail - Notes: ___________
- Test 4.3: [ ] Pass [ ] Fail - Notes: ___________

Test Suite 5: Module Import/Export Behavior
- Test 5.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 5.2: [ ] Pass [ ] Fail - Notes: ___________

Test Suite 6: Optional Dependencies (@Optional() Decorator)
- Test 6.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 6.2: [ ] Pass [ ] Fail - Notes: ___________
- Test 6.3: [ ] Pass [ ] Fail - Notes: ___________
- Test 6.4: [ ] Pass [ ] Fail - Notes: ___________
- Test 6.5: [ ] Pass [ ] Fail - Notes: ___________
- Test 6.6: [ ] Pass [ ] Fail - Notes: ___________

Test Suite 7: Global Modules
- Test 7.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 7.2: [ ] Pass [ ] Fail - Notes: ___________
- Test 7.3: [ ] Pass [ ] Fail - Notes: ___________
- Test 7.4: [ ] Pass [ ] Fail - Notes: ___________
- Test 7.5: [ ] Pass [ ] Fail - Notes: ___________
- Test 7.6: [ ] Pass [ ] Fail - Notes: ___________

Test Suite 8: Property Injection
- Test 8.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 8.2: [ ] Pass [ ] Fail - Notes: ___________
- Test 8.3: [ ] Pass [ ] Fail - Notes: ___________
- Test 8.4: [ ] Pass [ ] Fail - Notes: ___________
- Test 8.5: [ ] Pass [ ] Fail - Notes: ___________
- Test 8.6: [ ] Pass [ ] Fail - Notes: ___________

Test Suite 9: Edge Cases
- Test 9.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 9.2: [ ] Pass [ ] Fail - Notes: ___________

Test Suite 10: Performance
- Test 10.1: [ ] Pass [ ] Fail - Notes: ___________
- Test 10.2: [ ] Pass [ ] Fail - Notes: ___________

Overall Result: [ ] All Pass [ ] Some Failures

Issues Found:
1. ___________
2. ___________
```

---

## Test Suite 9: Circular Dependency Detection

### Test 9.1: Simple Circular Dependency Error

**Files**: `src/broken-examples/circular-dependency-a.service.ts`, `src/broken-examples/circular-dependency-b.service.ts`

**Steps**:
1. Open `src/broken-examples/circular-dependency-a.service.ts`
2. Locate the `@Inject(CircularDependencyBService)` decorator in the constructor
3. Hover over the red squiggly line

**Expected Result**:
- ❌ Red squiggly under `@Inject(CircularDependencyBService)`
- Error message: "Circular dependency detected: CircularDependencyAService -> CircularDependencyBService -> CircularDependencyAService. Consider using forwardRef() to resolve this circular dependency."
- Related information shows the full cycle path

**Pass Criteria**: ✅ Error appears with correct cycle path and forwardRef() suggestion

---

### Test 9.2: Circular Dependency in Second File

**File**: `src/broken-examples/circular-dependency-b.service.ts`

**Steps**:
1. Open `src/broken-examples/circular-dependency-b.service.ts`
2. Locate the `@Inject(CircularDependencyAService)` decorator in the constructor
3. Hover over the red squiggly line

**Expected Result**:
- ❌ Red squiggly under `@Inject(CircularDependencyAService)`
- Error message mentions the circular dependency
- Same cycle detected from the other direction

**Pass Criteria**: ✅ Error appears on both sides of the circular dependency

---

### Test 9.3: No Error with @Optional() Breaking the Cycle

**Files**: `src/circular-fixed-optional-a.service.ts`, `src/circular-fixed-optional-b.service.ts`

**Steps**:
1. Open `src/circular-fixed-optional-a.service.ts`
2. Verify the `@Inject(CircularFixedOptionalBService)` decorator has NO error
3. Open `src/circular-fixed-optional-b.service.ts`
4. Notice the `@Optional()` decorator on the `@Inject(CircularFixedOptionalAService)` parameter

**Expected Result**:
- ✅ NO errors in either file
- The `@Optional()` decorator breaks the circular dependency
- Both files compile without issues

**Pass Criteria**: ✅ No circular dependency errors when one side is optional

---

### Test 9.4: Understanding the Error Message

**File**: `src/broken-examples/circular-dependency-a.service.ts`

**Steps**:
1. Read the JSDoc comment at the top of the file
2. Review the three suggested solutions:
   - Option 1: Use `forwardRef()`
   - Option 2: Make one dependency optional
   - Option 3: Refactor to remove the cycle

**Expected Result**:
- Documentation clearly explains the problem
- Three different solutions are provided
- Code examples show how to implement each solution

**Pass Criteria**: ✅ Documentation is clear and helpful

---

### Test 9.5: Verify No False Positives

**File**: `src/user.service.ts`

**Steps**:
1. Open `src/user.service.ts`
2. Verify that the `@Inject(DatabaseService)` has NO circular dependency error
3. This is a normal linear dependency chain

**Expected Result**:
- ✅ NO circular dependency errors
- Only missing dependency or type mismatch errors (if any)
- Linear dependencies are not flagged as circular

**Pass Criteria**: ✅ No false positive circular dependency errors

---

### Test 9.6: Related Information

**File**: `src/broken-examples/circular-dependency-a.service.ts`

**Steps**:
1. Click on the error in the Problems panel (if your IDE supports it)
2. Look for "Related Information" or additional details

**Expected Result**:
- Related information shows: "Circular dependency path: CircularDependencyAService -> CircularDependencyBService -> CircularDependencyAService"
- This helps understand the full cycle

**Pass Criteria**: ✅ Related information provides the full cycle path

---

## Test Results Checklist

Mark each test as you complete it:

### Test Suite 9: Circular Dependency Detection
```
Test 9.1: Simple Circular Dependency Error ___________
Test 9.2: Circular Dependency in Second File ___________
Test 9.3: No Error with @Optional() Breaking the Cycle ___________
Test 9.4: Understanding the Error Message ___________
Test 9.5: Verify No False Positives ___________
Test 9.6: Related Information ___________
```

---

## Test Suite 10: Enhanced Provider Type Support

### Test 10.1: useClass Provider - No Errors

**Files**: `src/provider-types-example.service.ts`, `src/provider-types-example.module.ts`

**Steps**:
1. Open `src/provider-types-example.service.ts`
2. Locate the `ServiceUsingUseClassProvider` class
3. Check the constructor parameter `@Inject("DB_SERVICE")`
4. Verify no red squiggly lines appear

**Expected Result**:
- ✅ No errors on `@Inject("DB_SERVICE")`
- The provider is correctly resolved from the module's `useClass` provider

**Pass Criteria**: ✅ No errors appear for useClass provider usage

---

### Test 10.2: useValue Provider (String) - No Errors

**File**: `src/provider-types-example.service.ts`

**Steps**:
1. Locate the `ServiceUsingUseValueString` class
2. Check the constructor parameter `@Inject("API_KEY")`
3. Verify no red squiggly lines appear

**Expected Result**:
- ✅ No errors on `@Inject("API_KEY")`
- The provider is correctly resolved from the module's `useValue` provider

**Pass Criteria**: ✅ No errors appear for useValue string provider usage

---

### Test 10.3: useValue Provider (Number) - No Errors

**File**: `src/provider-types-example.service.ts`

**Steps**:
1. Locate the `ServiceUsingUseValueNumber` class
2. Check the constructor parameter `@Inject("PORT")`
3. Verify no red squiggly lines appear

**Expected Result**:
- ✅ No errors on `@Inject("PORT")`
- The provider is correctly resolved from the module's `useValue` provider

**Pass Criteria**: ✅ No errors appear for useValue number provider usage

---

### Test 10.4: useValue Provider (Object) - No Errors

**File**: `src/provider-types-example.service.ts`

**Steps**:
1. Locate the `ServiceUsingUseValueObject` class
2. Check the constructor parameter `@Inject("CONFIG")`
3. Verify no red squiggly lines appear

**Expected Result**:
- ✅ No errors on `@Inject("CONFIG")`
- The provider is correctly resolved from the module's `useValue` provider

**Pass Criteria**: ✅ No errors appear for useValue object provider usage

---

### Test 10.5: useFactory Provider (No Inject) - No Errors

**File**: `src/provider-types-example.service.ts`

**Steps**:
1. Locate the `ServiceUsingUseFactoryNoInject` class
2. Check the constructor parameter `@Inject("TIMESTAMP")`
3. Verify no red squiggly lines appear

**Expected Result**:
- ✅ No errors on `@Inject("TIMESTAMP")`
- The provider is correctly resolved from the module's `useFactory` provider

**Pass Criteria**: ✅ No errors appear for useFactory provider without inject

---

### Test 10.6: useFactory Provider (String Token Inject) - No Errors

**File**: `src/provider-types-example.service.ts`

**Steps**:
1. Locate the `ServiceUsingUseFactoryStringInject` class
2. Check the constructor parameter `@Inject("DATABASE_CONNECTION")`
3. Verify no red squiggly lines appear
4. Open `src/provider-types-example.module.ts`
5. Locate the `DATABASE_CONNECTION` factory provider
6. Verify the `inject: ["API_KEY", "PORT"]` array has no errors

**Expected Result**:
- ✅ No errors on `@Inject("DATABASE_CONNECTION")`
- ✅ No errors on the `inject` array
- The factory dependencies are correctly validated

**Pass Criteria**: ✅ No errors appear for useFactory provider with string token inject

---

### Test 10.7: useFactory Provider (Class Token Inject) - No Errors

**File**: `src/provider-types-example.service.ts`

**Steps**:
1. Locate the `ServiceUsingUseFactoryClassInject` class
2. Check the constructor parameter `@Inject("LOGGER_WITH_CONFIG")`
3. Verify no red squiggly lines appear
4. Open `src/provider-types-example.module.ts`
5. Locate the `LOGGER_WITH_CONFIG` factory provider
6. Verify the `inject: [ConfigService, LoggerService]` array has no errors

**Expected Result**:
- ✅ No errors on `@Inject("LOGGER_WITH_CONFIG")`
- ✅ No errors on the `inject` array
- The factory dependencies are correctly validated

**Pass Criteria**: ✅ No errors appear for useFactory provider with class token inject

---

### Test 10.8: useFactory Provider (Mixed Inject) - No Errors

**File**: `src/provider-types-example.service.ts`

**Steps**:
1. Locate the `ServiceUsingUseFactoryMixedInject` class
2. Check the constructor parameter `@Inject("MIXED_FACTORY")`
3. Verify no red squiggly lines appear
4. Open `src/provider-types-example.module.ts`
5. Locate the `MIXED_FACTORY` factory provider
6. Verify the `inject: ["API_KEY", DatabaseService]` array has no errors

**Expected Result**:
- ✅ No errors on `@Inject("MIXED_FACTORY")`
- ✅ No errors on the `inject` array
- The factory dependencies (both string and class tokens) are correctly validated

**Pass Criteria**: ✅ No errors appear for useFactory provider with mixed inject

---

### Test 10.9: useFactory Provider - Missing Inject Dependency Error

**File**: `src/provider-types-example.module.ts`

**Steps**:
1. Open `src/provider-types-example.module.ts`
2. Locate the `DATABASE_CONNECTION` factory provider
3. Modify the `inject` array to include a non-existent token: `inject: ["API_KEY", "MISSING_TOKEN"]`
4. Check for red squiggly lines

**Expected Result**:
- ❌ Red squiggly under `"MISSING_TOKEN"`
- Error message: "Factory provider dependency 'MISSING_TOKEN' is not provided in module 'ProviderTypesExampleModule'"
- Related information shows the factory provider

**Pass Criteria**: ✅ Error appears for missing factory dependency

**Cleanup**: Revert the change back to `inject: ["API_KEY", "PORT"]`

---

## Reporting Issues

If you find any issues during testing:

1. Note the exact steps to reproduce
2. Record the expected vs actual behavior
3. Include IDE version and TypeScript version
4. Check the TypeScript output panel for errors
5. Check the plugin log file (if debug mode is enabled)
6. Open an issue at: https://github.com/Isqanderm/ioc/issues

---

## Next Steps After Testing

Once you've verified all features work:

1. Review the `ROADMAP.md` for planned enhancements
2. Consider contributing to the plugin development
3. Share feedback with the team
4. Use the plugin in your real projects!

