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
});
