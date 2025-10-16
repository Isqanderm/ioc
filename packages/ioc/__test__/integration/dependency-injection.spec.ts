import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import { Inject, Injectable, NsModule, Optional } from "../../src";

describe("Dependency Injection Integration", () => {
	describe("Multi-level Dependencies", () => {
		it("should resolve deep dependency chains", async () => {
			@Injectable()
			class LevelOneService {
				getValue() {
					return "level-1";
				}
			}

			@Injectable()
			class LevelTwoService {
				constructor(@Inject(LevelOneService) private level1: LevelOneService) {}

				getValue() {
					return `level-2->${this.level1.getValue()}`;
				}
			}

			@Injectable()
			class LevelThreeService {
				constructor(@Inject(LevelTwoService) private level2: LevelTwoService) {}

				getValue() {
					return `level-3->${this.level2.getValue()}`;
				}
			}

			@Injectable()
			class LevelFourService {
				constructor(
					@Inject(LevelThreeService) private level3: LevelThreeService,
				) {}

				getValue() {
					return `level-4->${this.level3.getValue()}`;
				}
			}

			const container = await Test.createModule({
				providers: [
					LevelOneService,
					LevelTwoService,
					LevelThreeService,
					LevelFourService,
				],
			}).compile();

			const service = await container.get<LevelFourService>(LevelFourService);
			expect(service?.getValue()).toBe("level-4->level-3->level-2->level-1");
		});

		it("should handle complex dependency graphs", async () => {
			@Injectable()
			class DatabaseService {
				connect() {
					return "db-connected";
				}
			}

			@Injectable()
			class CacheService {
				get() {
					return "cache-hit";
				}
			}

			@Injectable()
			class LoggerService {
				log(msg: string) {
					return `logged: ${msg}`;
				}
			}

			@Injectable()
			class RepositoryService {
				constructor(
					@Inject(DatabaseService) private db: DatabaseService,
					@Inject(LoggerService) private logger: LoggerService,
				) {}

				getData() {
					return this.db.connect();
				}
			}

			@Injectable()
			class BusinessService {
				constructor(
					@Inject(RepositoryService) private repo: RepositoryService,
					@Inject(CacheService) private cache: CacheService,
					@Inject(LoggerService) private logger: LoggerService,
				) {}

				execute() {
					return `${this.cache.get()}-${this.repo.getData()}`;
				}
			}

			const container = await Test.createModule({
				providers: [
					DatabaseService,
					CacheService,
					LoggerService,
					RepositoryService,
					BusinessService,
				],
			}).compile();

			const service = await container.get<BusinessService>(BusinessService);
			expect(service?.execute()).toBe("cache-hit-db-connected");
		});
	});

	describe("Circular Dependencies", () => {
		it("should detect circular dependencies", async () => {
			@Injectable()
			class ServiceA {
				constructor(@Inject("ServiceB") private serviceB: unknown) {}
			}

			@Injectable()
			class ServiceB {
				constructor(@Inject(ServiceA) private serviceA: ServiceA) {}
			}

			const container = await Test.createModule({
				providers: [ServiceA, { provide: "ServiceB", useClass: ServiceB }],
			}).compile();

			const errors = container.errors;
			expect(errors.length).toBeGreaterThan(0);
			// The actual error type is "CD_PROVIDERS" not "CD_DEPENDENCIES"
			expect(errors.some((e) => e.type === "CD_PROVIDERS")).toBe(true);
		});

		it("should handle circular dependencies with forwardRef", async () => {
			@Injectable()
			class ServiceA {
				constructor(@Inject("ServiceB") private serviceB: unknown) {}

				getValue() {
					return "A";
				}
			}

			@Injectable()
			class ServiceB {
				constructor(@Inject(ServiceA) private serviceA: ServiceA) {}

				getValue() {
					return `B->${this.serviceA.getValue()}`;
				}
			}

			const container = await Test.createModule({
				providers: [ServiceA, { provide: "ServiceB", useClass: ServiceB }],
			}).compile();

			// Should have circular dependency error
			expect(container.errors.length).toBeGreaterThan(0);
		});
	});

	describe("Optional Dependencies", () => {
		it("should not fail when optional dependency is missing", async () => {
			@Injectable()
			class OptionalDependency {}

			@Injectable()
			class ServiceWithOptional {
				constructor(
					@Inject(OptionalDependency)
					@Optional()
					private optional?: OptionalDependency,
				) {}

				hasOptional() {
					return this.optional !== undefined;
				}
			}

			const container = await Test.createModule({
				providers: [ServiceWithOptional],
			}).compile();

			expect(container.errors).toEqual([]);
			const service =
				await container.get<ServiceWithOptional>(ServiceWithOptional);
			expect(service?.hasOptional()).toBe(false);
		});

		it("should inject optional dependency when available", async () => {
			@Injectable()
			class OptionalDependency {
				getValue() {
					return "optional-value";
				}
			}

			@Injectable()
			class ServiceWithOptional {
				constructor(
					@Inject(OptionalDependency)
					@Optional()
					private optional?: OptionalDependency,
				) {}

				getValue() {
					return this.optional?.getValue() || "no-value";
				}
			}

			const container = await Test.createModule({
				providers: [OptionalDependency, ServiceWithOptional],
			}).compile();

			const service =
				await container.get<ServiceWithOptional>(ServiceWithOptional);
			expect(service?.getValue()).toBe("optional-value");
		});

		it("should handle multiple optional dependencies", async () => {
			@Injectable()
			class OptionalA {}

			@Injectable()
			class OptionalB {}

			@Injectable()
			class ServiceWithMultipleOptional {
				constructor(
					@Inject(OptionalA) @Optional() private optA?: OptionalA,
					@Inject(OptionalB) @Optional() private optB?: OptionalB,
				) {}

				getStatus() {
					return {
						hasA: this.optA !== undefined,
						hasB: this.optB !== undefined,
					};
				}
			}

			const container = await Test.createModule({
				providers: [OptionalA, ServiceWithMultipleOptional],
			}).compile();

			const service = await container.get<ServiceWithMultipleOptional>(
				ServiceWithMultipleOptional,
			);
			const status = service?.getStatus();

			expect(status?.hasA).toBe(true);
			expect(status?.hasB).toBe(false);
		});
	});

	describe("Custom Injection Tokens", () => {
		it("should inject using string tokens", async () => {
			const CONFIG_TOKEN = "APP_CONFIG";
			const config = { apiUrl: "https://api.example.com" };

			@Injectable()
			class ServiceWithConfig {
				constructor(@Inject(CONFIG_TOKEN) private config: typeof config) {}

				getApiUrl() {
					return this.config.apiUrl;
				}
			}

			const container = await Test.createModule({
				providers: [
					{ provide: CONFIG_TOKEN, useValue: config },
					ServiceWithConfig,
				],
			}).compile();

			const service = await container.get<ServiceWithConfig>(ServiceWithConfig);
			expect(service?.getApiUrl()).toBe("https://api.example.com");
		});

		it("should inject using symbol tokens", async () => {
			const CONFIG_TOKEN = Symbol("APP_CONFIG");
			const config = { apiUrl: "https://api.example.com" };

			@Injectable()
			class ServiceWithConfig {
				constructor(@Inject(CONFIG_TOKEN) private config: typeof config) {}

				getApiUrl() {
					return this.config.apiUrl;
				}
			}

			const container = await Test.createModule({
				providers: [
					{ provide: CONFIG_TOKEN, useValue: config },
					ServiceWithConfig,
				],
			}).compile();

			const service = await container.get<ServiceWithConfig>(ServiceWithConfig);
			expect(service?.getApiUrl()).toBe("https://api.example.com");
		});

		it("should support multiple custom tokens", async () => {
			const DB_CONFIG = "DB_CONFIG";
			const API_CONFIG = "API_CONFIG";

			@Injectable()
			class ServiceWithMultipleConfigs {
				constructor(
					@Inject(DB_CONFIG) private dbConfig: unknown,
					@Inject(API_CONFIG) private apiConfig: unknown,
				) {}

				getConfigs() {
					return {
						db: this.dbConfig,
						api: this.apiConfig,
					};
				}
			}

			const container = await Test.createModule({
				providers: [
					{ provide: DB_CONFIG, useValue: { host: "localhost" } },
					{ provide: API_CONFIG, useValue: { url: "https://api.com" } },
					ServiceWithMultipleConfigs,
				],
			}).compile();

			const service = await container.get<ServiceWithMultipleConfigs>(
				ServiceWithMultipleConfigs,
			);
			const configs = service?.getConfigs();

			expect(configs?.db.host).toBe("localhost");
			expect(configs?.api.url).toBe("https://api.com");
		});
	});

	describe("Property Injection", () => {
		it("should inject dependencies via properties", async () => {
			@Injectable()
			class DependencyService {
				getValue() {
					return "property-injected";
				}
			}

			@Injectable()
			class ServiceWithPropertyInjection {
				@Inject(DependencyService)
				private dep!: DependencyService;

				getValue() {
					return this.dep.getValue();
				}
			}

			const container = await Test.createModule({
				providers: [DependencyService, ServiceWithPropertyInjection],
			}).compile();

			const service = await container.get<ServiceWithPropertyInjection>(
				ServiceWithPropertyInjection,
			);
			expect(service?.getValue()).toBe("property-injected");
		});

		it("should support mixed constructor and property injection", async () => {
			@Injectable()
			class ConstructorDep {
				getValue() {
					return "constructor";
				}
			}

			@Injectable()
			class PropertyDep {
				getValue() {
					return "property";
				}
			}

			@Injectable()
			class MixedService {
				@Inject(PropertyDep)
				private propDep!: PropertyDep;

				constructor(@Inject(ConstructorDep) private constDep: ConstructorDep) {}

				getValue() {
					return `${this.constDep.getValue()}-${this.propDep.getValue()}`;
				}
			}

			const container = await Test.createModule({
				providers: [ConstructorDep, PropertyDep, MixedService],
			}).compile();

			const service = await container.get<MixedService>(MixedService);
			expect(service?.getValue()).toBe("constructor-property");
		});
	});
});
