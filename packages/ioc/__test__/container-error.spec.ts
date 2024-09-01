import { Test } from "../../testing/src";
import {
	type ContainerInterface,
	Inject,
	Injectable,
	type ModuleContainerInterface,
	NsModule,
	type Type,
} from "../src";
import { ModuleGraph } from "../src/core/graph/module-graph";
import { ModuleContainerFactory } from "../src/core/modules/module-container-factory";
import { ModuleTokenFactory } from "../src/core/modules/module-token-factory";
import { hashUtilsMock } from "./hashUtils.mock";

describe("Container error", () => {
	const moduleTokenFactory = new ModuleTokenFactory(hashUtilsMock);
	const moduleContainerFactory = new ModuleContainerFactory(moduleTokenFactory);
	const container = {
		async addModule(
			metatype: Type<unknown>,
		): Promise<ModuleContainerInterface> {
			return await moduleContainerFactory.create(metatype, container);
		},
	} as ContainerInterface;

	it("should return modules circular dependency errors", async () => {
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

		const graph = new ModuleGraph(mockModuleContainer);
		await graph.compile();

		expect(graph.errors).toEqual([
			{
				path: ["TestModule", "AnotherImportedModule", "ImportedModule"],
				type: "CD_IMPORTS",
			},
			{
				path: ["AnotherImportedModule", "ImportedModule", "TestModule"],
				type: "CD_IMPORTS",
			},
			{
				path: ["ImportedModule", "TestModule", "AnotherImportedModule"],
				type: "CD_IMPORTS",
			},
		]);
	});

	it("should return Providers circular dependency errors", async () => {
		// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
		interface ITestService {}
		// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
		interface ISecondService {}
		// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
		interface IThirdService {}

		@Injectable()
		class ThirdService implements IThirdService {
			constructor(
				@Inject("TestService")
				private readonly dependencyService: ITestService,
			) {}
		}

		@Injectable()
		class SecondService implements ISecondService {
			constructor(
				@Inject("ThirdService")
				private readonly thirdService: ThirdService,
			) {}
		}

		@Injectable()
		class TestService implements ITestService {
			constructor(
				@Inject("SecondService")
				private readonly dependencyService: ISecondService,
			) {}
		}

		const container = await Test.createModule({
			providers: [
				{
					useClass: TestService,
					provide: "TestService",
				},
				{
					useClass: SecondService,
					provide: "SecondService",
				},
				{
					useClass: ThirdService,
					provide: "ThirdService",
				},
			],
		}).compile();

		expect(container.errors).toEqual([
			{
				path: [
					["TestService", "SecondService"],
					["SecondService", "ThirdService"],
					["ThirdService", "TestService"],
				],
				type: "CD_PROVIDERS",
			},
			{
				path: [
					["SecondService", "ThirdService"],
					["ThirdService", "TestService"],
					["TestService", "SecondService"],
				],
				type: "CD_PROVIDERS",
			},
			{
				path: [
					["ThirdService", "TestService"],
					["TestService", "SecondService"],
					["SecondService", "ThirdService"],
				],
				type: "CD_PROVIDERS",
			},
		]);
	});

	it("should return Providers unreached constructor dependency errors", async () => {
		@Injectable()
		class DependencyService {}

		@Injectable()
		class TestService {
			constructor(
				@Inject(DependencyService)
				private readonly dependencyService: DependencyService,
			) {}
		}

		const container = await Test.createModule({
			providers: [TestService],
		}).compile();

		expect(container.errors).toEqual([
			{
				dependency: "DependencyService",
				position: 0,
				token: "TestService",
				type: "UNREACHED_DEP_CONSTRUCTOR",
			},
		]);
	});

	it("should return Providers unreached property dependency errors", async () => {
		@Injectable()
		class DependencyService {}

		@Injectable()
		class TestService {
			// @ts-ignore
			@Inject(DependencyService)
			private readonly dependencyService: DependencyService | null = null;
		}

		const container = await Test.createModule({
			providers: [TestService],
		}).compile();

		expect(container.errors).toEqual([
			{
				dependency: "DependencyService",
				key: "dependencyService",
				token: "TestService",
				type: "UNREACHED_DEP_PROPERTY",
			},
		]);
	});

	it("should return useFactory inject unreached dependency errors", async () => {
		const container = await Test.createModule({
			providers: [
				{
					useFactory() {},
					provide: "factory",
					inject: ["foo"],
				},
			],
		}).compile();

		expect(container.errors).toEqual([
			{
				dependency: "foo",
				key: 0,
				token: "factory",
				type: "UNREACHED_DEP_FACTORY",
			},
		]);
	});
});
