import "reflect-metadata";
import {
	BootstrapError,
	Inject,
	Injectable,
	Module,
	NexusApplication,
} from "../../src";

describe("Bootstrap Errors", () => {
	it("should throw BootstrapError when there are graph errors", async () => {
		@Injectable()
		class ServiceA {
			constructor(@Inject("MISSING_DEP") _dep: unknown) {}
		}

		@Module({ providers: [ServiceA] })
		class BrokenModule {}

		await expect(
			NexusApplication.create(BrokenModule).bootstrap(),
		).rejects.toThrow("Application bootstrap failed");
	});

	it("should not throw when throwOnError is false", async () => {
		@Injectable()
		class ServiceA {
			constructor(@Inject("MISSING_DEP") _dep: unknown) {}
		}

		@Module({ providers: [ServiceA] })
		class BrokenModule {}

		const app = await NexusApplication.create(BrokenModule).bootstrap({
			throwOnError: false,
		});

		expect(app.errors.length).toBeGreaterThan(0);
	});

	it("should expose errors array on BootstrapError", async () => {
		@Injectable()
		class ServiceA {
			constructor(@Inject("MISSING_DEP") _dep: unknown) {}
		}

		@Module({ providers: [ServiceA] })
		class BrokenModule {}

		let caught: unknown;
		try {
			await NexusApplication.create(BrokenModule).bootstrap();
		} catch (e) {
			caught = e;
		}

		expect(caught).toBeInstanceOf(BootstrapError);
		expect((caught as BootstrapError).errors).toBeInstanceOf(Array);
		expect((caught as BootstrapError).errors.length).toBeGreaterThan(0);
	});

	it("should not throw when there are no errors", async () => {
		@Injectable()
		class GoodService {}

		@Module({ providers: [GoodService] })
		class GoodModule {}

		await expect(
			NexusApplication.create(GoodModule).bootstrap(),
		).resolves.toBeDefined();
	});
});
