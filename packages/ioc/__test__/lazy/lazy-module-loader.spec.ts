import "reflect-metadata";
import {
	Inject,
	Injectable,
	LazyModuleLoader,
	lazy,
	Module,
	NexusApplication,
} from "../../src";

describe("LazyModuleLoader", () => {
	@Injectable()
	class FraudService {
		check(total: number) {
			return total > 100 ? "review" : "ok";
		}
	}
	@Module({ providers: [FraudService], exports: [FraudService] })
	class FraudModule {}
	const FraudLazy = lazy(async () => FraudModule, { name: "Fraud" });

	@Injectable()
	class OrdersService {
		constructor(
			@Inject(LazyModuleLoader) private readonly loader: LazyModuleLoader,
		) {}

		async check(total: number) {
			if (total <= 100) return "ok";
			const ref = await this.loader.load(FraudLazy);
			const fraud = await ref.get<FraudService>(FraudService);
			return fraud?.check(total);
		}
	}

	@Module({
		imports: [FraudLazy],
		providers: [OrdersService],
		exports: [OrdersService],
	})
	class OrdersModule {}

	it("is injectable into any module without importing anything", async () => {
		@Module({ imports: [OrdersModule] })
		class AppModule {}
		const app = await NexusApplication.create(AppModule).bootstrap();

		const orders = await app.get<OrdersService>(OrdersService);
		expect(orders).toBeDefined();
		expect(await orders?.check(50)).toBe("ok");
		expect(await app.get(FraudService)).toBeUndefined();
		expect(await orders?.check(500)).toBe("review");
		expect(await app.get(FraudService)).toBeInstanceOf(FraudService);
		await app.close();
	});

	it("is also resolvable from app.get()", async () => {
		@Module({})
		class AppModule {}
		const app = await NexusApplication.create(AppModule).bootstrap();
		const loader = await app.get<LazyModuleLoader>(LazyModuleLoader);
		expect(loader).toBeInstanceOf(LazyModuleLoader);
		const ref = await loader?.load(FraudLazy);
		expect(ref?.module).toBe(FraudModule);
		await app.close();
	});

	it("does not leak into the graph as a user module", async () => {
		@Module({})
		class AppModule {}
		const app = await NexusApplication.create(AppModule).bootstrap();
		expect(app.errors).toEqual([]);
		await app.close();
	});
});
