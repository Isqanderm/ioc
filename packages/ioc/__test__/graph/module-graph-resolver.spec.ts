import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import { Scope } from "../../src";
import { ModuleGraph } from "../../src/core/graph/module-graph";
import { ModuleContainerFactory } from "../../src/core/modules/module-container-factory";
import { ModuleTokenFactory } from "../../src/core/modules/module-token-factory";
import { Resolver } from "../../src/core/resolver/resolver";
import { Inject } from "../../src/decorators/inject";
import { Injectable } from "../../src/decorators/injectable";
import { NsModule } from "../../src/decorators/ns-module";
import type { ContainerInterface } from "../../src/interfaces/modules/container.interface";
import type { ModuleContainerInterface } from "../../src/interfaces/modules/module-container.interface";
import type { OnModuleInit } from "../../src/interfaces/on-module-init.interface";
import type { Type } from "../../src/interfaces/type.interface";
import { hashUtilsMock } from "../hashUtils.mock";

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

		@NsModule({
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

		@NsModule({
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

		@NsModule({
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

		@NsModule({
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

		@NsModule({
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

		@NsModule({
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

		@NsModule({
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

			@NsModule({
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
		it("should resolve circular dependency in one module", async () => {
			interface IServiceA {
				secret: string;
				serviceB: IServiceB;
			}
			interface IServiceB {
				secret: string;
				serviceA: IServiceA;
			}

			@Injectable({ scope: Scope.Request })
			class ServiceA implements IServiceA {
				constructor(
					@Inject("secret") public readonly secret: string,
					@Inject("ServiceB") public readonly serviceB: IServiceB,
				) {}
			}

			@Injectable({ scope: Scope.Request })
			class ServiceB implements IServiceB {
				constructor(
					@Inject("secret") public readonly secret: string,
					@Inject("ServiceA") public readonly serviceA: IServiceA,
				) {}
			}

			const container = await Test.createModule({
				providers: [
					{
						provide: "secret",
						useValue: "bar",
					},
					{
						provide: "ServiceA",
						useClass: ServiceA,
					},
					{
						provide: "ServiceB",
						useClass: ServiceB,
					},
				],
			}).compile();

			const instanceA = await container.get<ServiceA>("ServiceA");
			const instanceB = await container.get<ServiceB>("ServiceB");

			expect(instanceA?.serviceB.secret).toEqual("bar");
			expect(instanceB?.serviceA.secret).toEqual("bar");
		});

		it("should resolve circular dependency in parallel module", async () => {
			interface IServiceA {
				secret: string;
				serviceB: IServiceB;
			}
			interface IServiceB {
				secret: string;
				serviceA: IServiceA;
			}

			@Injectable()
			class ServiceA implements IServiceA {
				constructor(
					@Inject("secret") public readonly secret: string,
					@Inject("ServiceB") public readonly serviceB: IServiceB,
				) {}
			}

			class ModuleA {}

			@Injectable()
			class ServiceB implements IServiceB {
				constructor(
					@Inject("secret") public readonly secret: string,
					@Inject("ServiceA") public readonly serviceA: IServiceA,
				) {}
			}

			class ModuleB {}

			@NsModule({
				providers: [{ provide: "secret", useValue: "bar" }],
				exports: ["secret"],
			})
			class ModuleFoo {}

			NsModule({
				imports: [ModuleB, ModuleFoo],
				providers: [{ provide: "ServiceA", useClass: ServiceA }],
				exports: ["ServiceA"],
			})(ModuleA);

			NsModule({
				imports: [ModuleA, ModuleFoo],
				providers: [{ provide: "ServiceB", useClass: ServiceB }],
				exports: ["ServiceB"],
			})(ModuleB);

			const container = await Test.createModule({
				imports: [ModuleA, ModuleB],
				providers: [
					{
						provide: "foo",
						useValue: "bar",
					},
				],
			}).compile();

			const serviceA = await container.get<ServiceA>("ServiceA");
			const serviceB = await container.get<ServiceB>("ServiceB");

			expect(serviceA?.serviceB.secret).toBe("bar");
			expect(serviceB?.serviceA.secret).toBe("bar");
		});

		it("should resolve circular dependency in complex modules", async () => {
			@Injectable()
			class StandAloneService {
				constructor(
					@Inject("secret") public readonly secret: string,
					@Inject("AppService")
					public readonly appService: IAppService,
				) {}
			}

			class CircleModule {}

			@NsModule({
				imports: [CircleModule],
				exports: [CircleModule, "secret"],
			})
			class ProxyModule {}

			interface IAppService {
				secret: string;
				standAloneService: StandAloneService;
			}

			@Injectable()
			class AppService implements IAppService {
				constructor(
					@Inject("secret") public readonly secret: string,
					@Inject("StandAloneService")
					public readonly standAloneService: StandAloneService,
				) {}
			}

			@NsModule({
				imports: [ProxyModule],
				providers: [
					{ provide: "secret", useValue: "bar" },
					{
						provide: "AppService",
						useClass: AppService,
					},
				],
				exports: ["AppService", "secret"],
			})
			class AppModule {}

			NsModule({
				imports: [AppModule],
				providers: [
					{
						provide: "StandAloneService",
						useClass: StandAloneService,
					},
				],
				exports: ["StandAloneService"],
			})(CircleModule);

			const container = await Test.createModule({
				imports: [AppModule],
			}).compile();

			const appService = await container.get<AppService>("AppService");

			expect(appService?.standAloneService.secret).toBe("bar");
			expect(appService?.standAloneService.appService.secret).toBe("bar");
		});

		it("should resolve cycle dependency with third Singleton dependency", async () => {
			interface IServiceA {
				secret: string;
				serviceB: IServiceB;
				serviceC: ServiceC;
			}
			interface IServiceB {
				secret: string;
				serviceA: IServiceA;
				serviceC: ServiceC;
			}

			@Injectable()
			class ServiceC {}

			@Injectable({ scope: Scope.Request })
			class ServiceA implements IServiceA {
				constructor(
					@Inject("secret") public readonly secret: string,
					@Inject(ServiceC) public readonly serviceC: ServiceC,
					@Inject("ServiceB") public readonly serviceB: IServiceB,
				) {}
			}

			@Injectable({ scope: Scope.Request })
			class ServiceB implements IServiceB {
				constructor(
					@Inject("secret") public readonly secret: string,
					@Inject(ServiceC) public readonly serviceC: ServiceC,
					@Inject("ServiceA") public readonly serviceA: IServiceA,
				) {}
			}

			const container = await Test.createModule({
				providers: [
					ServiceC,
					{
						provide: "secret",
						useValue: "bar",
					},
					{
						provide: "ServiceA",
						useClass: ServiceA,
					},
					{
						provide: "ServiceB",
						useClass: ServiceB,
					},
				],
			}).compile();

			const instanceA = await container.get<ServiceA>("ServiceA");
			const instanceB = await container.get<ServiceB>("ServiceB");
			const instanceC = await container.get<ServiceC>(ServiceC);

			expect(instanceA?.serviceC).toBeInstanceOf(ServiceC);
			expect(instanceB?.serviceC).toBeInstanceOf(ServiceC);
			expect(instanceA?.serviceC === instanceB?.serviceC).toEqual(true);
			expect(instanceA?.serviceC === instanceC).toEqual(true);
			expect(instanceB?.serviceC === instanceC).toEqual(true);
		});
	});
});
