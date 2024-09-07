import { Test } from "nexus-ioc-testing";
import {
	type ContainerInterface,
	Inject,
	Injectable,
	type InjectionToken,
	type ModuleContainerInterface,
	NsModule,
	type Type,
} from "../../src";
import { ModuleGraph } from "../../src/core/graph/module-graph";
import { ModuleContainerFactory } from "../../src/core/modules/module-container-factory";
import { ModuleTokenFactory } from "../../src/core/modules/module-token-factory";
import { hashUtilsMock } from "../hashUtils.mock";

function createTestContainerFactory() {
	const moduleTokenFactory = new ModuleTokenFactory(hashUtilsMock);
	const moduleContainerFactory = new ModuleContainerFactory(moduleTokenFactory);
	const container = {
		addModule(metatype: Type<unknown>): Promise<ModuleContainerInterface> {
			return moduleContainerFactory.create(metatype, container);
		},
	} as ContainerInterface;

	return async function createTestModuleContainer(module: Type) {
		return moduleContainerFactory.create(module, container);
	};
}

describe("Export Hierarchy", () => {
	it("should correct resolve hierarchy dependency", async () => {
		@NsModule({
			providers: [
				{
					provide: "hash",
					useFactory: () => {
						return "hash-string";
					},
				},
			],
			exports: ["hash"],
		})
		class ThirdPartyNestModule {}

		@NsModule({
			imports: [ThirdPartyNestModule],
			providers: [
				{
					provide: "secret",
					useValue: "secret-key",
				},
			],
			exports: ["secret", ThirdPartyNestModule],
		})
		class ThirdPartyModule {}

		@Injectable()
		class DependencyService {
			constructor(
				@Inject("secret") public readonly secret: string,
				@Inject("hash") public readonly hash: string,
			) {}
		}

		@NsModule({
			imports: [ThirdPartyModule],
			providers: [DependencyService],
			exports: [DependencyService],
		})
		class DependencyModule {}

		@Injectable()
		class AppService {
			constructor(
				@Inject(DependencyService)
				public readonly dependencyService: DependencyService,
				@Inject("secret") public readonly secret: string,
			) {}
		}

		@NsModule({
			imports: [DependencyModule],
			providers: [AppService],
		})
		class AppModule {}

		// const containerFactory = createTestContainerFactory();
		// const appModuleContainer = await containerFactory(AppModule);
		// const graph = new ModuleGraph(appModuleContainer);
		//
		// await graph.compile();
		//
		// console.log("graph: ", graph.edges);

		const appContainer = await Test.createModule({
			imports: [DependencyModule],
			providers: [AppService],
		}).compile();

		const appService = await appContainer.get<AppService>(AppService);

		console.log("appService: ", appService, appContainer.errors);

		expect(appService?.dependencyService?.secret).toEqual("secret-key");
		expect(appService?.secret).toBeFalsy();
	});
});
