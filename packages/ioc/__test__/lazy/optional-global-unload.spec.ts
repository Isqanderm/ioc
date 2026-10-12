import "reflect-metadata";
import {
	Global,
	Inject,
	Injectable,
	lazy,
	Module,
	Optional,
	Scope,
} from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

/**
 * An eager consumer with a static `@Optional() @Inject(X)` edge, where `X`
 * only appears later through a lazily loaded `@Global()` module. Once the
 * segment is loaded the edge resolves to `X`, so it must keep `X`'s module
 * alive like any other resolved static edge.
 */
describe("static @Optional edge to a later-loaded @Global provider", () => {
	function globalSegment() {
		const destroyed = vi.fn();
		@Injectable()
		class GSvc {
			onModuleDestroy() {
				destroyed();
			}
		}
		@Global()
		@Module({ providers: [GSvc], exports: [GSvc] })
		class GModule {}
		const ref = lazy(async () => GModule, { name: "G" });
		return { GSvc, ref, destroyed };
	}

	it("keeps the global module alive for a constructor consumer created after the load", async () => {
		const { GSvc, ref, destroyed } = globalSegment();
		@Injectable({ scope: Scope.Transient })
		class Consumer {
			constructor(
				@Optional() @Inject(GSvc) readonly x?: InstanceType<typeof GSvc>,
			) {}
		}
		@Module({ providers: [Consumer] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		await container.load(ref);
		const consumer = await container.resolve(Consumer);
		expect(consumer.x).toBeInstanceOf(GSvc);

		const result = await container.unload(ref);
		expect(result.destroyedProviders).toEqual([]);
		expect(destroyed).not.toHaveBeenCalled();
		expect(container.graph.getNode(GSvc)).toBeDefined();
		expect(await container.resolve(GSvc)).toBe(consumer.x);
	});

	it("pins the global module even when nothing created after the load holds it (compile-time referrer)", async () => {
		const { GSvc, ref, destroyed } = globalSegment();
		@Injectable({ scope: Scope.Transient })
		class Consumer {
			constructor(
				@Optional() @Inject(GSvc) readonly x?: InstanceType<typeof GSvc>,
			) {}
		}
		@Module({ providers: [Consumer] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		await container.load(ref);

		const result = await container.unload(ref);
		expect(result.destroyedModules).toEqual([]);
		expect(result.destroyedProviders).toEqual([]);
		expect(destroyed).not.toHaveBeenCalled();
		expect(container.graph.getNode(GSvc)).toBeDefined();
	});

	it("changes nothing while the optional dependency stays missing", async () => {
		@Injectable()
		class Missing {}
		@Injectable()
		class Consumer {
			constructor(@Optional() @Inject(Missing) readonly x?: Missing) {}
		}
		@Module({ providers: [Consumer] })
		class AppModule {}

		// An unrelated global segment must not be pinned by the edge.
		const { GSvc, ref, destroyed } = globalSegment();

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		const consumer = await container.resolve(Consumer);
		expect(consumer.x).toBeUndefined();

		await container.load(ref);
		await container.resolve(GSvc);
		const result = await container.unload(ref);
		expect(result.destroyedProviders).toEqual([GSvc]);
		expect(destroyed).toHaveBeenCalledTimes(1);
		expect(container.graph.getNode(GSvc)).toBeUndefined();
	});

	it("keeps the global module alive for a property consumer created after the load", async () => {
		const { GSvc, ref, destroyed } = globalSegment();
		@Injectable({ scope: Scope.Transient })
		class Consumer {
			@Optional()
			@Inject(GSvc)
			readonly x?: InstanceType<typeof GSvc>;
		}
		@Module({ providers: [Consumer] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		await container.load(ref);
		const consumer = await container.resolve(Consumer);
		expect(consumer.x).toBeInstanceOf(GSvc);

		const result = await container.unload(ref);
		expect(result.destroyedProviders).toEqual([]);
		expect(destroyed).not.toHaveBeenCalled();
		expect(await container.resolve(GSvc)).toBe(consumer.x);
	});

	it("drops the referrer when the consumer's segment unloads first", async () => {
		const { GSvc, ref, destroyed } = globalSegment();
		@Injectable({ scope: Scope.Transient })
		class Consumer {
			constructor(
				@Optional() @Inject(GSvc) readonly x?: InstanceType<typeof GSvc>,
			) {}
		}
		@Module({ providers: [Consumer] })
		class FeatureModule {}
		@Module({})
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		const feature = lazy(async () => FeatureModule, { name: "F" });
		await container.load(feature);
		await container.load(ref);
		const consumer = await container.resolve(Consumer);
		expect(consumer.x).toBeInstanceOf(GSvc);

		await container.unload(feature);
		expect(destroyed).not.toHaveBeenCalled();

		const result = await container.unload(ref);
		expect(result.destroyedProviders).toEqual([GSvc]);
		expect(destroyed).toHaveBeenCalledTimes(1);
	});

	it("P1: does not inject a later-loaded provider the consumer cannot see", async () => {
		const destroyed = vi.fn();
		@Injectable()
		class X {
			onModuleDestroy() {
				destroyed();
			}
		}
		@Module({ providers: [X] })
		class Hidden {}
		@Injectable({ scope: Scope.Transient })
		class Consumer {
			constructor(@Optional() @Inject(X) readonly x?: X) {}
		}
		@Module({ providers: [Consumer] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		const ref = lazy(async () => Hidden, { name: "L" });
		await container.load(ref);
		const consumer = await container.resolve(Consumer);
		expect(consumer.x).toBeUndefined();
		await container.resolve(X);

		const result = await container.unload(ref);
		expect(result.destroyedProviders).toEqual([X]);
		expect(destroyed).toHaveBeenCalledTimes(1);
	});

	it("P2: a global module re-exporting a module class exposes and pins its provider", async () => {
		const destroyed = vi.fn();
		@Injectable()
		class X {
			onModuleDestroy() {
				destroyed();
			}
		}
		@Module({ providers: [X], exports: [X] })
		class Inner {}
		@Global()
		@Module({ imports: [Inner], exports: [Inner] })
		class GModule {}
		@Injectable({ scope: Scope.Transient })
		class Consumer {
			@Optional()
			@Inject(X)
			readonly x?: X;
		}
		@Module({ providers: [Consumer] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		const ref = lazy(async () => GModule, { name: "G" });
		await container.load(ref);
		const consumer = await container.resolve(Consumer);
		expect(consumer.x).toBeInstanceOf(X);

		const result = await container.unload(ref);
		expect(result.destroyedProviders).not.toContain(X);
		expect(destroyed).not.toHaveBeenCalled();
		expect(await container.resolve(X)).toBe(consumer.x);
	});

	it("P2: isProviderVisible follows module-class re-exports of a global module", async () => {
		@Injectable()
		class X {}
		@Module({ providers: [X], exports: [X] })
		class Inner {}
		@Global()
		@Module({ imports: [Inner], exports: [Inner] })
		class GModule {}
		@Injectable()
		class Consumer {
			constructor(@Inject(X) readonly x: X) {}
		}
		@Module({ providers: [Consumer] })
		class Feature {}
		@Module({ imports: [GModule, Feature] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		expect(container.graph.errors).toEqual([]);
		const consumer = await container.resolve(Consumer);
		expect(consumer.x).toBeInstanceOf(X);
	});

	describe("P8: the outcome does not depend on load order", () => {
		async function scenario(
			order: "x-first" | "consumer-first",
			global: boolean,
		) {
			const destroyed = vi.fn();
			@Injectable()
			class X {
				onModuleDestroy() {
					destroyed();
				}
			}
			@Module({ providers: [X], exports: global ? [X] : [] })
			class XModule {}
			if (global) {
				Global()(XModule);
			}
			@Injectable({ scope: Scope.Transient })
			class Consumer {
				constructor(@Optional() @Inject(X) readonly x?: X) {}
			}
			@Module({ providers: [Consumer] })
			class ConsumerModule {}
			@Module({})
			class AppModule {}

			const container = new Container(new HashUtil());
			await container.run(AppModule);
			const xRef = lazy(async () => XModule, { name: "X" });
			const consumerRef = lazy(async () => ConsumerModule, { name: "C" });
			for (const ref of order === "x-first"
				? [xRef, consumerRef]
				: [consumerRef, xRef]) {
				await container.load(ref);
			}
			await container.resolve(X);
			const consumer = await container.resolve(Consumer);
			const result = await container.unload(xRef);
			return {
				gotX: consumer.x instanceof X,
				destroyedX: result.destroyedProviders.includes(X),
				destroyCalls: destroyed.mock.calls.length,
			};
		}

		it("non-global, not exported: never injected, unload destroys it", async () => {
			const a = await scenario("x-first", false);
			const b = await scenario("consumer-first", false);
			expect(a).toEqual(b);
			expect(a).toEqual({ gotX: false, destroyedX: true, destroyCalls: 1 });
		});

		it("global: injected and pinned in either order", async () => {
			const a = await scenario("x-first", true);
			const b = await scenario("consumer-first", true);
			expect(a).toEqual(b);
			expect(a).toEqual({ gotX: true, destroyedX: false, destroyCalls: 0 });
		});
	});

	it("keeps the late-bound index and referrers stable over reload cycles", async () => {
		@Injectable()
		class X {}
		@Module({ providers: [X] })
		class XModule {}
		@Injectable()
		class Y {}
		@Global()
		@Module({ providers: [Y], exports: [Y] })
		class YModule {}
		@Injectable({ scope: Scope.Transient })
		class LazyConsumer {
			constructor(
				@Optional() @Inject(X) readonly x?: X,
				@Optional() @Inject(Y) readonly y?: Y,
			) {}
		}
		@Module({ providers: [LazyConsumer] })
		class ConsumerModule {}
		@Injectable({ scope: Scope.Transient })
		class EagerConsumer {
			constructor(@Optional() @Inject(X) readonly x?: X) {}
		}
		@Module({ providers: [EagerConsumer] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		const internals = container.graph as unknown as {
			_lateBound: Map<unknown, Map<unknown, boolean>>;
			_moduleReferrers: Map<string, Set<string>>;
		};
		const size = () => ({
			lateBound: [...internals._lateBound.values()].reduce(
				(n, sources) => n + sources.size,
				0,
			),
			referrers: [...internals._moduleReferrers.values()].reduce(
				(n, referrers) => n + referrers.size,
				0,
			),
		});
		const before = size();
		expect(before.lateBound).toBe(1);

		const xRef = lazy(async () => XModule, { name: "X" });
		const yRef = lazy(async () => YModule, { name: "Y" });
		const consumerRef = lazy(async () => ConsumerModule, { name: "C" });
		for (let i = 0; i < 20; i++) {
			await container.load(consumerRef);
			await container.load(xRef);
			await container.load(yRef);
			const consumer = await container.resolve(LazyConsumer);
			expect(consumer.x).toBeUndefined();
			expect(consumer.y).toBeInstanceOf(Y);
			expect(size().lateBound).toBe(3);
			await container.unload(consumerRef);
			await container.unload(yRef);
			await container.unload(xRef);
			expect(container.graph.getNode(Y)).toBeUndefined();
			expect(size()).toEqual(before);
		}
	});

	it("leaves edges byte-identical for an app without optional dependencies", async () => {
		@Injectable()
		class Dep {}
		@Injectable()
		class Svc {
			@Inject(Dep) readonly prop!: Dep;
			constructor(@Inject(Dep) readonly dep: Dep) {}
		}
		@Module({ providers: [Dep, Svc] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		expect(JSON.stringify(container.graph.getEdge(Svc))).toBe(
			JSON.stringify([
				{
					type: "dependency",
					source: Svc,
					target: Dep,
					metadata: {
						unreached: false,
						isCircular: false,
						lazy: false,
						index: 0,
						inject: "constructor",
					},
				},
				{
					type: "dependency",
					source: Svc,
					target: Dep,
					metadata: {
						unreached: false,
						isCircular: false,
						key: "prop",
						inject: "property",
					},
				},
			]),
		);
		for (const edges of container.graph.getAllEdges()) {
			for (const edge of edges) {
				expect("lateBound" in edge.metadata).toBe(false);
			}
		}
	});
});
