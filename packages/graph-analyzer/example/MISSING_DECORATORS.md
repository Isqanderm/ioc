# Missing @Inject Decorators - Intentional Examples

This document lists the dependencies that are **intentionally left without `@Inject` decorators** to demonstrate the error detection feature of the graph analyzer.

## Purpose

These examples serve to:
1. Demonstrate the graph analyzer's ability to detect missing `@Inject` decorators
2. Show visual error indicators in the HTML visualization
3. Provide realistic examples of a common mistake in dependency injection

## Affected Providers

### 1. UserRepository (UsersModule)

**File:** `packages/graph-analyzer/example/src/features/users/user.repository.ts`

**Missing Decorator:**
- `cache: CacheService` (parameter index: 1)

**Code:**
```typescript
constructor(
  @Inject(DatabaseService) private database: DatabaseService,
  // INTENTIONALLY MISSING @Inject decorator for error detection demo
  private cache: CacheService,
  @Inject(LoggerService) private logger: LoggerService
) {}
```

**Expected Error:** The `cache` dependency is inferred from TypeScript type annotation but lacks an explicit `@Inject(CacheService)` decorator.

---

### 2. PostsService (PostsModule)

**File:** `packages/graph-analyzer/example/src/features/posts/posts.service.ts`

**Missing Decorator:**
- `usersService: UsersService` (parameter index: 1)

**Code:**
```typescript
constructor(
  @Inject(PostRepository) private postRepository: PostRepository,
  // INTENTIONALLY MISSING @Inject decorator for error detection demo
  private usersService: UsersService,
  @Inject(LoggerService) private logger: LoggerService
) {}
```

**Expected Error:** The `usersService` dependency is inferred from TypeScript type annotation but lacks an explicit `@Inject(UsersService)` decorator.

---

### 3. CommentsService (CommentsModule)

**File:** `packages/graph-analyzer/example/src/features/comments/comments.service.ts`

**Missing Decorator:**
- `emailService: EmailService` (parameter index: 3)

**Code:**
```typescript
constructor(
  @Inject(CommentRepository) private commentRepository: CommentRepository,
  @Inject(UsersService) private usersService: UsersService,
  @Inject(PostsService) private postsService: PostsService,
  // INTENTIONALLY MISSING @Inject decorator for error detection demo
  private emailService: EmailService,
  @Inject(LoggerService) private logger: LoggerService
) {}
```

**Expected Error:** The `emailService` dependency is inferred from TypeScript type annotation but lacks an explicit `@Inject(EmailService)` decorator.

---

## How to View Errors

### In JSON Output

Run the analyzer with JSON format:
```bash
cd packages/graph-analyzer
node dist/cli.js -f json -o output/graph.json -c example/tsconfig.json example/src/entry.ts
```

Look for dependencies with `"hasExplicitDecorator": false`:
```json
{
  "token": "CommentsService",
  "dependencies": [
    {
      "type": "constructor",
      "index": 3,
      "token": "EmailService",
      "hasExplicitDecorator": false,
      "raw": "private emailService: EmailService"
    }
  ]
}
```

### In HTML Visualization

Run the analyzer with HTML format:
```bash
cd packages/graph-analyzer
node dist/cli.js -f html -o output/graph.html -c example/tsconfig.json example/src/entry.ts
```

Open `output/graph.html` in a browser. You will see:

1. **Warning Banner** at the top listing all affected providers
2. **Red Border** on provider nodes with missing decorators
3. **Warning Icon** (⚠️) next to affected dependencies in the details panel
4. **Error Message** when clicking on an affected provider

## Why This Matters

### Reflection-based DI vs Explicit Decorators

**Reflection-based DI** (TypeScript metadata):
```typescript
constructor(private service: MyService) {}
```
- Relies on `emitDecoratorMetadata` in tsconfig.json
- Works in development but may fail in production builds
- Type information can be lost during minification

**Explicit @Inject decorators**:
```typescript
constructor(@Inject(MyService) private service: MyService) {}
```
- Explicit dependency declaration
- Works reliably in all environments
- Recommended for production applications

### Potential Runtime Errors

Without explicit `@Inject` decorators, you may encounter:
- `Cannot resolve dependency` errors at runtime
- Incorrect dependency injection in minified builds
- Silent failures in production environments

## Fixing the Errors

To fix these intentional errors, add `@Inject` decorators:

```typescript
// Before (error)
constructor(private cache: CacheService) {}

// After (fixed)
constructor(@Inject(CacheService) private cache: CacheService) {}
```

## Summary

- **Total Providers:** 17
- **Providers with Missing Decorators:** 3
- **Total Missing Decorators:** 3
- **Affected Modules:** UsersModule, PostsModule, CommentsModule

These examples demonstrate the importance of explicit dependency injection and the graph analyzer's ability to detect this common mistake.

