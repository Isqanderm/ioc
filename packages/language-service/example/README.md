# TypeScript Language Service Plugin - Manual Testing Example

This example project demonstrates all features of the `@nexus-ioc/language-service` plugin in action. Use this to manually verify that the plugin works correctly in your IDE.

## 📋 Table of Contents

- [Setup Instructions](#setup-instructions)
- [IDE Configuration](#ide-configuration)
- [Features to Test](#features-to-test)
- [Expected Behavior](#expected-behavior)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

**Important**: This example is part of the Nexus IoC monorepo. You need to install dependencies from the monorepo root, not from this directory.

From the monorepo root:

```bash
# Install all monorepo dependencies
npm install

# Build the core package (required dependency)
cd packages/ioc
npm run build

# Build the language service plugin
cd ../language-service
npm run build
```

### Step 2: Verify Plugin Build

Check that the plugin was built successfully:

```bash
ls packages/language-service/dist/
# Should see: index.js and other compiled files
```

### Step 3: Open Example in IDE

```bash
# Open the example directory in VS Code
code packages/language-service/example/
```

Or open the entire monorepo and navigate to `packages/language-service/example/`.

---

## ⚙️ IDE Configuration

### Visual Studio Code

The example includes a `tsconfig.json` that references the plugin. VS Code should automatically detect it.

#### Verify Plugin is Loaded

1. Open any `.ts` file in the example
2. Open the **Output** panel (View → Output)
3. Select **TypeScript** from the dropdown
4. Look for a message like:
   ```
   Nexus-IoC compiler options for /path/to/example: {"debug":false,"logPath":"./nexus-ioc-plugin.log"}
   ```

#### Enable TypeScript Version

Make sure VS Code is using the workspace TypeScript version:

1. Open any `.ts` file
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type: **TypeScript: Select TypeScript Version**
4. Choose: **Use Workspace Version**

#### Enable Debug Logging (Optional)

To see detailed plugin logs, update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nexus-ioc/language-service",
        "debug": true
      }
    ]
  }
}
```

Then check the log file: `packages/language-service/example/nexus-ioc-plugin.log`

### WebStorm / IntelliJ IDEA

1. Open **Settings** → **Languages & Frameworks** → **TypeScript**
2. Ensure **TypeScript Language Service** is enabled
3. The plugin should be automatically detected from `tsconfig.json`

**Note**: WebStorm's support for TypeScript Language Service Plugins is limited. Some features may not work.

### Other IDEs

Any IDE that supports TypeScript Language Service Plugins should work:
- Vim/Neovim with coc.nvim or nvim-lspconfig
- Emacs with tide
- Sublime Text with LSP-typescript

Refer to your IDE's documentation for enabling TypeScript plugins.

---

## 🧪 Features to Test

### Feature 1: IntelliSense & Auto-completion

**File**: `src/user.service.ts`

1. Open `src/user.service.ts`
2. Find the `UserService` constructor
3. Place your cursor inside `@Inject()` - between the parentheses
4. Trigger auto-completion (usually `Ctrl+Space`)

**Expected**:
- You should see a list of available providers:
  - `DatabaseService` (class)
  - `LoggerService` (class)
  - `'API_KEY'` (string token)
  - `'DATABASE_CONFIG'` (string token)

**Screenshot Location**: See `docs/screenshots/autocomplete.png` (if available)

---

### Feature 2: Go-to-Definition

**File**: `src/user.service.ts`

1. Open `src/user.service.ts`
2. Find the line: `@Inject(DatabaseService) private db: DatabaseService`
3. Place your cursor on `DatabaseService` inside `@Inject()`
4. Press `F12` or `Cmd+Click` (Mac) / `Ctrl+Click` (Windows)

**Expected**:
- Your IDE should navigate to `src/database.service.ts`
- The cursor should be on the `DatabaseService` class definition

**Try also**:
- Go-to-definition on `LoggerService` → should navigate to `src/logger.service.ts`
- Go-to-definition on `'API_KEY'` → should navigate to the provider in `src/app.module.ts`

---

### Feature 3: Semantic Diagnostics - Missing Dependency

**File**: `src/broken-examples/missing-dependency.service.ts`

1. Open `src/broken-examples/missing-dependency.service.ts`
2. Look at the red squiggly underline under the `@Inject(NonExistentService)` line

**Expected Error**:
```
Class 'MissingDependencyService' is missing dependency: NonExistentService
```

**Related Information**:
- Should show which module was checked: `Module: AppModule`

**Try fixing it**:
1. Add `NonExistentService` to the providers array in `src/app.module.ts`
2. The error should disappear

---

### Feature 4: Semantic Diagnostics - Type Mismatch

**File**: `src/broken-examples/type-mismatch.service.ts`

1. Open `src/broken-examples/type-mismatch.service.ts`
2. Look at the error on the `wrongTypeLogger` parameter

**Expected Error**:
```
Type mismatch for dependency 'LoggerService'
```

**Explanation**:
- The parameter is typed as `string` but `LoggerService` is a class
- The plugin detects this mismatch

**Try fixing it**:
1. Change the parameter type from `string` to `LoggerService`
2. The error should disappear

---

### Feature 5: Semantic Diagnostics - Service Not Connected to Module

**File**: `src/broken-examples/orphan.service.ts`

1. Open `src/broken-examples/orphan.service.ts`
2. Look at the error on the `@Inject()` decorator

**Expected Error**:
```
Class 'OrphanService' is missing dependency: DatabaseService
```

**Explanation**:
- `OrphanService` is not added to any module's providers
- Therefore, it can't access any dependencies
- The plugin detects this and reports missing dependencies

**Try fixing it**:
1. Add `OrphanService` to the providers array in `src/app.module.ts`
2. The error should disappear

---

### Feature 6: Working with String Tokens

**File**: `src/config.service.ts`

1. Open `src/config.service.ts`
2. See how string tokens are used: `@Inject('API_KEY')`
3. Try auto-completion inside `@Inject('')`
4. Try go-to-definition on `'API_KEY'`

**Expected**:
- Auto-completion should suggest `'API_KEY'` and `'DATABASE_CONFIG'`
- Go-to-definition should navigate to the provider in `app.module.ts`

---

### Feature 7: Module Imports and Exports

**File**: `src/user.module.ts` and `src/app.module.ts`

1. Open `src/user.module.ts`
2. Note that `UserModule` exports `UserService`
3. Open `src/app.module.ts`
4. Note that `AppModule` imports `UserModule`
5. Open `src/post.service.ts`
6. See that `PostService` can inject `UserService` because it's exported

**Expected**:
- No errors in `PostService` when injecting `UserService`
- Auto-completion in `PostService` should suggest `UserService`

**Try breaking it**:
1. Remove `UserService` from the exports in `user.module.ts`
2. You should see an error in `post.service.ts`: "missing dependency: UserService"

---

### Feature 8: Multiple Modules

**File**: `src/app.module.ts`

1. Open `src/app.module.ts`
2. See how multiple modules are imported: `UserModule`, `PostModule`
3. Each module provides its own services
4. Services can depend on services from imported modules

**Expected**:
- No errors when modules are properly imported
- Errors appear when imports are missing

---

### Feature 9: Optional Dependencies with @Optional()

**Files**: `src/optional-dependencies.service.ts`, `src/optional-example.module.ts`, `src/all-optional.service.ts`

The `@Optional()` decorator allows you to mark dependencies as optional. When a dependency is optional, the plugin will NOT report an error if it's missing from the module.

#### Test Case 1: Mixed Required and Optional Dependencies

1. Open `src/optional-dependencies.service.ts`
2. Observe the constructor with three dependencies:
   - `ConfigService` - **REQUIRED** (no `@Optional()`)
   - `LoggerService` - **OPTIONAL** (has `@Optional()`)
   - `CacheService` - **OPTIONAL** (has `@Optional()` with string token)

3. Open `src/optional-example.module.ts`
4. Note that the module provides:
   - ✅ `ConfigService` (required)
   - ✅ `LoggerService` (optional)
   - ❌ `CacheService` is NOT provided (but no error because it's optional)

**Expected**:
- ✅ No errors for missing `CacheService` (it's optional)
- ✅ No errors for `LoggerService` (it's provided)
- ❌ If you remove `ConfigService` from providers, you'll see an error (it's required)

**Try this experiment**:
1. In `optional-example.module.ts`, remove `ConfigService` from providers
2. You should see an error: `Class 'OptionalDependenciesService' is missing dependency: ConfigService`
3. Add it back - error disappears
4. Remove `LoggerService` from providers
5. No error appears (it's optional)

#### Test Case 2: All Dependencies Optional

1. Open `src/all-optional.service.ts`
2. Notice that ALL dependencies have `@Optional()`
3. This service is NOT added to any module

**Expected**:
- ✅ No errors at all, even though the service isn't in any module
- ✅ No errors for missing dependencies (all are optional)

**Explanation**:
- When all dependencies are optional, the service can work standalone
- This is useful for plugin systems, cross-cutting concerns, or services with fallback behavior

#### Test Case 3: Decorator Order

The `@Optional()` decorator can be placed before or after `@Inject()`:

```typescript
// Both are valid:
@Inject(LoggerService)
@Optional()
private logger?: LoggerService

