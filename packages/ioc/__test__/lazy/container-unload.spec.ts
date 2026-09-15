import "reflect-metadata";
import { Injectable, lazy, Module } from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

describe("Container.unload", () => {
	async function ready() {
		const container = new Container(new HashUtil());
		@Module({})
		class AppModule {}
		await container.run(AppModule);
		return container;
	}

	it("destroys a loaded segment's singletons and lets a later load recreate them", async () => {
		const destroyed = vi.fn();
		@Injectable()
		class FeatureService {
			onModuleDestroy() {
				destroyed();
			}
		}
		@Module({ providers: [FeatureService], exports: [FeatureService] })
		class FeatureModule {}

		const container = await ready();
		const FeatureLazy = lazy(async () => FeatureModule);
		await container.load(FeatureLazy);
		const instance = await container.get(FeatureService);
		expect(instance).toBeInstanceOf(FeatureService);

		const result = await container.unload(FeatureLazy);

		expect(result.destroyedProviders).toEqual([FeatureService]);
		expect(destroyed).toHaveBeenCalledTimes(1);
		expect(await container.get(FeatureService)).toBeUndefined();

		await container.load(FeatureLazy);
		const recreated = await container.get(FeatureService);
		expect(recreated).toBeInstanceOf(FeatureService);
		expect(recreated).not.toBe(instance);
	});

	it("is a no-op for a ref that was never loaded", async () => {
		@Module({})
		class NeverLoaded {}
		const NeverLoadedLazy = lazy(async () => NeverLoaded);
		const container = await ready();

		await expect(container.unload(NeverLoadedLazy)).resolves.toEqual({
			destroyedModules: [],
			destroyedProviders: [],
		});
	});

	it("does not touch a nested lazy module loaded from inside the segment being unloaded", async () => {
		@Injectable()
		class NestedService {}
		@Module({ providers: [NestedService], exports: [NestedService] })
		class NestedModule {}
		const NestedLazy = lazy(async () => NestedModule, { name: "Nested" });

		@Module({ imports: [NestedLazy] })
		class OuterModule {}
		const OuterLazy = lazy(async () => OuterModule, { name: "Outer" });

		const container = await ready();
		await container.load(OuterLazy);
		await container.load(NestedLazy);
		expect(await container.get(NestedService)).toBeInstanceOf(NestedService);

		await container.unload(OuterLazy);

		expect(await container.get(NestedService)).toBeInstanceOf(NestedService);
	});

	it("waits for an in-flight load of the same ref before unloading it", async () => {
		@Injectable()
		class FeatureService {}
		@Module({ providers: [FeatureService], exports: [FeatureService] })
		class FeatureModule {}
		const FeatureLazy = lazy(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return FeatureModule;
		});

		const container = await ready();
		const loadPromise = container.load(FeatureLazy);
		const unloadPromise = container.unload(FeatureLazy);

		await expect(loadPromise).resolves.toBeDefined();
		await expect(unloadPromise).resolves.toBeDefined();
		expect(await container.get(FeatureService)).toBeUndefined();
	});
});
