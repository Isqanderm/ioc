import "reflect-metadata";
import { ModuleGraph } from "../../src/core/graph/module-graph";
import { ModuleContainerFactory } from "../../src/core/modules/module-container-factory";
import { ModuleTokenFactory } from "../../src/core/modules/module-token-factory";
import { NsModule } from "../../src/decorators/NsModule";
import { Global } from "../../src/decorators/global";
import { Inject } from "../../src/decorators/inject";
import { Injectable } from "../../src/decorators/injectable";
import type { DynamicModule } from "../../src/interfaces/dynamic-module.interface";
import type { ContainerInterface } from "../../src/interfaces/modules/container.interface";
import type { ModuleContainerInterface } from "../../src/interfaces/modules/module-container.interface";
import type { Type } from "../../src/interfaces/type.interface";
import { getProviderToken } from "../../src/utils/helpers";
import { hashUtilsMock } from "../hashUtils.mock";

describe("ModuleGraph", () => {
	const moduleTokenFactory = new ModuleTokenFactory(hashUtilsMock);
	const moduleContainerFactory = new ModuleContainerFactory(moduleTokenFactory);
	const container = {
		async addModule(
			metatype: Type<unknown>,
		): Promise<ModuleContainerInterface> {
			return await moduleContainerFactory.create(metatype, container);
		},
	} as ContainerInterface;

	describe("Modules", () => {
		@NsModule({})
		class TestModule {}

		it("should initialize with the root module", async () => {
			const moduleContainerFactory = new ModuleContainerFactory(
				moduleTokenFactory,
			);
			const mockModuleContainer = await moduleContainerFactory.create(
				TestModule,
				container,
			);
			const graph = new ModuleGraph(mockModuleContainer);

			expect(graph).toBeDefined();
		});

		it("should add the root module to nodes", async () => {
			const moduleContainerFactory = new ModuleContainerFactory(
				moduleTokenFactory,
			);
			const mockModuleContainer = await moduleContainerFactory.create(
				TestModule,
				container,
			);
			const graph = new ModuleGraph(mockModuleContainer);
			await graph.compile();

			const nodes = graph.nodes;

			expect(nodes.size).toBe(1);
			expect(nodes.has(mockModuleContainer.token)).toBe(true);

			const node = nodes.get(mockModuleContainer.token);

			expect(node?.node).toEqual({
				id: mockModuleContainer.token,
				isGlobal: false,
				isDynamic: false,
				label: "TestModule",
				metatype: mockModuleContainer.metatype,
				moduleContainer: mockModuleContainer,
				type: "module",
			});
		});

		it("should add imported modules to nodes and edges", async () => {
			@NsModule({})
			class ImportedModule {}

			@NsModule({
				imports: [ImportedModule],
			})
			class TestModule {}

			const moduleContainerFactory = new ModuleContainerFactory(
				moduleTokenFactory,
			);
			const mockModuleContainer = await moduleContainerFactory.create(
				TestModule,
				container,
			);
			const mockImportedModuleContainer = await moduleContainerFactory.create(
				ImportedModule,
				container,
			);

			const graph = new ModuleGraph(mockModuleContainer);
			await graph.compile();

			const nodes = graph.nodes;
			const edges = graph.edges;

			expect(nodes.size).toBe(2);
			expect(nodes.has(mockModuleContainer.token)).toBeDefined();
			expect(nodes.has(mockImportedModuleContainer.token)).toBeDefined();

			const edgeList = edges.get(mockModuleContainer.token) || [];
			expect(edgeList).toBeDefined();
			expect(edgeList?.length).toBe(1);

			const edge = edgeList[0];
			expect(edge).toEqual({
				type: "import",
				source: mockImportedModuleContainer.token,
				target: mockModuleContainer.token,
				metadata: {
					isCircular: false,
				},
			});
		});

		it("should handle multiple imported modules", async () => {
			@NsModule({})
			class ImportedModule {}

			@NsModule({})
			class AnotherImportedModule {}

			@NsModule({
				imports: [ImportedModule, AnotherImportedModule],
			})
			class TestModule {}

			const moduleContainerFactory = new ModuleContainerFactory(
				moduleTokenFactory,
			);
			const mockModuleContainer = await moduleContainerFactory.create(
				TestModule,
				container,
			);
			const mockImportedModuleContainer = await moduleContainerFactory.create(
				ImportedModule,
				container,
			);
			const anotherImportedModuleContainer =
				await moduleContainerFactory.create(AnotherImportedModule, container);

			const graph = new ModuleGraph(mockModuleContainer);
			await graph.compile();

			const nodes = graph.nodes;
			const edges = graph.edges;

			expect(nodes.size).toBe(3);
			expect(nodes.has(mockModuleContainer.token)).toBe(true);
			expect(nodes.has(mockImportedModuleContainer.token)).toBe(true);
			expect(nodes.has(anotherImportedModuleContainer.token)).toBe(true);

			const edgeList1 = edges.get(mockModuleContainer.token) || [];
			expect(edgeList1).toBeDefined();
			expect(edgeList1.length).toBe(2);

			const edge1 = edgeList1.find(
				(edge) => edge.source === mockImportedModuleContainer.token,
			);
			const edge2 = edgeList1.find(
				(edge) => edge.source === anotherImportedModuleContainer.token,
			);

			expect(edge1).toEqual({
				type: "import",
				source: mockImportedModuleContainer.token,
				target: mockModuleContainer.token,
				metadata: {
					isCircular: false,
				},
			});

			expect(edge2).toEqual({
				type: "import",
				source: anotherImportedModuleContainer.token,
				target: mockModuleContainer.token,
				metadata: {
					isCircular: false,
				},
			});
		});

		it("should handle circular imported modules", async () => {
			class ImportedModule {}

			@NsModule({
				imports: [ImportedModule],
			})
			class AnotherImportedModule {}

			@NsModule({
				imports: [AnotherImportedModule],
			})
			class TestModule {}

			NsModule({
				imports: [TestModule],
			})(ImportedModule);

			const moduleContainerFactory = new ModuleContainerFactory(
				moduleTokenFactory,
			);
			const mockModuleContainer = await moduleContainerFactory.create(
				TestModule,
				container,
			);
			const mockImportedModuleContainer = await moduleContainerFactory.create(
				ImportedModule,
				container,
			);
			const anotherImportedModuleContainer =
				await moduleContainerFactory.create(AnotherImportedModule, container);

			const graph = new ModuleGraph(mockModuleContainer);
			await graph.compile();

			const nodes = graph.nodes;
			const edges = graph.edges;

			expect(nodes.size).toBe(3);
			expect(nodes.has(mockModuleContainer.token)).toBe(true);
			expect(nodes.has(mockImportedModuleContainer.token)).toBe(true);
			expect(nodes.has(anotherImportedModuleContainer.token)).toBe(true);

			const edgeList1 = edges.get(mockModuleContainer.token) || [];
			expect(edgeList1).toBeDefined();
			expect(edgeList1.length).toBe(1);

			const edge1 = edgeList1.find(
				(edge) => edge.source === anotherImportedModuleContainer.token,
			);

			expect(edge1).toEqual({
				type: "import",
				source: anotherImportedModuleContainer.token,
				target: mockModuleContainer.token,
				metadata: {
					isCircular: true,
				},
			});
		});
	});

	describe("Plain Class Providers", () => {
		describe("Providers", () => {
			@Injectable()
			class TestModuleProvider {}

			@NsModule({
				providers: [TestModuleProvider],
			})
			class TestModule {}

			it("should set provider edge", async () => {
				@NsModule({
					imports: [TestModule],
				})
				class AppModule {}

				const moduleContainerFactory = new ModuleContainerFactory(
					moduleTokenFactory,
				);
				const testModuleContainer = await moduleContainerFactory.create(
					TestModule,
					container,
				);
				const appModuleContainer = await moduleContainerFactory.create(
					AppModule,
					container,
				);
				const graph = new ModuleGraph(appModuleContainer);

				await graph.compile();

				const nodes = graph.nodes;
				const edges = graph.edges;

				expect(nodes.size).toBe(3);
				expect(nodes.has(appModuleContainer.token)).toBeDefined();
				expect(nodes.has(testModuleContainer.token)).toBeDefined();
			});

			it("should create edge for Provider", async () => {
				@NsModule({
					imports: [TestModule],
				})
				class AppModule {}

				const moduleContainerFactory = new ModuleContainerFactory(
					moduleTokenFactory,
				);
				const testModuleContainer = await moduleContainerFactory.create(
					TestModule,
					container,
				);
				const appModuleContainer = await moduleContainerFactory.create(
					AppModule,
					container,
				);
				const graph = new ModuleGraph(appModuleContainer);

				await graph.compile();

				expect(
					graph.getNode(getProviderToken(TestModuleProvider)).metatype,
				).toBe(TestModuleProvider);

				const testModuleContainerEdges = graph.getEdge(
					testModuleContainer.token,
				);

				expect(testModuleContainerEdges).toHaveLength(1);
				expect(testModuleContainerEdges[0].source).toBe(
					getProviderToken(TestModuleProvider),
				);
				expect(testModuleContainerEdges[0].target).toBe(
					testModuleContainer.token,
				);
				expect(testModuleContainerEdges[0].metadata).toEqual({
					isCircular: false,
					unreached: false,
				});
			});
		});

		describe("Dependencies", () => {
			it("should correctly add dependencies between providers", async () => {
				@Injectable()
				class ServiceA {}

				@Injectable()
				class ServiceB {
					constructor(@Inject(ServiceA) private readonly serviceA: ServiceA) {}
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

				const edges = graph.edges;
				const serviceBEdges = edges.get(getProviderToken(ServiceB));

				expect(serviceBEdges).toEqual([
					{
						type: "dependency",
						source: getProviderToken(ServiceB),
						target: getProviderToken(ServiceA),
						metadata: {
							index: 0,
							inject: "constructor",
							isCircular: false,
							unreached: false,
						},
					},
				]);
			});

			it("should resolve dependencies from different modules, including those exported from a parent and through one level of nesting", async () => {
				@Injectable()
				class ServiceA {}

				@Injectable()
				class ServiceB {}

				@Injectable()
				class ServiceC {
					constructor(
						@Inject(ServiceA) private readonly serviceA: ServiceA,
						@Inject(ServiceB) private readonly serviceB: ServiceB,
					) {}
				}

				@NsModule({
					providers: [ServiceA],
					exports: [ServiceA],
				})
				class ModuleA {}

				@NsModule({
					providers: [ServiceB],
					exports: [ServiceB],
				})
				class ModuleB {}

				@NsModule({
					imports: [ModuleA, ModuleB],
				})
				class ParentModule {}

				@NsModule({
					imports: [ParentModule],
					providers: [ServiceC],
				})
				class ChildModule {}

				const childModuleContainer = await moduleContainerFactory.create(
					ChildModule,
					container,
				);
				const parentModuleContainer = await moduleContainerFactory.create(
					ParentModule,
					container,
				);
				const moduleAContainer = await moduleContainerFactory.create(
					ModuleA,
					container,
				);
				const moduleBContainer = await moduleContainerFactory.create(
					ModuleB,
					container,
				);
				const graph = new ModuleGraph(childModuleContainer);

				await graph.compile();

				const nodes = graph.nodes;
				const edges = graph.edges;

				expect(nodes.size).toBe(7); // ChildModule, ParentModule, ModuleA, ModuleB, ServiceC
				expect(nodes.has(childModuleContainer.token)).toBe(true);
				expect(nodes.has(parentModuleContainer.token)).toBe(true);
				expect(nodes.has(moduleAContainer.token)).toBe(true);
				expect(nodes.has(moduleBContainer.token)).toBe(true);

				const serviceCEdges = edges.get(getProviderToken(ServiceC));

				expect(serviceCEdges).toEqual([
					{
						type: "dependency",
						source: getProviderToken(ServiceC),
						target: getProviderToken(ServiceA),
						metadata: {
							index: 0,
							inject: "constructor",
							isCircular: false,
							unreached: true,
						},
					},
					{
						type: "dependency",
						source: getProviderToken(ServiceC),
						target: getProviderToken(ServiceB),
						metadata: {
							index: 1,
							inject: "constructor",
							isCircular: false,
							unreached: true,
						},
					},
				]);
			});

			it("should mark dependency as unreached when it is not in the scope", async () => {
				@Injectable()
				class ServiceA {}

				@Injectable()
				class ServiceB {
					constructor(@Inject(ServiceA) private readonly serviceA: ServiceA) {}
				}

				@NsModule({
					providers: [ServiceA],
					exports: [],
				})
				class ExportingModule {}

				@NsModule({
					imports: [ExportingModule],
					providers: [ServiceB],
				})
				class ImportingModule {}

				const moduleContainer = await moduleContainerFactory.create(
					ImportingModule,
					container,
				);
				const graph = new ModuleGraph(moduleContainer);
				await graph.compile();

				const edges = graph.edges;
				const serviceBEdges = edges.get(getProviderToken(ServiceB));

				expect(serviceBEdges).toEqual([
					{
						type: "dependency",
						source: getProviderToken(ServiceB),
						target: getProviderToken(ServiceA),
						metadata: {
							index: 0,
							inject: "constructor",
							isCircular: false,
							unreached: true,
						},
					},
				]);
			});

			it("should mark dependency as unreached when it is not exported by any module", async () => {
				@Injectable()
				class ServiceA {}

				@Injectable()
				class ServiceB {
					constructor(@Inject(ServiceA) private readonly serviceA: ServiceA) {}
				}

				@NsModule({
					providers: [ServiceA],
				})
				class NonExportingModule {}

				@NsModule({
					imports: [NonExportingModule],
					providers: [ServiceB],
				})
				class ImportingModule {}

				const moduleContainer = await moduleContainerFactory.create(
					ImportingModule,
					container,
				);
				const graph = new ModuleGraph(moduleContainer);
				await graph.compile();

				const edges = graph.edges;
				const serviceBEdges = edges.get(getProviderToken(ServiceB));

				expect(serviceBEdges).toEqual([
					{
						type: "dependency",
						source: getProviderToken(ServiceB),
						target: getProviderToken(ServiceA),
						metadata: {
							index: 0,
							inject: "constructor",
							isCircular: false,
							unreached: true,
						},
					},
				]);
			});
		});
	});

	describe("Value Providers", () => {
		describe("Providers", () => {
			const valueProvider = {
				provide: "CONFIG",
				useValue: { key: "value" },
			};

			@NsModule({
				providers: [valueProvider],
			})
			class TestModule {}

			it("should set provider edge", async () => {
				@NsModule({
					imports: [TestModule],
				})
				class AppModule {}

				const moduleContainerFactory = new ModuleContainerFactory(
					moduleTokenFactory,
				);
				const testModuleContainer = await moduleContainerFactory.create(
					TestModule,
					container,
				);
				const appModuleContainer = await moduleContainerFactory.create(
					AppModule,
					container,
				);
				const graph = new ModuleGraph(appModuleContainer);

				await graph.compile();

				const nodes = graph.nodes;
				const edges = graph.edges;

				expect(nodes.size).toBe(3);
				expect(nodes.has(appModuleContainer.token)).toBeDefined();
				expect(nodes.has(testModuleContainer.token)).toBeDefined();
			});

			it("should create edge for Value Provider", async () => {
				@NsModule({
					imports: [TestModule],
				})
				class AppModule {}

				const moduleContainerFactory = new ModuleContainerFactory(
					moduleTokenFactory,
				);
				const testModuleContainer = await moduleContainerFactory.create(
					TestModule,
					container,
				);
				const appModuleContainer = await moduleContainerFactory.create(
					AppModule,
					container,
				);
				const graph = new ModuleGraph(appModuleContainer);

				await graph.compile();

				expect(graph.getNode(getProviderToken(valueProvider)).metatype).toBe(
					valueProvider,
				);

				const testModuleContainerEdges = graph.getEdge(
					testModuleContainer.token,
				);

				expect(testModuleContainerEdges).toHaveLength(1);
				expect(testModuleContainerEdges[0].source).toBe(
					getProviderToken(valueProvider),
				);
				expect(testModuleContainerEdges[0].target).toBe(
					testModuleContainer.token,
				);
				expect(testModuleContainerEdges[0].metadata).toEqual({
					isCircular: false,
					unreached: false,
				});
			});
		});

		describe("Dependencies", () => {
			it("should resolve dependencies from value providers in different modules, including those exported from a parent and through one level of nesting", async () => {
				const valueProviderA = {
					provide: "CONFIG_A",
					useValue: { key: "valueA" },
				};

				const valueProviderB = {
					provide: "CONFIG_B",
					useValue: { key: "valueB" },
				};

				@Injectable()
				class AppService {
					constructor(
						@Inject("CONFIG_A")
						private readonly configA: (typeof valueProviderA)["useValue"],
						@Inject("CONFIG_B")
						private readonly configB: (typeof valueProviderB)["useValue"],
					) {}
				}

				@NsModule({
					providers: [valueProviderA, valueProviderB, AppService],
				})
				class AppModule {}

				const moduleContainerFactory = new ModuleContainerFactory(
					moduleTokenFactory,
				);
				const childModuleContainer = await moduleContainerFactory.create(
					AppModule,
					container,
				);
				const graph = new ModuleGraph(childModuleContainer);

				await graph.compile();

				const nodes = graph.nodes;
				const edges = graph.edges;

				expect(nodes.size).toBe(4);

				const AppServiceEdge = edges.get(getProviderToken(AppService));

				expect(AppServiceEdge).toEqual([
					{
						type: "dependency",
						source: getProviderToken(AppService),
						target: valueProviderA.provide,
						metadata: {
							index: 0,
							inject: "constructor",
							isCircular: false,
							unreached: false,
						},
					},
					{
						type: "dependency",
						source: getProviderToken(AppService),
						target: valueProviderB.provide,
						metadata: {
							index: 1,
							inject: "constructor",
							isCircular: false,
							unreached: false,
						},
					},
				]);
			});
		});
	});

	describe("Class Providers", () => {
		describe("Providers", () => {
			class TestProvider {}

			const classProvider = {
				provide: "CLASS_PROVIDER",
				useClass: TestProvider,
			};

			@NsModule({
				providers: [classProvider],
				exports: [classProvider.provide],
			})
			class TestModule {}

			it("should set provider edge", async () => {
				@NsModule({
					imports: [TestModule],
				})
				class AppModule {}

				const appModuleContainer = await moduleContainerFactory.create(
					AppModule,
					container,
				);
				const graph = new ModuleGraph(appModuleContainer);

				await graph.compile();

				const nodes = graph.nodes;

				expect(nodes.size).toBe(3);
			});

			it("should create edge for Class Provider", async () => {
				@Injectable()
				class AppService {
					constructor(
						@Inject("CLASS_PROVIDER")
						private readonly testProvider: TestProvider,
					) {}
				}

				@NsModule({
					imports: [TestModule],
					providers: [AppService],
				})
				class AppModule {}

				const appModuleContainer = await moduleContainerFactory.create(
					AppModule,
					container,
				);
				const graph = new ModuleGraph(appModuleContainer);

				await graph.compile();

				const classProviderNode = graph.getNode(
					getProviderToken(classProvider),
				);

				expect(classProviderNode.metatype).toBe(classProvider);

				const AppServiceEdges = graph.getEdge(AppService);

				expect(AppServiceEdges).toEqual([
					{
						type: "dependency",
						source: AppService,
						target: "CLASS_PROVIDER",
						metadata: {
							index: 0,
							inject: "constructor",
							isCircular: false,
							unreached: false,
						},
					},
				]);
			});
		});
	});

	describe("Factory Providers", () => {
		it("should set factory provider edge", async () => {
			const factoryProvider = {
				provide: "FACTORY_PROVIDER",
				useFactory: () => ({ key: "value" }),
			};

			@Injectable()
			class AppService {
				constructor(
					@Inject("FACTORY_PROVIDER")
					private readonly config: ReturnType<
						(typeof factoryProvider)["useFactory"]
					>,
				) {}
			}

			@NsModule({
				providers: [factoryProvider, AppService],
			})
			class AppModule {}

			const appModuleContainer = await moduleContainerFactory.create(
				AppModule,
				container,
			);
			const graph = new ModuleGraph(appModuleContainer);

			await graph.compile();

			const nodes = graph.nodes;
			const edges = graph.edges;

			expect(nodes.size).toBe(3);

			const appServiceProviderEdge = edges.get(getProviderToken(AppService));

			expect(appServiceProviderEdge).toEqual([
				{
					type: "dependency",
					source: getProviderToken(AppService),
					target: factoryProvider.provide,
					metadata: {
						index: 0,
						inject: "constructor",
						isCircular: false,
						unreached: false,
					},
				},
			]);
		});

		it("should correctly resolve factory provider dependencies", async () => {
			@Injectable()
			class ServiceB {}

			const factoryProvider = {
				provide: "FACTORY_PROVIDER",
				useFactory: (serviceB: ServiceB) => ({
					key: "value",
					service: serviceB,
				}),
				inject: [ServiceB],
			};

			@NsModule({
				providers: [factoryProvider, ServiceB],
			})
			class AppModule {}

			const appModuleContainer = await moduleContainerFactory.create(
				AppModule,
				container,
			);
			const graph = new ModuleGraph(appModuleContainer);

			await graph.compile();

			const nodes = graph.nodes;
			const edges = graph.edges;

			expect(nodes.size).toBe(3);

			const appFactoryProviderEdge = edges.get("FACTORY_PROVIDER");

			expect(appFactoryProviderEdge).toEqual([
				{
					type: "dependency",
					source: "FACTORY_PROVIDER",
					target: ServiceB,
					metadata: {
						index: 0,
						inject: "constructor",
						isCircular: false,
						unreached: false,
					},
				},
			]);
		});

		it("should resolve dependencies from different modules", async () => {
			@Injectable()
			class ServiceB {}

			const factoryProvider = {
				provide: "FACTORY_PROVIDER",
				useFactory: (serviceB: ServiceB) => ({
					key: "value",
					service: serviceB,
				}),
				inject: [ServiceB],
			};

			@NsModule({
				providers: [ServiceB, factoryProvider],
				exports: [factoryProvider.provide],
			})
			class FactoryModule {}

			@Injectable()
			class AppService {
				constructor(
					@Inject("FACTORY_PROVIDER")
					private readonly config: ReturnType<
						(typeof factoryProvider)["useFactory"]
					>,
				) {}
			}

			@NsModule({
				imports: [FactoryModule],
				providers: [AppService],
			})
			class AppModule {}

			const appModuleContainer = await moduleContainerFactory.create(
				AppModule,
				container,
			);
			const graph = new ModuleGraph(appModuleContainer);

			await graph.compile();

			const nodes = graph.nodes;
			const edges = graph.edges;

			expect(nodes.size).toBe(5);

			const factoryProviderEdges = edges.get("FACTORY_PROVIDER");

			expect(factoryProviderEdges).toEqual([
				{
					type: "dependency",
					source: "FACTORY_PROVIDER",
					target: ServiceB,
					metadata: {
						unreached: false,
						isCircular: false,
						index: 0,
						inject: "constructor",
					},
				},
			]);
		});
	});

	describe("Global Modules", () => {
		class GlobalService {}

		@Global()
		@NsModule({
			providers: [GlobalService],
			exports: [GlobalService],
		})
		class GlobalModule {}

		@NsModule({
			imports: [GlobalModule],
		})
		class ProxyModule {}

		@Injectable()
		class ServiceA {
			constructor(
				@Inject(GlobalService) private readonly globalService: GlobalService,
			) {}
		}

		@NsModule({
			providers: [ServiceA],
		})
		class ModuleA {}

		@NsModule({
			imports: [ProxyModule, ModuleA],
		})
		class AppModule {}

		it("should correctly handle global modules", async () => {
			const appModuleContainer = await moduleContainerFactory.create(
				AppModule,
				container,
			);
			const globalModuleContainer = await moduleContainerFactory.create(
				GlobalModule,
				container,
			);

			const graph = new ModuleGraph(appModuleContainer);
			await graph.compile();

			const nodes = graph.nodes;
			const edges = graph.edges;

			const globalModuleNode = graph.getNode(globalModuleContainer.token);

			const serviceAEdges = edges.get(getProviderToken(ServiceA));

			expect(nodes.size).toBe(6);
			expect(
				globalModuleNode.type === "module" && globalModuleNode.isGlobal,
			).toBe(true);
			expect(serviceAEdges).toEqual([
				{
					type: "dependency",
					source: ServiceA,
					target: GlobalService,
					metadata: {
						index: 0,
						inject: "constructor",
						isCircular: false,
						unreached: false,
					},
				},
			]);
		});
	});

	describe("DynamicModule", () => {
		it("should correct resolve forFeature module declaration", async () => {
			const featureConfig = {
				provide: "FEATURE_CONFIG",
				useValue: { feature: true },
			};

			@NsModule({})
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

			const nodes = graph.nodes;
			const featureConfigProvider = nodes.get("FEATURE_CONFIG");

			expect(featureConfigProvider?.metatype).toBe(featureConfig);
		});

		it("should correct resolve forFeatureAsync module declaration", async () => {
			const featureConfigAsync = {
				provide: "FEATURE_CONFIG",
				useFactory: async () => ({ feature: true }),
			};

			@NsModule({})
			class FeatureModule {
				static forFeatureAsync(): DynamicModule {
					return {
						module: FeatureModule,
						imports: [],
						providers: [featureConfigAsync],
					};
				}
			}

			const moduleContainer = await moduleContainerFactory.create(
				FeatureModule.forFeatureAsync(),
				container,
			);
			const graph = new ModuleGraph(moduleContainer);
			await graph.compile();

			const nodes = graph.nodes;
			const featureConfigProvider = nodes.get("FEATURE_CONFIG");

			expect(featureConfigProvider?.metatype).toBe(featureConfigAsync);
		});
	});
});
