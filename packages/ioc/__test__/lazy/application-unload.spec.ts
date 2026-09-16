import "reflect-metadata";
import { Injectable, lazy, Module, NexusApplication } from "../../src";

describe("NexusApplication.unload", () => {
	it("unloads a loaded ref and lets a later load recreate its singletons", async () => {
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

		const app = await NexusApplication.create(AppModule).bootstrap();
		const FeatureLazy = lazy(async () => FeatureModule);
		const ref = await app.load(FeatureLazy);
		expect(await ref.get(FeatureService)).toBeInstanceOf(FeatureService);

		await app.unload(ref);

		expect(destroyed).toHaveBeenCalledTimes(1);
		expect(await app.get(FeatureService)).toBeUndefined();

		const newRef = await app.load(FeatureLazy);
		expect(newRef).not.toBe(ref);
		expect(await newRef.get(FeatureService)).toBeInstanceOf(FeatureService);
	});
});
