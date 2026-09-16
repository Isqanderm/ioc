import "reflect-metadata";
import { Injectable, lazy, Module } from "../../src";
import { ModuleRef } from "../../src/core/module-ref";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

describe("ModuleRef.unload", () => {
	@Injectable()
	class FeatureService {}
	@Module({ providers: [FeatureService], exports: [FeatureService] })
	class FeatureModule {}

	async function loadedRef() {
		const container = new Container(new HashUtil());
		@Module({})
		class AppModule {}
		await container.run(AppModule);
		const FeatureLazy = lazy(async () => FeatureModule);
		const segment = await container.load(FeatureLazy);
		return new ModuleRef(container, segment);
	}

	it("marks the ref unloaded and makes get() resolve to undefined", async () => {
		const ref = await loadedRef();
		expect(ref.loaded).toBe(true);
		expect(await ref.get(FeatureService)).toBeInstanceOf(FeatureService);

		const result = await ref.unload();

		expect(result.destroyedProviders).toEqual([FeatureService]);
		expect(ref.loaded).toBe(false);
		expect(await ref.get(FeatureService)).toBeUndefined();
		expect(await ref.get(FeatureService, { strict: false })).toBeUndefined();
	});

	it("is a no-op the second time", async () => {
		const ref = await loadedRef();
		await ref.unload();

		await expect(ref.unload()).resolves.toEqual({
			destroyedModules: [],
			destroyedProviders: [],
		});
	});
});
