import { Test } from "nexus-ioc-testing";
import {
	type Edge,
	EdgeTypeEnum,
	type GraphPluginInterface,
	Inject,
	Injectable,
	type ModuleContainerInterface,
	type ModuleGraphPlugin,
	type Node,
	NodeTypeEnum,
	NsModule,
} from "../../src";

describe("Graph plugins", () => {
	describe("onAddModuleNode", () => {
		let container: Test;
		beforeEach(() => {
			@Injectable()
			class AppService {}

			container = Test.createModule({
				providers: [AppService],
			});
		});

		it("should be called", async () => {
			const moduleNodeMock = jest.fn();

			class GraphPlugin implements GraphPluginInterface {
				onAddModuleNode<T extends Node>(node: T): T {
					moduleNodeMock(node);
					return node;
				}
			}

			await container.addGraphPlugin(new GraphPlugin()).compile();

			expect(moduleNodeMock).toBeCalledTimes(1);
			expect(moduleNodeMock).toBeCalledWith(
				expect.objectContaining({
					type: NodeTypeEnum.MODULE,
				}),
			);
		});
	});

	describe("onAddModuleImportEdge", () => {
		let container: Test;
		beforeEach(() => {
			@NsModule({})
			class ImportModule {}

			@Injectable()
			class AppService {}

			container = Test.createModule({
				imports: [ImportModule],
				providers: [AppService],
			});
		});

		it("should be called", async () => {
			const moduleImportEdgeMock = jest.fn();

			class GraphPlugin implements GraphPluginInterface {
				onAddModuleImportEdge<T extends Edge>(edge: T): T {
					moduleImportEdgeMock(edge);
					return edge;
				}
			}

			await container.addGraphPlugin(new GraphPlugin()).compile();

			expect(moduleImportEdgeMock).toBeCalledTimes(1);
			expect(moduleImportEdgeMock).toBeCalledWith(
				expect.objectContaining({
					type: EdgeTypeEnum.IMPORT,
				}),
			);
		});
	});

	describe("onAddProviderNode", () => {
		let container: Test;
		beforeEach(() => {
			@NsModule({})
			class ImportModule {}

			@Injectable()
			class AppService {}

			container = Test.createModule({
				imports: [ImportModule],
				providers: [AppService],
			});
		});

		it("should be called", async () => {
			const moduleImportEdgeMock = jest.fn();

			class GraphPlugin implements GraphPluginInterface {
				onAddProviderNode<T extends Node>(node: T): T {
					moduleImportEdgeMock(node);
					return node;
				}
			}

			await container.addGraphPlugin(new GraphPlugin()).compile();

			expect(moduleImportEdgeMock).toBeCalledTimes(1);
			expect(moduleImportEdgeMock).toBeCalledWith(
				expect.objectContaining({
					type: EdgeTypeEnum.PROVIDER,
				}),
			);
		});
	});

	describe("onAddProviderEdge", () => {
		let container: Test;
		beforeEach(() => {
			@Injectable()
			class AppService {}

			container = Test.createModule({
				providers: [AppService],
			});
		});

		it("should be called", async () => {
			const moduleImportEdgeMock = jest.fn();

			class GraphPlugin implements GraphPluginInterface {
				onAddProviderEdge<T extends Edge>(edge: T): T {
					moduleImportEdgeMock(edge);
					return edge;
				}
			}

			await container.addGraphPlugin(new GraphPlugin()).compile();

			expect(moduleImportEdgeMock).toBeCalledTimes(1);
			expect(moduleImportEdgeMock).toBeCalledWith(
				expect.objectContaining({
					type: EdgeTypeEnum.PROVIDER,
				}),
			);
		});
	});

	describe("parseModule", () => {
		let container: Test;
		beforeEach(() => {
			@NsModule({})
			class ImportModule {}

			@Injectable()
			class AppService {}

			container = Test.createModule({
				imports: [ImportModule],
				providers: [AppService],
			});
		});

		it("should be called", async () => {
			const moduleImportEdgeMock = jest.fn();

			class GraphPlugin implements GraphPluginInterface {
				parseModule<
					T extends ModuleContainerInterface = ModuleContainerInterface,
				>(module: T, graph: ModuleGraphPlugin) {
					moduleImportEdgeMock(module, graph);
				}
			}

			await container.addGraphPlugin(new GraphPlugin()).compile();

			expect(moduleImportEdgeMock).toBeCalledTimes(2);
			expect(moduleImportEdgeMock).toBeCalledWith(
				expect.objectContaining({
					token: expect.any(String),
				}),
				expect.objectContaining({
					addEdge: expect.any(Function),
					addNode: expect.any(Function),
					getNode: expect.any(Function),
					getEdge: expect.any(Function),
				}),
			);
		});
	});

	describe("onAddUseFactoryDependency", () => {
		let container: Test;
		beforeEach(() => {
			@Injectable()
			class AppService {
				answer = 42;
			}

			container = Test.createModule({
				providers: [
					AppService,
					{
						provide: "FACTORY",
						useFactory: (appService: AppService) => appService.answer,
						inject: [AppService],
					},
				],
			});
		});

		it("should be called", async () => {
			const moduleImportEdgeMock = jest.fn();

			class GraphPlugin implements GraphPluginInterface {
				onAddUseFactoryDependency<T extends Edge>(edge: T): T {
					moduleImportEdgeMock(edge);
					return edge;
				}
			}

			await container.addGraphPlugin(new GraphPlugin()).compile();

			expect(moduleImportEdgeMock).toBeCalledTimes(1);
			expect(moduleImportEdgeMock).toBeCalledWith(
				expect.objectContaining({
					type: EdgeTypeEnum.DEPENDENCY,
				}),
			);
		});
	});

	describe("onAddUseClassDependency", () => {
		let container: Test;
		beforeEach(() => {
			@Injectable()
			class DepsService {}

			@Injectable()
			class AppService {
				constructor(
					@Inject(DepsService) private readonly depsService: DepsService,
				) {}
			}

			container = Test.createModule({
				providers: [
					DepsService,
					{
						provide: "AppService",
						useClass: AppService,
					},
				],
			});
		});

		it("should be called", async () => {
			const moduleImportEdgeMock = jest.fn();

			class GraphPlugin implements GraphPluginInterface {
				onAddUseClassDependency<T extends Edge>(edge: T): T {
					moduleImportEdgeMock(edge);
					return edge;
				}
			}

			await container.addGraphPlugin(new GraphPlugin()).compile();

			expect(moduleImportEdgeMock).toBeCalledTimes(1);
			expect(moduleImportEdgeMock).toBeCalledWith(
				expect.objectContaining({
					type: EdgeTypeEnum.DEPENDENCY,
				}),
			);
		});
	});

	describe("onAddClassDependency", () => {
		let container: Test;
		beforeEach(() => {
			@Injectable()
			class DepsService {}

			@Injectable()
			class AppService {
				constructor(
					@Inject(DepsService) private readonly depsService: DepsService,
				) {}
			}

			container = Test.createModule({
				providers: [DepsService, AppService],
			});
		});

		it("should be called", async () => {
			const moduleImportEdgeMock = jest.fn();

			class GraphPlugin implements GraphPluginInterface {
				onAddClassDependency<T extends Edge>(edge: T): T {
					moduleImportEdgeMock(edge);
					return edge;
				}
			}

			await container.addGraphPlugin(new GraphPlugin()).compile();

			expect(moduleImportEdgeMock).toBeCalledTimes(1);
			expect(moduleImportEdgeMock).toBeCalledWith(
				expect.objectContaining({
					type: EdgeTypeEnum.DEPENDENCY,
				}),
			);
		});
	});
});
