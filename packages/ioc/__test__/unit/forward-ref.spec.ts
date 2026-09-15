import "reflect-metadata";
import {
	BootstrapError,
	forwardRef,
	Inject,
	Injectable,
	Module,
	NexusApplication,
} from "../../src";

describe("forwardRef", () => {
	it("should resolve a circular dependency with forwardRef", async () => {
		@Injectable()
		class ServiceB {
			name = "B";
		}

		@Injectable()
		class ServiceA {
			name = "A";
			constructor(
				@Inject(forwardRef(() => ServiceB)) public readonly b: ServiceB,
			) {}
		}

		@Module({ providers: [ServiceA, ServiceB] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();
		const a = await app.get<ServiceA>(ServiceA);
		expect(a).toBeDefined();
		expect(a?.b).toBeDefined();
		expect(a?.b.name).toBe("B");
		await app.close();
	});

	it("should throw BootstrapError for cycle without forwardRef", async () => {
		@Injectable()
		class CycleA {
			constructor(@Inject("CycleB_token") _b: unknown) {}
		}

		@Injectable()
		class CycleB {
			constructor(@Inject(CycleA) _a: CycleA) {}
		}

		@Module({
			providers: [CycleA, { provide: "CycleB_token", useClass: CycleB }],
		})
		class CycleModule {}

		await expect(
			NexusApplication.create(CycleModule).bootstrap(),
		).rejects.toThrow(BootstrapError);
	});

	it("should not add CD_PROVIDERS error when forwardRef is used", async () => {
		@Injectable()
		class ServiceB {
			name = "B";
		}

		@Injectable()
		class ServiceA {
			constructor(
				@Inject(forwardRef(() => ServiceB)) public readonly b: ServiceB,
			) {}
		}

		@Module({ providers: [ServiceA, ServiceB] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap({
			throwOnError: false,
		});
		const cdErrors = app.errors.filter((e) => e.type === "CD_PROVIDERS");
		expect(cdErrors).toHaveLength(0);
		await app.close();
	});
});
