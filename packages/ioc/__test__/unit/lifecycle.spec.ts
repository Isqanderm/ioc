import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import {
	Inject,
	Injectable,
	Module,
	NexusApplication,
	type OnModuleDestroy,
	type OnModuleInit,
} from "../../src";

describe("Lifecycle Hooks", () => {
	describe("OnModuleInit", () => {
		it("should call onModuleInit when provider is created", async () => {
			const initSpy = vi.fn();

			@Injectable()
			class ServiceWithInit implements OnModuleInit {
				onModuleInit() {
					initSpy();
				}
			}

			const container = await Test.createModule({
				providers: [ServiceWithInit],
			}).compile();

			await container.get<ServiceWithInit>(ServiceWithInit);

			expect(initSpy).toHaveBeenCalledTimes(1);
		});

		it("should call onModuleInit only once for singleton", async () => {
			const initSpy = vi.fn();

			@Injectable()
			class SingletonService implements OnModuleInit {
				onModuleInit() {
					initSpy();
				}
			}

			const container = await Test.createModule({
				providers: [SingletonService],
			}).compile();

			await container.get<SingletonService>(SingletonService);
			await container.get<SingletonService>(SingletonService);
			await container.get<SingletonService>(SingletonService);

			expect(initSpy).toHaveBeenCalledTimes(1);
		});

		it("should have access to injected dependencies in onModuleInit", async () => {
			let capturedValue: string | undefined;

			@Injectable()
			class DependencyService {
				getValue() {
					return "dependency-value";
				}
			}

			@Injectable()
			class ServiceWithInit implements OnModuleInit {
				constructor(
					@Inject(DependencyService) private dep: DependencyService,
				) {}

				onModuleInit() {
					capturedValue = this.dep.getValue();
				}
			}

			const container = await Test.createModule({
				providers: [DependencyService, ServiceWithInit],
			}).compile();

			await container.get<ServiceWithInit>(ServiceWithInit);

			expect(capturedValue).toBe("dependency-value");
		});

		it("should call onModuleInit in dependency order", async () => {
			const callOrder: string[] = [];

			@Injectable()
			class ServiceA implements OnModuleInit {
				onModuleInit() {
					callOrder.push("A");
				}
			}

			@Injectable()
			class ServiceB implements OnModuleInit {
				constructor(@Inject(ServiceA) _serviceA: ServiceA) {}

				onModuleInit() {
					callOrder.push("B");
				}
			}

			@Injectable()
			class ServiceC implements OnModuleInit {
				constructor(
					@Inject(ServiceA) _serviceA: ServiceA,
					@Inject(ServiceB) _serviceB: ServiceB,
				) {}

				onModuleInit() {
					callOrder.push("C");
				}
			}

			const container = await Test.createModule({
				providers: [ServiceA, ServiceB, ServiceC],
			}).compile();

			await container.get<ServiceC>(ServiceC);

			expect(callOrder).toEqual(["A", "B", "C"]);
		});

		it("should await async onModuleInit", async () => {
			let initialized = false;

			@Injectable()
			class AsyncService implements OnModuleInit {
				async onModuleInit() {
					await new Promise((resolve) => setTimeout(resolve, 10));
					initialized = true;
				}
			}

			const container = await Test.createModule({
				providers: [AsyncService],
			}).compile();

			await container.get<AsyncService>(AsyncService);

			// onModuleInit should be awaited
			expect(initialized).toBe(true);
		});

		it("should work with property injection", async () => {
			let capturedValue: string | undefined;

			@Injectable()
			class DependencyService {
				getValue() {
					return "property-value";
				}
			}

			@Injectable()
			class ServiceWithPropertyInit implements OnModuleInit {
				@Inject(DependencyService)
				private dep!: DependencyService;

				onModuleInit() {
					capturedValue = this.dep.getValue();
				}
			}

			const container = await Test.createModule({
				providers: [DependencyService, ServiceWithPropertyInit],
			}).compile();

			await container.get<ServiceWithPropertyInit>(ServiceWithPropertyInit);

			expect(capturedValue).toBe("property-value");
		});

		it("should not fail if onModuleInit is not implemented", async () => {
			@Injectable()
			class ServiceWithoutInit {
				getValue() {
					return "value";
				}
			}

			const container = await Test.createModule({
				providers: [ServiceWithoutInit],
			}).compile();

			const service =
				await container.get<ServiceWithoutInit>(ServiceWithoutInit);

			expect(service?.getValue()).toBe("value");
		});

		it("should support async onModuleInit", async () => {
			const initSpy = vi.fn();

			@Injectable()
			class ServiceWithAsyncInit implements OnModuleInit {
				async onModuleInit() {
					await Promise.resolve();
					initSpy();
				}
			}

			const container = await Test.createModule({
				providers: [ServiceWithAsyncInit],
			}).compile();

			await container.get<ServiceWithAsyncInit>(ServiceWithAsyncInit);

			expect(initSpy).toHaveBeenCalledTimes(1);
		});

		it("should work with class providers", async () => {
			const initSpy = vi.fn();

			@Injectable()
			class ImplementationService implements OnModuleInit {
				onModuleInit() {
					initSpy();
				}
			}

			const container = await Test.createModule({
				providers: [
					{
						provide: "SERVICE",
						useClass: ImplementationService,
					},
				],
			}).compile();

			await container.get("SERVICE");

			expect(initSpy).toHaveBeenCalledTimes(1);
		});

		it("should handle errors in onModuleInit with context", async () => {
			@Injectable()
			class ServiceWithError implements OnModuleInit {
				onModuleInit() {
					throw new Error("Init error");
				}
			}

			const container = await Test.createModule({
				providers: [ServiceWithError],
			}).compile();

			// Errors in onModuleInit should be wrapped with provider context
			await expect(async () => {
				await container.get<ServiceWithError>(ServiceWithError);
			}).rejects.toThrow('Failed to initialize provider "ServiceWithError"');

			await expect(async () => {
				await container.get<ServiceWithError>(ServiceWithError);
			}).rejects.toThrow("Init error");
		});

		it("should handle async errors in onModuleInit", async () => {
			@Injectable()
			class ServiceWithAsyncError implements OnModuleInit {
				async onModuleInit() {
					await Promise.resolve();
					throw new Error("Async init error");
				}
			}

			const container = await Test.createModule({
				providers: [ServiceWithAsyncError],
			}).compile();

			await expect(async () => {
				await container.get<ServiceWithAsyncError>(ServiceWithAsyncError);
			}).rejects.toThrow(
				'Failed to initialize provider "ServiceWithAsyncError"',
			);

			await expect(async () => {
				await container.get<ServiceWithAsyncError>(ServiceWithAsyncError);
			}).rejects.toThrow("Async init error");
		});

		it("should work in complex dependency trees", async () => {
			const initOrder: string[] = [];

			@Injectable()
			class RepositoryService implements OnModuleInit {
				onModuleInit() {
					initOrder.push("Repository");
				}
			}

			@Injectable()
			class DataService implements OnModuleInit {
				constructor(@Inject(RepositoryService) _repo: RepositoryService) {}

				onModuleInit() {
					initOrder.push("DataService");
				}
			}

			@Injectable()
			class BusinessService implements OnModuleInit {
				constructor(@Inject(DataService) _data: DataService) {}

				onModuleInit() {
					initOrder.push("BusinessService");
				}
			}

			@Injectable()
			class ControllerService implements OnModuleInit {
				constructor(@Inject(BusinessService) _business: BusinessService) {}

				onModuleInit() {
					initOrder.push("Controller");
				}
			}

			const container = await Test.createModule({
				providers: [
					RepositoryService,
					DataService,
					BusinessService,
					ControllerService,
				],
			}).compile();

			await container.get<ControllerService>(ControllerService);

			expect(initOrder).toEqual([
				"Repository",
				"DataService",
				"BusinessService",
				"Controller",
			]);
		});

		it("should work with multiple modules", async () => {
			const initOrder: string[] = [];

			@Injectable()
			class SharedService implements OnModuleInit {
				onModuleInit() {
					initOrder.push("Shared");
				}
			}

			@Module({
				providers: [SharedService],
				exports: [SharedService],
			})
			class SharedModule {}

			@Injectable()
			class FeatureService implements OnModuleInit {
				constructor(@Inject(SharedService) _shared: SharedService) {}

				onModuleInit() {
					initOrder.push("Feature");
				}
			}

			@Module({
				imports: [SharedModule],
				providers: [FeatureService],
			})
			class FeatureModule {}

			const container = await Test.createModule({
				imports: [FeatureModule],
			}).compile();

			await container.get<FeatureService>(FeatureService);

			expect(initOrder).toEqual(["Shared", "Feature"]);
		});
	});
});

