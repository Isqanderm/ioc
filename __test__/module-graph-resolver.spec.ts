import "reflect-metadata";
import type { DynamicModule } from "../src";
import { ModuleGraph } from "../src/core/graph/module-graph";
import { ModuleContainerFactory } from "../src/core/modules/module-container-factory";
import { ModuleTokenFactory } from "../src/core/modules/module-token-factory";
import { Resolver } from "../src/core/resolver/resolver";
import { Inject } from "../src/decorators/inject";
import { Injectable } from "../src/decorators/injectable";
import { Module } from "../src/decorators/module";
import type { ContainerInterface } from "../src/interfaces/modules/container.interface";
import type { ModuleContainerInterface } from "../src/interfaces/modules/module-container.interface";
import type { OnModuleInit } from "../src/interfaces/on-module-init.interface";
import type { Type } from "../src/interfaces/type.interface";
import { hashUtilsMock } from "./hashUtils.mock";

describe("GraphResolver", () => {
	const moduleTokenFactory = new ModuleTokenFactory(hashUtilsMock);
	const moduleContainerFactory = new ModuleContainerFactory(moduleTokenFactory);
	const container = {
		async addModule(
			metatype: Type<unknown>,
		): Promise<ModuleContainerInterface> {
			return await moduleContainerFactory.create(metatype, container);
		},
	} as ContainerInterface;

	it("should resolve a provider with no dependencies", async () => {
		@Injectable()
		class ServiceA {}

		@Module({
			providers: [ServiceA],
		})
		class TestModule {}

		const moduleContainer = await moduleContainerFactory.create(
			TestModule,
			container,
		);
		const graph = new ModuleGraph(moduleContainer);
		await graph.compile();

		const resolver = new Resolver(graph);
		const serviceAInstance = await resolver.resolveProvider(ServiceA);

		expect(serviceAInstance).toBeInstanceOf(ServiceA);
	});

	it("should resolve a provider with dependencies", async () => {
		@Injectable()
		class ServiceA {}

		@Injectable()
		class ServiceB {
			constructor(@Inject(ServiceA) public readonly serviceA: ServiceA) {}
		}

		@Module({
			providers: [ServiceA, ServiceB],
		})
		class TestModule {}

		const moduleContainer = await moduleContainerFactory.create(
			TestModule,
			container,
		);
		const graph = new ModuleGraph(moduleContainer);
		await graph.compile();

		const resolver = new Resolver(graph);
		const serviceBInstance = await resolver.resolveProvider<ServiceB>(ServiceB);

		expect(serviceBInstance).toBeInstanceOf(ServiceB);
		expect(serviceBInstance?.serviceA).toBeInstanceOf(ServiceA);
	});

	it("should resolve a provider using useClass", async () => {
		class ServiceA {}

		@Injectable()
		class ServiceAImpl extends ServiceA {}

		@Module({
			providers: [
				{
					provide: ServiceA,
					useClass: ServiceAImpl,
				},
			],
		})
		class TestModule {}

		const moduleContainer = await moduleContainerFactory.create(
			TestModule,
			container,
		);
		const graph = new ModuleGraph(moduleContainer);
		await graph.compile();

		const resolver = new Resolver(graph);
		const serviceAInstance = await resolver.resolveProvider(ServiceA);

		expect(serviceAInstance).toBeInstanceOf(ServiceAImpl);
	});

	it("should resolve a provider using useValue", async () => {
		const valueProvider = { value: 42 };

		@Module({
			providers: [
				{
					provide: "VALUE_PROVIDER",
					useValue: valueProvider,
				},
			],
		})
		class TestModule {}

		const moduleContainer = await moduleContainerFactory.create(
			TestModule,
			container,
		);
		const graph = new ModuleGraph(moduleContainer);
		await graph.compile();

		const resolver = new Resolver(graph);
		const resolvedValue = await resolver.resolveProvider("VALUE_PROVIDER");

		expect(resolvedValue).toBe(valueProvider);
	});

	it("should resolve a provider using useFactory", async () => {
		@Injectable()
		class TestService {}

		const factoryProvider = (testService: TestService) => ({
			value: 42,
			testService,
		});

		@Module({
			providers: [
				TestService,
				{
					provide: "FACTORY_PROVIDER",
					useFactory: factoryProvider,
					inject: [TestService],
				},
			],
		})
		class TestModule {}

		const moduleContainer = await moduleContainerFactory.create(
			TestModule,
			container,
		);
		const graph = new ModuleGraph(moduleContainer);
		await graph.compile();

		const resolver = new Resolver(graph);
		const resolvedValue = await resolver.resolveProvider("FACTORY_PROVIDER");

		expect(resolvedValue).toEqual({
			value: 42,
			testService: new TestService(),
		});
	});

	it("should resolve a provider with dependencies from another module", async () => {
		@Injectable()
		class SnakeService {}

		@Injectable()
		class LocalSnakeService {}

		@Module({
			providers: [SnakeService, LocalSnakeService],
			exports: [SnakeService],
		})
		class SnakeModule {}

		@Injectable()
		class ServiceA {}

		@Injectable()
		class ServiceB {
			constructor(
				@Inject(ServiceA) public readonly serviceA: ServiceA,
				@Inject(SnakeService) public readonly snakeService: SnakeService,
				@Inject(LocalSnakeService)
				public readonly localSnakeService: LocalSnakeService,
			) {}
		}

		@Module({
			imports: [SnakeModule],
			providers: [ServiceA, ServiceB],
		})
		class AppModule {}

		const moduleContainer = await moduleContainerFactory.create(
			AppModule,
			container,
		);
		const graph = new ModuleGraph(moduleContainer);
		await graph.compile();

		const resolver = new Resolver(graph);
		const serviceBInstance = await resolver.resolveProvider<ServiceB>(ServiceB);

		expect(serviceBInstance).toBeInstanceOf(ServiceB);
		expect(serviceBInstance?.serviceA).toBeInstanceOf(ServiceA);
		expect(serviceBInstance?.snakeService).toBeInstanceOf(SnakeService);
		expect(serviceBInstance?.localSnakeService).toBe(undefined);
	});

	describe("init module", () => {
		it("should call onInit when provider instance is created", async () => {
			const OnModuleInitMock = jest.fn();

			@Injectable()
			class ServiceA implements OnModuleInit {
				onModuleInit() {
					OnModuleInitMock();
				}
			}

			@Module({
				providers: [ServiceA],
			})
			class TestModule {}

			const moduleContainer = await moduleContainerFactory.create(
				TestModule,
				container,
			);
			const graph = new ModuleGraph(moduleContainer);
			await graph.compile();

			const resolver = new Resolver(graph);
			const serviceAInstance = await resolver.resolveProvider(ServiceA);

			expect(serviceAInstance).toBeInstanceOf(ServiceA);
			expect(OnModuleInitMock).toHaveBeenCalled();
		});
	});

	describe("Circular Dependency", () => {
		it("should detect circular dependency in one module", async () => {
			// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
			interface IServiceA {}
			// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
			interface IServiceB {}

			@Injectable()
			class ServiceA implements IServiceA {
				constructor(@Inject("ServiceB") public readonly serviceB: IServiceB) {}
			}

			@Injectable()
			class ServiceB implements IServiceB {
				constructor(@Inject("ServiceA") public readonly serviceA: IServiceA) {}
			}

			@Module({
				providers: [
					{ provide: "ServiceA", useClass: ServiceA },
					{ provide: "ServiceB", useClass: ServiceB },
				],
			})
			class TestModule {}

			const moduleContainer = await moduleContainerFactory.create(
				TestModule,
				container,
			);
			const graph = new ModuleGraph(moduleContainer);
			await graph.compile();

			const resolver = new Resolver(graph);

			const serviceA = await resolver.resolveProvider<ServiceA>("ServiceA");
			const serviceB = await resolver.resolveProvider<ServiceB>("ServiceB");

			expect(serviceA?.serviceB).toBe(undefined);
			expect(serviceB?.serviceA).toBe(undefined);
		});

		it("should detect circular dependency in parallel module", async () => {
			// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
			interface IServiceA {}
			// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
			interface IServiceB {}

			@Injectable()
			class ServiceA implements IServiceA {
				constructor(@Inject("ServiceB") public readonly serviceB: IServiceB) {}
			}
			class ModuleA {}

			@Injectable()
			class ServiceB implements IServiceB {
				constructor(@Inject("ServiceA") public readonly serviceA: IServiceA) {}
			}
			class ModuleB {}

			@Module({
				imports: [ModuleA, ModuleB],
			})
			class TestModule {}

			Module({
				imports: [ModuleB],
				providers: [{ provide: "ServiceA", useClass: ServiceA }],
				exports: ["ServiceA"],
			})(ModuleA);

			Module({
				imports: [ModuleA],
				providers: [{ provide: "ServiceB", useClass: ServiceB }],
				exports: ["ServiceB"],
			})(ModuleB);

			const moduleContainer = await moduleContainerFactory.create(
				TestModule,
				container,
			);
			const graph = new ModuleGraph(moduleContainer);
			await graph.compile();

			const resolver = new Resolver(graph);

			const serviceA = await resolver.resolveProvider<ServiceA>("ServiceA");
			const serviceB = await resolver.resolveProvider<ServiceB>("ServiceB");

			for (const edges of graph.getAllEdges()) {
				for (const edge of edges) {
					if (edge.type === "dependency") {
						expect(edge.metadata.isCircular).toBe(true);
					}
				}
			}

			expect(serviceA?.serviceB).toBe(undefined);
			expect(serviceB?.serviceA).toBe(undefined);
		});

		it("should detect circular dependency in complex modules", async () => {
			@Injectable()
			class StandAloneService {
				constructor(
					@Inject("AppService")
					public readonly appService: IAppService,
				) {}
			}

			class CircleModule {}

			class FirstModule {}
			class SecondModule {}

			Module({
				imports: [SecondModule],
			})(FirstModule);

			Module({
				imports: [FirstModule],
			})(SecondModule);

			@Injectable()
			class HttpService {
				@Inject("URL") private readonly url: string = "";
				@Inject("ASYNC_FACTORY") private readonly factoryResult: string = "";
			}

			@Module({
				imports: [FirstModule, SecondModule, CircleModule],
				providers: [
					HttpService,
					{
						provide: "URL",
						useValue: "https://....",
					},
					{
						provide: "ASYNC_FACTORY",
						useFactory: () => {
							return Promise.resolve("ASYNC_FACTORY");
						},
					},
				],
			})
			class TransportModule {}

			// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
			interface IAppService {}
			// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
			interface ISecondProvider {}

			@Injectable()
			class SecondProvider implements SecondProvider {
				constructor(
					@Inject("AppService")
					private readonly appService: IAppService,
				) {}
			}

			@Injectable()
			class AppService implements IAppService {
				constructor(
					@Inject("SecondProvider")
					private readonly secondProvider: ISecondProvider,
					@Inject("StandAloneService")
					public readonly standAloneService: StandAloneService,
				) {}
			}

			@Module({
				imports: [TransportModule],
				providers: [
					{
						provide: "SecondProvider",
						useClass: SecondProvider,
					},
					{
						provide: "AppService",
						useClass: AppService,
					},
				],
				exports: ["AppService"],
			})
			class AppModule {}

			Module({
				imports: [AppModule],
				providers: [
					{
						provide: "StandAloneService",
						useClass: StandAloneService,
					},
				],
				exports: ["StandAloneService"],
			})(CircleModule);

			const moduleContainer = await moduleContainerFactory.create(
				AppModule,
				container,
			);
			const graph = new ModuleGraph(moduleContainer);
			await graph.compile();

			const resolver = new Resolver(graph);

			const appService =
				await resolver.resolveProvider<AppService>("AppService");
			const standAloneService =
				await resolver.resolveProvider<StandAloneService>("StandAloneService");

			for (const allEdge of graph.getAllEdges()) {
				for (const edge of allEdge) {
					if (
						edge.type === "dependency" &&
						edge.source === "AppService" &&
						edge.target === "StandAloneService"
					) {
						expect(edge.metadata.isCircular).toBe(true);
					}

					if (
						edge.type === "dependency" &&
						edge.source === "StandAloneService" &&
						edge.target === "AppService"
					) {
						expect(edge.metadata.isCircular).toBe(true);
					}
				}
			}

			expect(appService?.standAloneService).toBe(undefined);
			expect(standAloneService?.appService).toBe(undefined);
		});
	});

	describe("Module ForFeature", () => {
		it("should resolve a module with forFeature", async () => {
			const featureConfig = {
				provide: "FEATURE_CONFIG",
				useValue: { feature: true },
			};

			@Module({})
			class FeatureModule {
				static forFeature(): DynamicModule {
					return {
						module: FeatureModule,
						imports: [],
						providers: [featureConfig],
					};
				}
			}

			const moduleContainer = await moduleContainerFactory.create(
				FeatureModule.forFeature(),
				container,
			);
			const graph = new ModuleGraph(moduleContainer);
			await graph.compile();

			const resolver = new Resolver(graph);

			const featureConfigValue =
				await resolver.resolveProvider<(typeof featureConfig)["useValue"]>(
					"FEATURE_CONFIG",
				);

			expect(featureConfigValue).toEqual({ feature: true });
		});

		it("should resolve a module with async forFeature", async () => {
			@Injectable()
			class ConfigService {
				featureEnabled = true;
			}

			const featureConfig = {
				provide: "FEATURE_FACTORY",
				useFactory: async (configService: ConfigService) => {
					return { feature: configService.featureEnabled };
				},
				inject: [ConfigService],
			};

			@Module({})
			class FeatureModule {
				static forFeature(): DynamicModule {
					return {
						module: FeatureModule,
						imports: [],
						providers: [
							featureConfig,
							{ provide: ConfigService, useClass: ConfigService },
						],
					};
				}
			}

			const moduleContainer = await moduleContainerFactory.create(
				FeatureModule.forFeature(),
				container,
			);
			const graph = new ModuleGraph(moduleContainer);
			await graph.compile();

			const resolver = new Resolver(graph);

			const featureConfigValue =
				await resolver.resolveProvider<
					ReturnType<(typeof featureConfig)["useFactory"]>
				>("FEATURE_FACTORY");

			expect(featureConfigValue).toEqual({ feature: true });
		});
	});
});
