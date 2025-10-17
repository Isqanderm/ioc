# Memory Leak Testing Guide for @nexus-ioc/core

## Overview

This document describes the memory leak detection test suite for the @nexus-ioc IoC container. The tests verify that the container properly manages memory and doesn't leak resources during normal operations.

## Running the Tests

### Basic Usage

```bash
# Run memory leak tests with garbage collection enabled
npm run test:memory

# Or manually with vitest
node --expose-gc ./node_modules/.bin/vitest run memory-leak.spec.ts
```

### Important: `--expose-gc` Flag

The tests **require** the `--expose-gc` flag to force garbage collection between test iterations. Without this flag:
- Tests will still run but with a warning
- Results may be less accurate
- Memory measurements may show false positives

## Test Categories

### 1. Container Lifecycle Tests

**Purpose:** Verify that creating and destroying containers doesn't leak memory.

**What it tests:**
- Multiple container creation/destruction cycles (100 iterations)
- WeakRef cleanup verification
- Memory returns to baseline after GC

**Expected behavior:**
- Memory growth < 10% after cleanup
- WeakRef objects are garbage collected

### 2. Scope-based Memory Management

**Purpose:** Verify correct memory behavior for different provider scopes.

**What it tests:**
- **Singleton:** Instances persist while container is alive
- **Request:** Instances are cleaned up after request context
- **Transient:** Instances are never cached and can be GC'd immediately

**Expected behavior:**
- Transient instances: >95% collected after GC
- Singleton instances: Remain alive while container exists
- Request instances: Collected after container destruction

### 3. Circular Dependencies

**Purpose:** Ensure circular dependencies don't create memory leaks.

**What it tests:**
- Services with circular references (A → B → A)
- Proxy objects used for circular dependency resolution
- Cleanup of circular reference chains

**Expected behavior:**
- Memory growth < 10% after cleanup
- Circular dependency proxies are garbage collected

### 4. Lifecycle Hooks

**Purpose:** Verify that `onModuleInit` hooks don't leak memory.

**What it tests:**
- Multiple hook executions
- Closures created in hooks
- Async operations in hooks

**Expected behavior:**
- Hook closures are cleaned up
- Memory growth < 10% after cleanup

### 5. Dynamic Modules

**Purpose:** Test memory management for `forRoot` and `forFeature` patterns.

**What it tests:**
- Dynamic module creation with configuration
- Factory providers with closures
- Module cleanup after destruction

**Expected behavior:**
- Configuration objects are cleaned up
- Factory closures don't leak
- Memory growth < 10% after cleanup

### 6. Stress Tests

**Purpose:** Verify container handles high load without memory leaks.

**What it tests:**
- 500 providers in a single module
- Deep dependency trees (5 levels)
- Mixed scopes (Singleton + Request + Transient)

**Expected behavior:**
- Memory growth < 15% for stress tests (slightly higher threshold)
- Deep dependency chains are cleaned up properly

### 7. Complex Real-World Scenarios

**Purpose:** Test realistic application patterns.

**What it tests:**
- Module hierarchies (imports/exports)
- Factory providers with closures
- Repository pattern with database services

**Expected behavior:**
- Module hierarchies don't leak
- Factory closures are managed correctly
- Memory growth < 10% after cleanup

## Interpreting Results

### Console Output

Each test outputs detailed memory statistics:

```
📊 Container Lifecycle Test (100 iterations):
   Baseline: 45.23 MB
   After:    47.15 MB
   Diff:     +1.92 MB
   Growth:   4.24%
```

**What to look for:**
- ✅ **Growth < 10%**: Test passes, no significant leak
- ⚠️ **Growth 10-20%**: Borderline, investigate further
- ❌ **Growth > 20%**: Likely memory leak, needs fixing

### WeakRef Tests

WeakRef tests show how many objects remain alive after GC:

```
🗑️  WeakRef Cleanup Test:
   Before GC: 50/50 alive
   After GC:  2/50 alive
```

**What to look for:**
- ✅ **< 10% alive**: Objects are being collected properly
- ⚠️ **10-20% alive**: Some objects retained (may be timing)
- ❌ **> 20% alive**: Objects not being collected, possible leak

## Common Issues and Solutions

### Issue: High Memory Growth

**Symptoms:**
- Memory growth > 20%
- Tests fail consistently

**Possible causes:**
1. Container instances not being released
2. Singleton providers holding references
3. Event listeners not cleaned up
4. Closures capturing large objects

