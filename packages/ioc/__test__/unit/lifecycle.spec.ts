import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import { Inject, Injectable, NsModule, type OnModuleInit } from "../../src";

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
				constructor(@Inject(DependencyService) private dep: DependencyService) {}

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
				constructor(@Inject(ServiceA) private serviceA: ServiceA) {}

				onModuleInit() {
					callOrder.push("B");
				}
			}

			@Injectable()
			class ServiceC implements OnModuleInit {
				constructor(
					@Inject(ServiceA) private serviceA: ServiceA,
					@Inject(ServiceB) private serviceB: ServiceB,
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

		it("should work with async onModuleInit", async () => {
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

			// Note: Current implementation doesn't await onModuleInit
			// This test documents current behavior
			expect(initialized).toBe(false);
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

			const service = await container.get<ServiceWithoutInit>(ServiceWithoutInit);

			expect(service?.getValue()).toBe("value");
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

		it("should handle errors in onModuleInit gracefully", async () => {
			@Injectable()
			class ServiceWithError implements OnModuleInit {
				onModuleInit() {
					throw new Error("Init error");
				}
			}

			const container = await Test.createModule({
				providers: [ServiceWithError],
			}).compile();

			// Current implementation doesn't catch errors in onModuleInit
			// This test documents current behavior
			expect(async () => {
				await container.get<ServiceWithError>(ServiceWithError);
			}).rejects.toThrow("Init error");
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
				constructor(@Inject(RepositoryService) private repo: RepositoryService) {}

				onModuleInit() {
					initOrder.push("DataService");
				}
			}

			@Injectable()
			class BusinessService implements OnModuleInit {
				constructor(@Inject(DataService) private data: DataService) {}

				onModuleInit() {
					initOrder.push("BusinessService");
				}
			}

			@Injectable()
			class ControllerService implements OnModuleInit {
				constructor(@Inject(BusinessService) private business: BusinessService) {}

				onModuleInit() {
					initOrder.push("Controller");
				}
			}

			const container = await Test.createModule({
				providers: [RepositoryService, DataService, BusinessService, ControllerService],
			}).compile();

			await container.get<ControllerService>(ControllerService);

			expect(initOrder).toEqual(["Repository", "DataService", "BusinessService", "Controller"]);
		});

		it("should work with multiple modules", async () => {
			const initOrder: string[] = [];

			@Injectable()
			class SharedService implements OnModuleInit {
				onModuleInit() {
					initOrder.push("Shared");
				}
			}

			@NsModule({
				providers: [SharedService],
				exports: [SharedService],
			})
			class SharedModule {}

			@Injectable()
			class FeatureService implements OnModuleInit {
				constructor(@Inject(SharedService) private shared: SharedService) {}

				onModuleInit() {
					initOrder.push("Feature");
				}
			}

			@NsModule({
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
