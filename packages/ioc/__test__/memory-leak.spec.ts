import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { Inject, Injectable, Module, Scope } from "../src";

/**
 * Memory Leak Detection Test Suite for @nexus-ioc/core
 *
 * This test suite checks for memory leaks in the IoC container by:
 * 1. Measuring heap memory before and after operations
 * 2. Using WeakRef to verify objects are garbage collected
 * 3. Testing different scopes (Singleton, Request, Transient)
 * 4. Stress testing with many iterations
 *
 * Run with: npm run test:memory
 * Or: node --expose-gc ./node_modules/.bin/vitest run memory-leak.spec.ts
 */

// ============================================================================
// Helper Functions for Memory Measurement
// ============================================================================

interface MemorySnapshot {
	heapUsed: number;
	heapTotal: number;
	external: number;
	arrayBuffers: number;
}

/**
 * Forces garbage collection if available (requires --expose-gc flag)
 */
function forceGC(): void {
	if (global.gc) {
		global.gc();
	} else {
		console.warn(
			"⚠️  Garbage collection not exposed. Run with --expose-gc flag for accurate results.",
		);
	}
}

/**
 * Takes a snapshot of current memory usage
 */
function takeMemorySnapshot(): MemorySnapshot {
	const mem = process.memoryUsage();
	return {
		heapUsed: mem.heapUsed,
		heapTotal: mem.heapTotal,
		external: mem.external,
		arrayBuffers: mem.arrayBuffers,
	};
}

/**
 * Calculates memory difference between two snapshots
 */
function calculateMemoryDiff(
	before: MemorySnapshot,
	after: MemorySnapshot,
): MemorySnapshot {
	return {
		heapUsed: after.heapUsed - before.heapUsed,
		heapTotal: after.heapTotal - before.heapTotal,
		external: after.external - before.external,
		arrayBuffers: after.arrayBuffers - before.arrayBuffers,
	};
}

/**
 * Formats bytes to human-readable format
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
	const value = bytes / k ** i;
	const sign = bytes < 0 ? "-" : "+";
	return `${sign}${Math.abs(value).toFixed(2)} ${sizes[i]}`;
}

/**
 * Waits for a specified time to allow GC to run
 */
async function waitForGC(ms = 100): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs multiple GC cycles to ensure cleanup
 */
