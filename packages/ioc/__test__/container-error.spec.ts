import { Test } from "nexus-ioc-testing";
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

	// it("should return Providers unreached deps", async () => {
	// 	@Injectable()
	// 	class DependencyService {}
	//
	// 	@Injectable()
	// 	class TestService {
	// 		constructor(
	// 			@Inject() private readonly dependencyService: DependencyService,
	// 		) {}
	// 	}
	//
	// 	const container = await Test.createModule({
	// 		providers: [TestService],
	// 	}).compile();
	//
	// 	container.error;
	// });
});
