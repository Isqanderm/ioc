import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import { Injectable, Inject, NsModule, Scope } from "../../src";

describe("Providers", () => {
	describe("ClassProvider", () => {
		it("should resolve class provider with useClass", async () => {
			@Injectable()
			class OriginalService {
				getValue() {
					return "original";
				}
			}

			@Injectable()
			class AlternativeService {
				getValue() {
					return "alternative";
				}
			}

			const container = await Test.createModule({
				providers: [
					{
						provide: OriginalService,
						useClass: AlternativeService,
					},
				],
			}).compile();

			const service = await container.get<AlternativeService>(OriginalService);
			expect(service).toBeInstanceOf(AlternativeService);
			expect(service?.getValue()).toBe("alternative");
		});

		// TODO: Implement Transient scope
		it.skip("should support scope in class provider", async () => {
			@Injectable()
			class TransientService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [
					{
						provide: TransientService,
						useClass: TransientService,
						// scope: Scope.Transient, // Not implemented
					},
				],
			}).compile();

			const instance1 = await container.get<TransientService>(TransientService);
			const instance2 = await container.get<TransientService>(TransientService);

			// Transient scope should create new instances
			expect(instance1?.id).not.toBe(instance2?.id);
		});

		it("should inject dependencies into class provider", async () => {
			@Injectable()
			class DependencyService {
				getValue() {
					return "dependency";
				}
			}

			@Injectable()
			class ServiceWithDeps {
				constructor(
					@Inject(DependencyService) private dep: DependencyService,
				) {}

				getValue() {
					return this.dep.getValue();
				}
			}

			const container = await Test.createModule({
				providers: [
					DependencyService,
					{
						provide: "SERVICE",
						useClass: ServiceWithDeps,
					},
				],
			}).compile();

			const service = await container.get<ServiceWithDeps>("SERVICE");
			expect(service?.getValue()).toBe("dependency");
		});
	});

	describe("ValueProvider", () => {
		it("should resolve value provider", async () => {
			const configValue = { apiUrl: "https://api.example.com", timeout: 5000 };

			const container = await Test.createModule({
				providers: [
					{
						provide: "CONFIG",
						useValue: configValue,
					},
				],
			}).compile();

			const config = await container.get<typeof configValue>("CONFIG");
			expect(config).toEqual(configValue);
			expect(config).toBe(configValue); // Same reference
		});

		it("should support primitive values", async () => {
			const container = await Test.createModule({
				providers: [
					{ provide: "STRING_VALUE", useValue: "test" },
					{ provide: "NUMBER_VALUE", useValue: 42 },
					{ provide: "BOOLEAN_VALUE", useValue: true },
				],
			}).compile();

			const stringValue = await container.get<string>("STRING_VALUE");
			const numberValue = await container.get<number>("NUMBER_VALUE");
			const booleanValue = await container.get<boolean>("BOOLEAN_VALUE");

			expect(stringValue).toBe("test");
			expect(numberValue).toBe(42);
			expect(booleanValue).toBe(true);
		});

		// TODO: Fix null value provider support
		// Currently null values are not properly cached and returned as undefined
		it.skip("should support null and undefined values", async () => {
			const container = await Test.createModule({
				providers: [
					{ provide: "NULL_VALUE", useValue: null },
					{ provide: "UNDEFINED_VALUE", useValue: undefined },
				],
			}).compile();

			const nullValue = await container.get("NULL_VALUE");
			const undefinedValue = await container.get("UNDEFINED_VALUE");

			expect(nullValue).toBeNull();
			expect(undefinedValue).toBeUndefined();
		});

		it("should support array values", async () => {
			const arrayValue = [1, 2, 3, 4, 5];

			const container = await Test.createModule({
				providers: [
					{
						provide: "ARRAY_VALUE",
						useValue: arrayValue,
					},
				],
			}).compile();

			const value = await container.get<number[]>("ARRAY_VALUE");
			expect(value).toEqual(arrayValue);
		});
	});

	describe("FactoryProvider", () => {
		it("should resolve factory provider", async () => {
			const factory = () => ({ value: "from-factory" });

			const container = await Test.createModule({
				providers: [
					{
						provide: "FACTORY_SERVICE",
						useFactory: factory,
					},
				],
			}).compile();

			const service = await container.get<{ value: string }>("FACTORY_SERVICE");
			expect(service?.value).toBe("from-factory");
		});

		it("should inject dependencies into factory", async () => {
			@Injectable()
			class ConfigService {
				getApiUrl() {
					return "https://api.example.com";
				}
			}

			const factory = (config: ConfigService) => ({
				apiUrl: config.getApiUrl(),
				timeout: 5000,
			});

			const container = await Test.createModule({
				providers: [
					ConfigService,
					{
						provide: "HTTP_CLIENT",
						useFactory: factory,
						inject: [ConfigService],
					},
				],
			}).compile();

			const client = await container.get<{ apiUrl: string; timeout: number }>(
				"HTTP_CLIENT",
			);
			expect(client?.apiUrl).toBe("https://api.example.com");
			expect(client?.timeout).toBe(5000);
		});

		it("should support async factories", async () => {
			const asyncFactory = async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return { value: "async-result" };
			};

			const container = await Test.createModule({
				providers: [
					{
						provide: "ASYNC_SERVICE",
						useFactory: asyncFactory,
					},
				],
			}).compile();

			const service = await container.get<{ value: string }>("ASYNC_SERVICE");
			expect(service?.value).toBe("async-result");
		});

		it("should support factory with multiple dependencies", async () => {
			@Injectable()
			class ServiceA {
				getValue() {
					return "A";
				}
			}

			@Injectable()
			class ServiceB {
				getValue() {
					return "B";
				}
			}

			const factory = (a: ServiceA, b: ServiceB) => ({
				combined: `${a.getValue()}-${b.getValue()}`,
			});

			const container = await Test.createModule({
				providers: [
					ServiceA,
					ServiceB,
					{
						provide: "COMBINED_SERVICE",
						useFactory: factory,
						inject: [ServiceA, ServiceB],
					},
				],
			}).compile();

			const service = await container.get<{ combined: string }>(
				"COMBINED_SERVICE",
			);
			expect(service?.combined).toBe("A-B");
		});

		// TODO: Implement Transient scope
		it.skip("should support scope in factory provider", async () => {
			let counter = 0;
			const factory = () => ({ id: ++counter });

			const container = await Test.createModule({
				providers: [
					{
						provide: "TRANSIENT_FACTORY",
						useFactory: factory,
						// scope: Scope.Transient, // Not implemented
					},
				],
			}).compile();

			const instance1 = await container.get<{ id: number }>("TRANSIENT_FACTORY");
			const instance2 = await container.get<{ id: number }>("TRANSIENT_FACTORY");

			expect(instance1?.id).toBe(1);
			expect(instance2?.id).toBe(2);
		});
	});

	describe("Function Provider (Direct Class)", () => {
		it("should resolve direct class provider", async () => {
			@Injectable()
			class DirectService {
				getValue() {
					return "direct";
				}
			}

			const container = await Test.createModule({
				providers: [DirectService],
			}).compile();

			const service = await container.get<DirectService>(DirectService);
			expect(service).toBeInstanceOf(DirectService);
			expect(service?.getValue()).toBe("direct");
		});

		it("should inject dependencies into direct class", async () => {
			@Injectable()
			class DependencyService {
				getValue() {
					return "dependency";
				}
			}

			@Injectable()
			class ServiceWithDeps {
				constructor(@Inject(DependencyService) private dep: DependencyService) {}

				getValue() {
					return `service-${this.dep.getValue()}`;
				}
			}

			const container = await Test.createModule({
				providers: [DependencyService, ServiceWithDeps],
			}).compile();

			const service = await container.get<ServiceWithDeps>(ServiceWithDeps);
			expect(service?.getValue()).toBe("service-dependency");
		});

		it("should respect scope from @Injectable decorator", async () => {
			@Injectable({ scope: Scope.Singleton })
			class SingletonService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [SingletonService],
			}).compile();

			const instance1 = await container.get<SingletonService>(SingletonService);
			const instance2 = await container.get<SingletonService>(SingletonService);

			// Singleton scope should return same instance
			expect(instance1?.id).toBe(instance2?.id);
		});
	});

	describe("Mixed Providers", () => {
		it("should handle multiple provider types in one module", async () => {
			@Injectable()
			class ClassService {
				getValue() {
					return "class";
				}
			}

			const valueConfig = { value: "config" };
			const factory = () => ({ value: "factory" });

			const container = await Test.createModule({
				providers: [
					ClassService,
					{ provide: "CONFIG", useValue: valueConfig },
					{ provide: "FACTORY", useFactory: factory },
				],
			}).compile();

			const classService = await container.get<ClassService>(ClassService);
			const config = await container.get<typeof valueConfig>("CONFIG");
			const factoryService = await container.get<{ value: string }>("FACTORY");

			expect(classService?.getValue()).toBe("class");
			expect(config?.value).toBe("config");
			expect(factoryService?.value).toBe("factory");
		});
	});
});