// OR

@Optional()
@Inject(LoggerService)
private logger?: LoggerService
```

**Expected**:
- Both orders work correctly
- The plugin detects `@Optional()` regardless of order

#### Test Case 4: Optional Without Parentheses

```typescript
@Inject(LoggerService)
@Optional  // No parentheses
private logger?: LoggerService
```

**Expected**:
- Works the same as `@Optional()`
- The plugin handles both syntaxes

---

### Feature 10: Global Modules with @Global()

**File**: `feature-with-global-deps.service.ts`

**What to Test**:
1. Open `feature-with-global-deps.service.ts`
2. Notice that `GlobalConfigService` and `GlobalLoggerService` are injected
3. Open `feature-with-global-deps.module.ts`
4. Notice that it does NOT import `GlobalConfigModule` or `GlobalLoggerModule`

**Expected**:
- ✅ NO errors for `GlobalConfigService` dependency
- ✅ NO errors for `GlobalLoggerService` dependency
- The plugin recognizes that these services are provided by global modules

**Test Case 1**: Global module providers are available everywhere

```typescript
// In feature-with-global-deps.service.ts
@Injectable()
export class FeatureWithGlobalDepsService {
  constructor(
    @Inject(GlobalConfigService) private config: GlobalConfigService,  // ✅ No error
    @Inject(GlobalLoggerService) private logger: GlobalLoggerService,  // ✅ No error
  ) {}
}
```

**Test Case 2**: Module doesn't need to import global modules

```typescript
// In feature-with-global-deps.module.ts
@NsModule({
  providers: [FeatureWithGlobalDepsService],
  exports: [FeatureWithGlobalDepsService],
  // Notice: NO imports of GlobalConfigModule or GlobalLoggerModule
})
export class FeatureWithGlobalDepsModule {}
```

**Test Case 3**: Try removing @Global() decorator

1. Open `global-config.module.ts`
2. Comment out the `@Global()` decorator
3. Go back to `feature-with-global-deps.service.ts`

**Expected**:
- ❌ Error appears: "Class 'FeatureWithGlobalDepsService' is missing dependency: GlobalConfigService"
- This proves the plugin is correctly detecting global modules

4. Uncomment `@Global()` to restore functionality

**Test Case 4**: Global modules work with orphan services

Create a new file `orphan-with-global.service.ts`:

```typescript
import { Injectable, Inject } from "@nexus-ioc/core";
import { GlobalLoggerService } from "./global-logger.service";

