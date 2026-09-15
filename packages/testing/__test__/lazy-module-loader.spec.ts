import "reflect-metadata";
import {
	Inject,
	Injectable,
	LazyModuleLoader,
	lazy,
	Module,
} from "@nexus-ioc/core";
import { Test } from "../src/core/testing-container";

describe("LazyModuleLoader under Test", () => {
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

	it("is injectable into a service under test", async () => {
		const testingModule = await Test.createModule({
			imports: [FraudLazy],
			providers: [OrdersService],
		}).compile();

		const orders = await testingModule.get<OrdersService>(OrdersService);

		expect(orders).toBeInstanceOf(OrdersService);
		expect(await orders?.check(50)).toBe("ok");
		expect(await orders?.check(500)).toBe("review");
	});

	it("loads a lazy module through Test.load()", async () => {
		const testingContainer = Test.createModule({ imports: [FraudLazy] });
		await testingContainer.compile();

		expect(await testingContainer.get(FraudService)).toBeUndefined();

		const ref = await testingContainer.load(FraudLazy);

		expect(ref.module).toBe(FraudModule);
		expect(await ref.get<FraudService>(FraudService)).toBeInstanceOf(
			FraudService,
		);
		expect(await testingContainer.get(FraudService)).toBeInstanceOf(
			FraudService,
		);
	});

	it("throws when load() is called before compile()", async () => {
		const testingContainer = Test.createModule({ imports: [FraudLazy] });

		await expect(testingContainer.load(FraudLazy)).rejects.toThrow();
	});
});