describe("OnModuleDestroy", () => {
	it("should call onModuleDestroy when app.close() is called", async () => {
		const destroySpy = vi.fn();

		@Injectable()
		class ServiceWithDestroy implements OnModuleDestroy {
			onModuleDestroy() {
				destroySpy();
			}
		}

		@Module({ providers: [ServiceWithDestroy] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();
		await app.get(ServiceWithDestroy); // ensure it's initialized
		await app.close();

		expect(destroySpy).toHaveBeenCalledTimes(1);
	});

	it("should call onModuleDestroy in reverse initialization order", async () => {
		const callOrder: string[] = [];

		@Injectable()
		class ServiceA {
			onModuleDestroy() {
				callOrder.push("A");
			}
		}

		@Injectable()
		class ServiceB {
			constructor(@Inject(ServiceA) _a: ServiceA) {}
			onModuleDestroy() {
				callOrder.push("B");
			}
		}

		@Module({ providers: [ServiceA, ServiceB] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();
		await app.close();

		// ServiceA initialized first (as dep of B), so destroyed last
		expect(callOrder).toEqual(["B", "A"]);
	});

	it("should not throw if provider has no onModuleDestroy", async () => {
		@Injectable()
		class SimpleService {}

		@Module({ providers: [SimpleService] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();
		await expect(app.close()).resolves.not.toThrow();
	});

	it("should call onModuleDestroy only for already-initialized singletons", async () => {
		const destroySpy = vi.fn();

		@Injectable()
		class LazyService {
			onModuleDestroy() {
				destroySpy();
			}
		}

		@Module({ providers: [LazyService] })
		class AppModule {}

		// Use async() to skip pre-instantiation
		const app = await NexusApplication.create(AppModule).lazy().bootstrap();
		// LazyService never resolved — onModuleDestroy should NOT be called
		await app.close();

		expect(destroySpy).not.toHaveBeenCalled();
	});
});