@Injectable()
export class OrphanWithGlobalService {
  constructor(@Inject(GlobalLoggerService) private logger: GlobalLoggerService) {}
}
```

**Expected**:
- ✅ NO error for `GlobalLoggerService` dependency
- Even though this service is not connected to any module, global providers are still available

---

### Feature 11: Property Injection with @Inject()

**Files**: `src/property-injection.service.ts`, `src/optional-property-injection.service.ts`, `src/property-injection.module.ts`

The `@Inject()` decorator can be used on class properties in addition to constructor parameters. This allows for more flexible dependency injection patterns.

#### Test Case 1: Basic Property Injection

1. Open `src/property-injection.service.ts`
2. Observe the property injection:
   ```typescript
   @Inject(DatabaseService)
   private database!: DatabaseService;

   @Inject(LoggerService)
   private logger!: LoggerService;
   ```

**Expected**:
- ✅ Auto-completion works inside `@Inject()` on properties
- ✅ Go-to-definition works from property `@Inject()` decorators
- ✅ Semantic diagnostics detect missing property dependencies

**Try this experiment**:
1. In `property-injection.module.ts`, remove `DatabaseService` from providers
2. You should see an error in `property-injection.service.ts`: `Class 'PropertyInjectionService' is missing dependency: DatabaseService`
3. Add it back - error disappears

#### Test Case 2: Mixed Constructor and Property Injection

1. Open `src/property-injection.service.ts`
2. Notice it uses BOTH constructor and property injection:
   ```typescript
   @Injectable()
   export class PropertyInjectionService {
     @Inject(DatabaseService)
     private database!: DatabaseService;  // Property injection

     constructor(
       @Inject("API_KEY") private apiKey: string  // Constructor injection
     ) {}
   }
   ```

**Expected**:
- ✅ Both injection types work together
- ✅ Errors are reported for missing dependencies in both locations

#### Test Case 3: Optional Property Injection

1. Open `src/optional-property-injection.service.ts`
2. Observe the optional property injection:
   ```typescript
   @Inject(CacheService)
   @Optional()
   private cache?: CacheService;
   ```

3. Open `src/property-injection.module.ts`
4. Notice that `CacheService` is commented out (not provided)

**Expected**:
- ✅ NO error for missing `CacheService` (it's optional)
- ✅ The service handles the missing dependency gracefully

**Try this experiment**:
1. In `optional-property-injection.service.ts`, remove `@Optional()` from the cache property
2. You should see an error: `Class 'OptionalPropertyInjectionService' is missing dependency: CacheService`
3. Add `@Optional()` back - error disappears

#### Test Case 4: Property Injection with String Tokens

Property injection works with string tokens just like constructor injection:

```typescript
@Inject('DATABASE_CONFIG')
private config!: DatabaseConfig;
```

**Expected**:
- ✅ Auto-completion suggests string tokens
- ✅ Go-to-definition navigates to the provider

---

### Feature 12: Circular Dependency Detection

**Files**: `src/broken-examples/circular-dependency-a.service.ts`, `src/broken-examples/circular-dependency-b.service.ts`, `src/circular-fixed-optional-a.service.ts`, `src/circular-fixed-optional-b.service.ts`

The plugin detects circular dependencies in your dependency injection graph and suggests solutions.

#### Test Case 1: Simple Circular Dependency

1. Open `src/broken-examples/circular-dependency-a.service.ts`
2. Observe the error on the `@Inject(CircularDependencyBService)` decorator

**Expected Error**:
- ❌ "Circular dependency detected: CircularDependencyAService -> CircularDependencyBService -> CircularDependencyAService. Consider using forwardRef() to resolve this circular dependency."
- Related information shows the full cycle path

**Explanation**:
- CircularDependencyAService depends on CircularDependencyBService
- CircularDependencyBService depends on CircularDependencyAService
- This creates a cycle that cannot be resolved at runtime

#### Test Case 2: Fixing with @Optional()

1. Open `src/circular-fixed-optional-a.service.ts`
2. Open `src/circular-fixed-optional-b.service.ts`
3. Notice that CircularFixedOptionalBService has `@Optional()` on its dependency

**Expected**:
- ✅ NO errors
- The `@Optional()` decorator breaks the circular dependency
- Optional dependencies are not considered when detecting cycles

**Explanation**:
- Making one side of the dependency optional breaks the cycle
- The IoC container can resolve the dependencies in order
- The optional dependency will be injected after the required one

#### Test Case 3: Solutions for Circular Dependencies

The plugin suggests three solutions in the error message:

**Option 1: Use forwardRef()**
```typescript
import { forwardRef } from "@nexus-ioc/core";