**Solutions:**
1. Ensure containers go out of scope
2. Check for global references
3. Verify cleanup methods are called
4. Review closure captures

### Issue: WeakRef Objects Not Collected

**Symptoms:**
- > 20% of WeakRef objects remain alive after GC

**Possible causes:**
1. Objects still referenced somewhere
2. GC hasn't run enough cycles
3. V8 optimization keeping objects alive temporarily

**Solutions:**
1. Increase GC cycles in test
2. Add longer wait time between GC calls
3. Check for unintended references

### Issue: Inconsistent Results

**Symptoms:**
- Tests pass sometimes, fail other times
- Memory measurements vary widely

**Possible causes:**
1. Background processes affecting memory
2. Not enough GC cycles
3. V8 JIT compilation affecting measurements

**Solutions:**
1. Run tests in isolation
2. Increase GC cycles and wait times
3. Run multiple times and average results

## Thresholds and Tolerances

### Memory Growth Thresholds

| Test Type | Threshold | Rationale |
|-----------|-----------|-----------|
| Standard tests | 10% | Normal variance in V8 heap |
| Stress tests | 15% | Higher load, more variance |
| Baseline verification | 5% | Should be very stable |

### WeakRef Collection Thresholds

| Scope | Expected Collection | Threshold |
|-------|---------------------|-----------|
| Transient | > 95% | < 5% alive |
| Request | > 80% | < 20% alive |
| Singleton | 0% (while container alive) | N/A |

## Best Practices

### When Writing New Tests

1. **Always use `performGCCycles()`** before and after measurements
2. **Use WeakRef** to verify objects are actually collected
3. **Run enough iterations** (minimum 50-100) to detect gradual leaks
4. **Measure baseline** before operations
5. **Document expected behavior** in test description

### Example Test Structure

```typescript
it("should not leak memory when doing X", async () => {
  // 1. Setup
  const weakRefs: WeakRef<MyService>[] = [];
  
  // 2. Take baseline
  await performGCCycles();
  const baseline = takeMemorySnapshot();
  
  // 3. Perform operations
  const iterations = 100;
  for (let i = 0; i < iterations; i++) {
    const container = await Test.createModule(MyModule).compile();
    const instance = await container.get(MyService);
    if (instance) {
      weakRefs.push(new WeakRef(instance));
    }
  }
  
  // 4. Force cleanup
  await performGCCycles();
  const afterCleanup = takeMemorySnapshot();
  
  // 5. Verify
  const diff = calculateMemoryDiff(baseline, afterCleanup);
  const growthRatio = diff.heapUsed / baseline.heapUsed;
  
  expect(Math.abs(growthRatio)).toBeLessThan(0.1);
  
  // 6. Verify WeakRef cleanup
  const aliveAfterGC = weakRefs.filter(ref => ref.deref() !== undefined).length;
  expect(aliveAfterGC).toBeLessThan(10);
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Memory Leak Tests
  run: |
    node --expose-gc ./node_modules/.bin/vitest run memory-leak.spec.ts
  env:
    NODE_OPTIONS: "--expose-gc"
```

### Regression Testing

To detect memory regressions:

1. Run tests on main branch, save results
2. Run tests on feature branch
3. Compare memory growth percentages
4. Fail if growth increases by > 5%

## Debugging Memory Leaks

### Using Chrome DevTools

1. Add `--inspect-brk` flag:
   ```bash
   node --expose-gc --inspect-brk ./node_modules/.bin/vitest run memory-leak.spec.ts
   ```

2. Open `chrome://inspect` in Chrome
3. Take heap snapshots before/after operations
4. Compare snapshots to find retained objects

### Using Node.js Heap Dump

```typescript
import { writeHeapSnapshot } from 'v8';

// In your test
writeHeapSnapshot('./heap-before.heapsnapshot');
// ... perform operations ...
writeHeapSnapshot('./heap-after.heapsnapshot');
```

Analyze with Chrome DevTools Memory profiler.

## References

- [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
- [V8 Garbage Collection](https://v8.dev/blog/trash-talk)
- [WeakRef Documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef)
- [Memory Profiling in Chrome](https://developer.chrome.com/docs/devtools/memory-problems/)

## Maintenance

### When to Update Tests

- After adding new features (scopes, providers, etc.)
- When changing container lifecycle
- After performance optimizations
- When users report memory issues

### Monitoring

Consider adding:
- Automated memory regression tests in CI
- Memory usage metrics in production
- Alerts for unusual memory growth patterns

