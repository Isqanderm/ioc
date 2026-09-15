import "reflect-metadata";
import {
	Inject,
	Injectable,
	LazyModuleLoader,
	lazy,
	Module,
	NexusApplication,
} from "../../src";

describe("LazyModuleLoader.unload", () => {
	it("unloads a ref obtained from LazyModuleLoader.load", async () => {
		const destroyed = vi.fn();
		@Injectable()
		class FeatureService {
			onModuleDestroy() {
				destroyed();
			}
		}
		@Module({ providers: [FeatureService], exports: [FeatureService] })
		class FeatureModule {}

		@Injectable()
		class OrdersService {
			constructor(
				@Inject(LazyModuleLoader) readonly loader: LazyModuleLoader,
			) {}
		}
		@Module({ providers: [OrdersService], exports: [OrdersService] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();
		const orders = await app.get<OrdersService>(OrdersService);
		const FeatureLazy = lazy(async () => FeatureModule);
		const ref = await orders?.loader.load(FeatureLazy);

		await orders?.loader.unload(ref as never);

		expect(destroyed).toHaveBeenCalledTimes(1);
		expect(await app.get(FeatureService)).toBeUndefined();
	});
});