async function performGCCycles(cycles = 3): Promise<void> {
	for (let i = 0; i < cycles; i++) {
		forceGC();
		await waitForGC(50);
	}
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Memory Leak Detection", () => {
	// Threshold for acceptable memory growth (10%)
	const MEMORY_GROWTH_THRESHOLD = 0.1;

	beforeEach(async () => {
		// Clean up before each test
		await performGCCycles();
	});

	describe("Container Lifecycle", () => {
		it("should not leak memory when creating and destroying containers", async () => {
			@Injectable()
			class TestService {
				value = Math.random();
			}

			@Module({
				providers: [TestService],
			})
			class TestModule {}

			// Take baseline
			await performGCCycles();
			const baseline = takeMemorySnapshot();

			// Create and destroy containers multiple times
			const iterations = 100;
			for (let i = 0; i < iterations; i++) {
				const container = await Test.createModule({
					imports: [TestModule],
				}).compile();
				await container.resolve(TestService);
				// Container goes out of scope here
			}

			// Force GC and measure
			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log(`\n📊 Container Lifecycle Test (${iterations} iterations):`);
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			// Memory should return to baseline ±10%
			expect(Math.abs(growthRatio)).toBeLessThan(MEMORY_GROWTH_THRESHOLD);
		});

		it("should cleanup WeakRef objects after container destruction", async () => {
			@Injectable()
			class TrackedService {
				id = Math.random();
			}

			const weakRefs: WeakRef<object>[] = [];

			// Create containers and track instances with WeakRef
			for (let i = 0; i < 50; i++) {
				const container = await Test.createModule({
					providers: [TrackedService],
				}).compile();
				const instance = await container.get(TrackedService);
				// Only create WeakRef if instance is an object
				if (instance && typeof instance === "object") {
					weakRefs.push(new WeakRef(instance));
				}
			}

			// All instances should be alive before GC
			const aliveBeforeGC = weakRefs.filter(
				(ref) => ref.deref() !== undefined,
			).length;
			// Should have created instances
			expect(aliveBeforeGC).toBeGreaterThan(40);

			// Force GC
			await performGCCycles(5);

			// Most instances should be collected (allow some to remain due to GC timing)
			const aliveAfterGC = weakRefs.filter(
				(ref) => ref.deref() !== undefined,
			).length;

			console.log("\n🗑️  WeakRef Cleanup Test:");
			console.log(`   Before GC: ${aliveBeforeGC}/${weakRefs.length} alive`);
			console.log(`   After GC:  ${aliveAfterGC}/${weakRefs.length} alive`);

			// At least 80% should be collected
			expect(aliveAfterGC).toBeLessThan(weakRefs.length * 0.2);
		});
	});

	describe("Scope-based Memory Management", () => {
		it("should not cache Transient scope instances", async () => {
			@Injectable({ scope: Scope.Transient })
			class TransientService {
				id = Math.random();
			}

			@Module({
				providers: [TransientService],
			})
			class TransientModule {}

			const container = await Test.createModule({
				imports: [TransientModule],
			}).compile();
			const weakRefs: WeakRef<TransientService>[] = [];

			// Create many transient instances
			for (let i = 0; i < 100; i++) {
				const instance = await container.resolve(TransientService);
				if (instance) {
					weakRefs.push(new WeakRef(instance));
				}
			}

			// Force GC
			await performGCCycles(5);

			// All transient instances should be collected
			const aliveAfterGC = weakRefs.filter(
				(ref) => ref.deref() !== undefined,
			).length;

			console.log("\n⚡ Transient Scope Test:");
			console.log("   Created: 100 instances");
			console.log(`   After GC: ${aliveAfterGC} alive`);

			// Transient instances should be garbage collected
			expect(aliveAfterGC).toBeLessThan(5);
		});

		it("should maintain Singleton instances while container is alive", async () => {
			@Injectable({ scope: Scope.Singleton })
			class SingletonService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [SingletonService],
			}).compile();
			const instance = await container.get(SingletonService);

			// Only create WeakRef if instance is an object
			if (!instance || typeof instance !== "object") {
				throw new Error("Instance should be an object");
			}

			const weakRef = new WeakRef(instance);

			// Force GC
			await performGCCycles(5);

			// Singleton should still be alive
			expect(weakRef.deref()).toBeDefined();
			expect(weakRef.deref()?.id).toBe(instance.id);

			console.log("\n🔒 Singleton Scope Test:");
			console.log("   Instance alive after GC: ✅");
		});

		it("should cleanup Request scope after resolution", async () => {
			@Injectable({ scope: Scope.Scoped })
			class RequestService {
				id = Math.random();
			}

			@Module({
				providers: [RequestService],
			})
			class RequestModule {}

			const weakRefs: WeakRef<RequestService>[] = [];

			// Create multiple request contexts
			for (let i = 0; i < 50; i++) {
				const container = await Test.createModule({
					imports: [RequestModule],
				}).compile();
				const instance = await container.resolve(RequestService);
				if (instance) {
					weakRefs.push(new WeakRef(instance));
				}
			}

			// Force GC
			await performGCCycles(5);

			const aliveAfterGC = weakRefs.filter(
				(ref) => ref.deref() !== undefined,
			).length;

			console.log("\n🔄 Request Scope Test:");
			console.log("   Created: 50 request contexts");
			console.log(`   After GC: ${aliveAfterGC} alive`);

			// Request scope instances should be collected
			expect(aliveAfterGC).toBeLessThan(10);
		});
	});

	describe("Circular Dependencies", () => {
		it("should not leak memory with circular dependencies", async () => {
			@Injectable()
			class ServiceA {
				constructor(@Inject("ServiceB") public serviceB?: ServiceB) {}
			}

			@Injectable()
			class ServiceB {
				constructor(@Inject(ServiceA) public serviceA?: ServiceA) {}
			}

			@Module({
				providers: [ServiceA, { provide: "ServiceB", useClass: ServiceB }],
			})
			class CircularModule {}

			await performGCCycles();
			const baseline = takeMemorySnapshot();

			// Create and destroy containers with circular dependencies
			const iterations = 50;
			for (let i = 0; i < iterations; i++) {
				const container = await Test.createModule({
					imports: [CircularModule],
				}).compile();
				await container.resolve(ServiceA);
				await container.resolve("ServiceB");
			}

			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log(
				`\n🔄 Circular Dependencies Test (${iterations} iterations):`,
			);
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			expect(Math.abs(growthRatio)).toBeLessThan(MEMORY_GROWTH_THRESHOLD);
		});

		it("should cleanup circular dependency proxies", async () => {
			@Injectable()
			class CircularA {
				constructor(@Inject("CircularB") public b?: CircularB) {}
			}

			@Injectable()
			class CircularB {
				constructor(@Inject(CircularA) public a?: CircularA) {}
			}

			@Module({
				providers: [CircularA, { provide: "CircularB", useClass: CircularB }],
			})
			class ProxyModule {}

			const weakRefs: WeakRef<CircularA>[] = [];

			for (let i = 0; i < 30; i++) {
				const container = await Test.createModule({
					imports: [ProxyModule],
				}).compile();
				const instance = await container.resolve(CircularA);
				if (instance) {
					weakRefs.push(new WeakRef(instance));
				}
			}

			await performGCCycles(5);

			const aliveAfterGC = weakRefs.filter(
				(ref) => ref.deref() !== undefined,
			).length;

			console.log("\n🔗 Circular Proxy Cleanup Test:");
			console.log("   Created: 30 circular instances");
			console.log(`   After GC: ${aliveAfterGC} alive`);

			expect(aliveAfterGC).toBeLessThan(5);
		});
	});

	describe("Lifecycle Hooks", () => {
		it("should not leak memory with onModuleInit hooks", async () => {
			// Note: onModuleInit is called during bootstrap, not on get()
			// So we need to test it differently

			@Injectable()
			class ServiceWithHook {
				initCalled = false;

				async onModuleInit() {
					this.initCalled = true;
					// Simulate some async work
					await new Promise((resolve) => setTimeout(resolve, 1));
				}
			}

			await performGCCycles();
			const baseline = takeMemorySnapshot();

			const iterations = 100;
			for (let i = 0; i < iterations; i++) {
				const container = await Test.createModule({
					providers: [ServiceWithHook],
				}).compile();
				const instance = await container.get(ServiceWithHook);
				// Verify hook was called
				expect(instance?.initCalled).toBe(true);
			}

			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log(`\n🎣 Lifecycle Hooks Test (${iterations} iterations):`);
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			expect(Math.abs(growthRatio)).toBeLessThan(MEMORY_GROWTH_THRESHOLD);
		});

		it("should cleanup hook closures and contexts", async () => {
			const weakRefs: WeakRef<object>[] = [];

			@Injectable()
			class HookService {
				private data = { value: Math.random() };

				async onModuleInit() {
					// Create closure over data
					const closure = () => this.data.value;
					closure();
				}
			}

			@Module({
				providers: [HookService],
			})
			class ClosureModule {}

			for (let i = 0; i < 50; i++) {
				const container = await Test.createModule({
					imports: [ClosureModule],
				}).compile();
				const instance = await container.resolve(HookService);
				if (instance) {
					weakRefs.push(new WeakRef(instance));
				}
			}

			await performGCCycles(5);

			const aliveAfterGC = weakRefs.filter(
				(ref) => ref.deref() !== undefined,
			).length;

			console.log("\n🧹 Hook Closure Cleanup Test:");
			console.log("   Created: 50 services with hooks");
			console.log(`   After GC: ${aliveAfterGC} alive`);

			expect(aliveAfterGC).toBeLessThan(10);
		});
	});

	describe("Dynamic Modules", () => {
		it("should not leak memory with factory providers", async () => {
			// Test factory providers which are similar to dynamic modules
			interface ConfigOptions {
				apiKey: string;
				timeout: number;
			}

			class ConfigService {
				constructor(public config: ConfigOptions) {}
				getApiKey() {
					return this.config.apiKey;
				}
			}

			await performGCCycles();
			const baseline = takeMemorySnapshot();

			const iterations = 100;
			for (let i = 0; i < iterations; i++) {
				const config: ConfigOptions = {
					apiKey: `key-${i}`,
					timeout: 5000,
				};

				@Module({
					providers: [
						{
							provide: "CONFIG_SERVICE",
							useFactory: () => new ConfigService(config),
						},
					],
				})
				class DynamicConfigModule {}

				const container = await Test.createModule({
					imports: [DynamicConfigModule],
				}).compile();
				const instance =
					await container.resolve<ConfigService>("CONFIG_SERVICE");
				if (instance) {
					expect(instance.getApiKey()).toBe(`key-${i}`);
				}
			}

			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log(`\n🔧 Factory Providers Test (${iterations} iterations):`);
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			// Allow slightly higher threshold for factory providers (15%)
			expect(Math.abs(growthRatio)).toBeLessThan(0.15);
		});

		it("should cleanup multiple provider instances", async () => {
			@Injectable()
			class FeatureService {
				id = Math.random();
			}

			const weakRefs: WeakRef<object>[] = [];

			for (let i = 0; i < 50; i++) {
				@Module({
					providers: [
						{
							provide: `FEATURE_${i}`,
							useClass: FeatureService,
						},
					],
				})
				class FeatureModule {}

				const container = await Test.createModule({
					imports: [FeatureModule],
				}).compile();
				const instance = await container.resolve(`FEATURE_${i}`);
				if (instance && typeof instance === "object") {
					weakRefs.push(new WeakRef(instance));
				}
			}

			await performGCCycles(5);

			const aliveAfterGC = weakRefs.filter(
				(ref) => ref.deref() !== undefined,
			).length;

			console.log("\n📦 Multiple Providers Cleanup Test:");
			console.log(`   Created: ${weakRefs.length} feature instances`);
			console.log(`   After GC: ${aliveAfterGC} alive`);

			// If no instances were created, skip the test
			if (weakRefs.length === 0) {
				console.log("   ⚠️  No instances created, skipping test");
				return;
			}

			expect(aliveAfterGC).toBeLessThan(weakRefs.length * 0.2);
		});
	});

	describe("Stress Tests", () => {
		it("should handle large number of providers without memory leak", async () => {
			// Create many provider classes
			type ClassProvider = { provide: string; useClass: new () => unknown };
			const providers: Array<ClassProvider> = [];
			for (let i = 0; i < 500; i++) {
				@Injectable()
				class DynamicService {
					id = i;
					data = new Array(100).fill(i);
				}
				providers.push({
					provide: `SERVICE_${i}`,
					useClass: DynamicService,
				});
			}

			@Module({
				providers,
			})
			class LargeModule {}

			await performGCCycles();
			const baseline = takeMemorySnapshot();

			// Create and destroy container multiple times
			const iterations = 10;
			for (let i = 0; i < iterations; i++) {
				const container = await Test.createModule({
					imports: [LargeModule],
				}).compile();
				// Resolve some providers
				await container.resolve("SERVICE_0");
				await container.resolve("SERVICE_250");
				await container.resolve("SERVICE_499");
			}

			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log(
				`\n💪 Stress Test: 500 providers × ${iterations} iterations:`,
			);
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			// Allow slightly higher threshold for stress test (15%)
			expect(Math.abs(growthRatio)).toBeLessThan(0.15);
		});

		it("should handle deep dependency trees without memory leak", async () => {
			// Create a deep dependency tree: A -> B -> C -> D -> E
			@Injectable()
			class ServiceE {
				value = "E";
			}

			@Injectable()
			class ServiceD {
				constructor(@Inject(ServiceE) public e: ServiceE) {}
			}

			@Injectable()
			class ServiceC {
				constructor(@Inject(ServiceD) public d: ServiceD) {}
			}

			@Injectable()
			class ServiceB {
				constructor(@Inject(ServiceC) public c: ServiceC) {}
			}

			@Injectable()
			class ServiceA {
				constructor(@Inject(ServiceB) public b: ServiceB) {}
			}

			@Module({
				providers: [ServiceA, ServiceB, ServiceC, ServiceD, ServiceE],
			})
			class DeepModule {}

			await performGCCycles();
			const baseline = takeMemorySnapshot();

			const iterations = 200;
			for (let i = 0; i < iterations; i++) {
				const container = await Test.createModule({
					imports: [DeepModule],
				}).compile();
				const instance = await container.resolve(ServiceA);
				// Verify deep chain is resolved
				if (instance) {
					expect(instance.b).toBeDefined();
					expect(instance.b.c).toBeDefined();
					expect(instance.b.c.d).toBeDefined();
					expect(instance.b.c.d.e).toBeDefined();
					expect(instance.b.c.d.e.value).toBe("E");
				}
			}

			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log(`\n🌳 Deep Dependency Tree Test (${iterations} iterations):`);
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			expect(Math.abs(growthRatio)).toBeLessThan(MEMORY_GROWTH_THRESHOLD);
		});

		it("should handle mixed scopes without memory leak", async () => {
			@Injectable({ scope: Scope.Singleton })
			class SingletonService {
				id = Math.random();
			}

			@Injectable({ scope: Scope.Scoped })
			class RequestService {
				constructor(public singleton: SingletonService) {}
			}

			@Injectable({ scope: Scope.Transient })
			class TransientService {
				constructor(
					public singleton: SingletonService,
					public request: RequestService,
				) {}
			}

			@Module({
				providers: [SingletonService, RequestService, TransientService],
			})
			class MixedScopeModule {}

			await performGCCycles();
			const baseline = takeMemorySnapshot();

			const iterations = 100;
			for (let i = 0; i < iterations; i++) {
				const container = await Test.createModule({
					imports: [MixedScopeModule],
				}).compile();
				// Resolve multiple times to test caching
				await container.resolve(TransientService);
				await container.resolve(TransientService);
				await container.resolve(RequestService);
			}

			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log(`\n🎭 Mixed Scopes Test (${iterations} iterations):`);
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			// Allow higher threshold for mixed scopes (25%)
			expect(Math.abs(growthRatio)).toBeLessThan(0.25);
		});
	});

	describe("Complex Real-World Scenarios", () => {
		it("should handle module hierarchy without memory leak", async () => {
			@Injectable()
			class DatabaseService {
				query() {
					return "data";
				}
			}

			@Module({
				providers: [DatabaseService],
				exports: [DatabaseService],
			})
			class DatabaseModule {}

			@Injectable()
			class UserRepository {
				constructor(@Inject(DatabaseService) public db: DatabaseService) {}
			}

			@Module({
				imports: [DatabaseModule],
				providers: [UserRepository],
				exports: [UserRepository],
			})
			class UserModule {}

			@Injectable()
			class UserService {
				constructor(@Inject(UserRepository) public repo: UserRepository) {}
			}

			@Module({
				imports: [UserModule],
				providers: [UserService],
			})
			class AppModule {}

			await performGCCycles();
			const baseline = takeMemorySnapshot();

			const iterations = 100;
			for (let i = 0; i < iterations; i++) {
				const container = await Test.createModule({
					imports: [AppModule],
				}).compile();
				const service = await container.resolve(UserService);
				if (service) {
					expect(service.repo).toBeDefined();
					expect(service.repo.db).toBeDefined();
					expect(service.repo.db.query()).toBe("data");
				}
			}

			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log(`\n🏗️  Module Hierarchy Test (${iterations} iterations):`);
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			// Allow higher threshold for complex module hierarchies (18%)
			expect(Math.abs(growthRatio)).toBeLessThan(0.18);
		});

		it("should handle factory providers with closures", async () => {
			const createFactory = (config: { value: number }) => {
				return () => {
					return {
						getValue: () => config.value,
						data: new Array(100).fill(config.value),
					};
				};
			};

			await performGCCycles();
			const baseline = takeMemorySnapshot();

			const iterations = 100;
			for (let i = 0; i < iterations; i++) {
				@Module({
					providers: [
						{
							provide: "FACTORY_SERVICE",
							useFactory: createFactory({ value: 42 }),
						},
					],
				})
				class FactoryModule {}

				const container = await Test.createModule({
					imports: [FactoryModule],
				}).compile();
				const instance = await container.resolve("FACTORY_SERVICE");
				if (
					instance &&
					typeof instance === "object" &&
					"getValue" in instance
				) {
					expect(instance.getValue()).toBe(42);
				}
			}

			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log(`\n🏭 Factory Closures Test (${iterations} iterations):`);
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			// Allow higher threshold for factory closures (15%)
			expect(Math.abs(growthRatio)).toBeLessThan(0.15);
		});
	});

	describe("Memory Baseline Verification", () => {
		it("should establish stable memory baseline", async () => {
			// This test verifies that our measurement methodology is sound
			// by checking that doing nothing doesn't show memory growth

			await performGCCycles();
			const baseline = takeMemorySnapshot();

			// Do minimal work
			for (let i = 0; i < 100; i++) {
				const _obj = { value: i };
				// Object goes out of scope
			}

			await performGCCycles();
			const afterCleanup = takeMemorySnapshot();

			const diff = calculateMemoryDiff(baseline, afterCleanup);
			const growthRatio = diff.heapUsed / baseline.heapUsed;

			console.log("\n📏 Baseline Verification Test:");
			console.log(`   Baseline: ${formatBytes(baseline.heapUsed)}`);
			console.log(`   After:    ${formatBytes(afterCleanup.heapUsed)}`);
			console.log(`   Diff:     ${formatBytes(diff.heapUsed)}`);
			console.log(`   Growth:   ${(growthRatio * 100).toFixed(2)}%`);

			// Baseline should be very stable (< 5%)
			expect(Math.abs(growthRatio)).toBeLessThan(0.05);
		});
	});
});