constructor(
  @Inject(forwardRef(() => CircularDependencyBService))
  private serviceB: CircularDependencyBService
) {}
```

**Option 2: Make one dependency optional**
```typescript
constructor(
  @Inject(CircularDependencyBService)
  @Optional()
  private serviceB?: CircularDependencyBService
) {}
```

**Option 3: Refactor to remove the cycle**
- Extract shared logic into a third service
- Use events/observers instead of direct dependencies
- Redesign the architecture to avoid the cycle

---

### Feature 13: Enhanced Provider Type Support

**Files**: `src/provider-types-example.service.ts`, `src/provider-types-example.module.ts`

The plugin supports all provider types in Nexus IoC and validates factory provider dependencies.

#### Supported Provider Types

**1. Class Provider (Shorthand)**
```typescript
@NsModule({
  providers: [DatabaseService]
})
```

**2. useClass Provider**
```typescript
@NsModule({
  providers: [
    {
      provide: "DB_SERVICE",
      useClass: MockDatabaseService
    }
  ]
})
```

**3. useValue Provider**
```typescript
@NsModule({
  providers: [
    {
      provide: "API_KEY",
      useValue: "secret-key-123"
    },
    {
      provide: "PORT",
      useValue: 3000
    },
    {
      provide: "CONFIG",
      useValue: { debug: true, timeout: 5000 }
    }
  ]
})
```

**4. useFactory Provider**
```typescript
@NsModule({
  providers: [
    // Factory without dependencies
    {
      provide: "TIMESTAMP",
      useFactory: (): number => Date.now()
    },

    // Factory with dependencies
    {
      provide: "DATABASE_CONNECTION",
      useFactory: (apiKey: string, port: number) => {
        return { apiKey, port, connected: true };
      },
      inject: ["API_KEY", "PORT"]
    }
  ]
})
```

#### Test Case 1: All Provider Types Work

1. Open `src/provider-types-example.service.ts`
2. Check all service classes (ServiceUsingClassProvider, ServiceUsingUseClassProvider, etc.)

**Expected**:
- ✅ NO errors on any `@Inject()` decorators
- All provider types are correctly resolved

#### Test Case 2: Factory Dependency Validation

1. Open `src/provider-types-example.module.ts`
2. Locate the `DATABASE_CONNECTION` factory provider
3. Modify the `inject` array to include a non-existent token: `inject: ["API_KEY", "MISSING_TOKEN"]`

**Expected Error**:
- ❌ "Factory provider dependency 'MISSING_TOKEN' is not provided in module 'ProviderTypesExampleModule'"

**Cleanup**: Revert the change back to `inject: ["API_KEY", "PORT"]`

#### What the Plugin Validates

- ✅ All provider types (class, useClass, useValue, useFactory) are recognized
- ✅ Factory provider `inject` dependencies are validated
- ✅ Missing factory dependencies are reported as errors
- ✅ Both string tokens and class tokens work in `inject` arrays
- ✅ Mixed inject arrays (string + class tokens) are supported

---

## 📸 Expected Behavior Summary

### ✅ What Should Work

| Feature | Expected Behavior |
|---------|-------------------|
| **Auto-completion** | Shows available providers when typing inside `@Inject()` |
| **Go-to-definition** | Navigates to provider definition from `@Inject(Token)` |
| **Missing dependency error** | Red squiggly when dependency not provided in any module |
| **Type mismatch error** | Red squiggly when injected type doesn't match parameter type |
| **Orphan service error** | Red squiggly when service not connected to any module |
| **String tokens** | Auto-completion and go-to-definition work for string tokens |
| **Module imports** | Exported providers from imported modules are available |
| **Optional dependencies** | `@Optional()` decorator prevents errors for missing dependencies |
| **Global modules** | `@Global()` modules make providers available everywhere |
| **Property injection** | `@Inject()` decorator works on class properties |
| **Circular dependency detection** | Detects and reports circular dependencies with suggested fixes |
| **Enhanced provider types** | Supports useClass, useValue, useFactory with dependency validation |

### ⚠️ Known Limitations (Not Yet Implemented)

| Feature | Status |
|---------|--------|
| **Quick fixes** | ❌ No automated fixes available |
| **Hover information** | ❌ No hover tooltips |
| **Dynamic modules** | ❌ `forRoot()` and `forFeature()` not fully supported |

---

## 🐛 Troubleshooting

### Plugin Not Loading

**Symptom**: No auto-completion, no errors, plugin seems inactive

**Solutions**:
1. Check that the plugin is built: `ls packages/language-service/dist/`
2. Restart your IDE
3. In VS Code: Reload window (`Cmd+Shift+P` → "Reload Window")
4. Check TypeScript output panel for errors
5. Verify `tsconfig.json` has the plugin configured correctly

### Auto-completion Not Working

**Symptom**: No suggestions appear inside `@Inject()`

**Solutions**:
1. Make sure your cursor is **inside** the parentheses: `@Inject(|)` not `@Inject|()`
2. Trigger manually with `Ctrl+Space`
3. Check that the service is added to a module's providers
4. Restart TypeScript server: `Cmd+Shift+P` → "TypeScript: Restart TS Server"

### Go-to-Definition Not Working

**Symptom**: F12 doesn't navigate to provider

**Solutions**:
1. Make sure the provider exists in a module
2. Check that the module is imported
3. Try clicking directly on the token name inside `@Inject(Token)`
4. Some IDEs require `Ctrl+Click` instead of `F12`

### Errors Not Appearing

**Symptom**: No red squiggly lines for broken examples

**Solutions**:
1. Wait a few seconds - TypeScript may be analyzing
2. Save the file (`Cmd+S` / `Ctrl+S`)
3. Check that TypeScript is not showing other errors that might hide plugin errors
4. Restart TypeScript server

### Too Many Errors

**Symptom**: Errors on valid code

**Possible Causes**:
1. Using `@Optional()` - not yet supported, will show false errors
2. Using `@Global()` modules - not yet supported
3. Using property injection - not yet supported

**Workaround**: See `ROADMAP.md` for planned support

---

## 📚 Additional Resources

- **Plugin Source Code**: `packages/language-service/src/`
- **Feature Roadmap**: `packages/language-service/ROADMAP.md`
- **Nexus IoC Documentation**: `packages/ioc/README.md`
- **Report Issues**: https://github.com/Isqanderm/ioc/issues

---

## 🎯 Testing Checklist

Use this checklist to verify all features:

- [ ] Auto-completion shows providers inside `@Inject()`
- [ ] Auto-completion shows both class and string tokens
- [ ] Go-to-definition works for class tokens
- [ ] Go-to-definition works for string tokens
- [ ] Error shown for missing dependencies
- [ ] Error shown for type mismatches
- [ ] Error shown for orphan services (not in any module)
- [ ] No errors for properly configured services
- [ ] Exported providers from imported modules are available
- [ ] Plugin loads without errors in IDE

---

## 💡 Tips for Best Experience

1. **Use TypeScript 5.0+**: The plugin works best with recent TypeScript versions
2. **Enable strict mode**: Helps catch type errors early
3. **Organize modules**: Keep related services in the same module
4. **Export selectively**: Only export what other modules need
5. **Use class tokens when possible**: Better type safety than string tokens

---

## 🤝 Contributing

Found a bug or have a feature request? Please open an issue!

Want to improve the plugin? See `ROADMAP.md` for planned features and contribute!

