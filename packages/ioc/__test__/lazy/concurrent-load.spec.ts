import "reflect-metadata";
import {
	Inject,
	Injectable,
	LazyModuleGraphError,
	lazy,
	Module,
	NexusApplication,
} from "../../src";

describe("concurrent lazy loads", () => {
	@Injectable()
	class BrokenService {
		constructor(@Inject("MISSING") public readonly missing: unknown) {}
	}
	@Module({ providers: [BrokenService], exports: [BrokenService] })
	class BrokenModule {}

	@Injectable()
	class GoodService {}
	@Module({ providers: [GoodService], exports: [GoodService] })
	class GoodModule {}

	@Injectable()
	class AlphaService {}
	@Module({ providers: [AlphaService], exports: [AlphaService] })
	class AlphaModule {}

	@Injectable()
	class BetaService {}
	@Module({ providers: [BetaService], exports: [BetaService] })
	class BetaModule {}

	it("keeps a failing segment from corrupting a concurrent healthy one", async () => {
		const BrokenLazy = lazy(async () => BrokenModule, { name: "Broken" });
		const GoodLazy = lazy(async () => GoodModule, { name: "Good" });

		@Module({ imports: [BrokenLazy, GoodLazy] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();

		const [broken, good] = await Promise.allSettled([
			app.load(BrokenLazy),
			app.load(GoodLazy),
		]);

		expect(good.status).toBe("fulfilled");
		expect(broken.status).toBe("rejected");

		const reason = (broken as PromiseRejectedResult).reason;
		expect(reason).toBeInstanceOf(LazyModuleGraphError);
		expect(reason.message).toContain("MISSING");
		expect(reason.message).toContain("Broken");

		expect(app.errors).toEqual([]);
		expect(await app.get(GoodService)).toBeInstanceOf(GoodService);
		expect(await app.get(BrokenService)).toBeUndefined();

		await app.close();
	});

	it("loads two different valid refs concurrently, running each loader once", async () => {
		const alphaLoader = vi.fn(async () => AlphaModule);
		const betaLoader = vi.fn(async () => BetaModule);
		const AlphaLazy = lazy(alphaLoader, { name: "Alpha" });
		const BetaLazy = lazy(betaLoader, { name: "Beta" });

		@Module({ imports: [AlphaLazy, BetaLazy] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();

		const [alphaRef, betaRef] = await Promise.all([
			app.load(AlphaLazy),
			app.load(BetaLazy),
		]);

		expect(alphaLoader).toHaveBeenCalledTimes(1);
		expect(betaLoader).toHaveBeenCalledTimes(1);
		expect(alphaRef.module).toBe(AlphaModule);
		expect(betaRef.module).toBe(BetaModule);
		expect(app.errors).toEqual([]);
		expect(await alphaRef.get(AlphaService)).toBeInstanceOf(AlphaService);
		expect(await betaRef.get(BetaService)).toBeInstanceOf(BetaService);

		await app.close();
	});
});
