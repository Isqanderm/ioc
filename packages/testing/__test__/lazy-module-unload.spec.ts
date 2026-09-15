import "reflect-metadata";
import { Injectable, lazy, Module } from "@nexus-ioc/core";
import { Test } from "../src";

describe("Test.unload", () => {
	it("unloads a segment loaded through Test.load", async () => {
		const destroyed = vi.fn();
		@Injectable()
		class FeatureService {
			onModuleDestroy() {
				destroyed();
			}
		}
		@Module({ providers: [FeatureService], exports: [FeatureService] })
		class FeatureModule {}
		@Module({})
		class AppModule {}

		const testContainer = Test.createModule(AppModule);
		await testContainer.compile();
		const FeatureLazy = lazy(async () => FeatureModule);
		const ref = await testContainer.load(FeatureLazy);
		expect(await ref.get(FeatureService)).toBeInstanceOf(FeatureService);

		const result = await testContainer.unload(ref);

		expect(result.destroyedProviders).toEqual([FeatureService]);
		expect(destroyed).toHaveBeenCalledTimes(1);
	});
});
