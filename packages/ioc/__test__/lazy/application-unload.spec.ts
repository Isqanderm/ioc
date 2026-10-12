import "reflect-metadata";
import {
	Injectable,
	lazy,
	Module,
	NexusApplication,
	ProviderNotFoundError,
} from "../../src";

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
		expect(() => app.get(FeatureService)).toThrow(ProviderNotFoundError);

		const newRef = await app.load(FeatureLazy);
		expect(newRef).not.toBe(ref);
		expect(await newRef.get(FeatureService)).toBeInstanceOf(FeatureService);
	});

	it("a throwing onModuleDestroy still unloads the segment; a later load works", async () => {
		const boom = new Error("destroy boom");
		const destroyed: string[] = [];
		let failNextDestroy = true;
		@Injectable()
		class First {
			onModuleDestroy() {
				destroyed.push("First");
			}
		}
		@Injectable()
		class Failing {
			onModuleDestroy() {
				destroyed.push("Failing");
				if (failNextDestroy) {
					failNextDestroy = false;
					throw boom;
				}
			}
		}
		@Injectable()
		class Last {
			onModuleDestroy() {
				destroyed.push("Last");
			}
		}
		@Module({ providers: [First, Failing, Last], exports: [Last] })
		class FeatureModule {}
		@Module({})
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();
		const FeatureLazy = lazy(async () => FeatureModule);
		const ref = await app.load(FeatureLazy);

		const error = await app.unload(ref).catch((e) => e);

		// Every hook ran, in reverse creation order, despite the failure.
		expect(destroyed).toEqual(["Last", "Failing", "First"]);
		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toEqual([boom]);
		expect(ref.loaded).toBe(false);
		expect(() => app.get(Last)).toThrow(ProviderNotFoundError);

		const newRef = await app.load(FeatureLazy);
		expect(newRef).not.toBe(ref);
		expect(newRef.get(Last)).toBeInstanceOf(Last);
		expect(app.get(Last)).toBeInstanceOf(Last);

		await app.unload(newRef);
		expect(newRef.loaded).toBe(false);
		await app.close();
	});
});
