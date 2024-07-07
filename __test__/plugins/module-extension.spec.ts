import "reflect-metadata";
import {
	Injectable,
	type ModuleMetadata,
	Module as NexusModule,
	type Node,
	type Provider,
	type ScannerGraphInterface,
	type ScannerPluginInterface,
	Scope,
} from "../../src";
import { TestingContainer } from "../../src/testing-utils";

interface ModuleExtensionSpec extends ModuleMetadata {
	controllers: Provider[];
}

const CONTROLLERS = "__controllers__";

function ModuleWithControllers(metadata: ModuleExtensionSpec): ClassDecorator {
	const { controllers, ...rest } = metadata;

	return (target) => {
		const moduleMetadata: ModuleMetadata = {
			...rest,
			providers: [...(rest.providers || []), ...controllers],
		};

		NexusModule(moduleMetadata)(target);
	};
}

function Controller(): ClassDecorator {
	return (target) => {
		Reflect.defineMetadata(CONTROLLERS, true, target);
		Injectable({ scope: Scope.Singleton })(target);
	};
}

describe("Module extension", () => {
	it("should resolve controller", async () => {
		class ControllerScanner implements ScannerPluginInterface {
			public readonly controllers: Node[] = [];

			async scan(graph: ScannerGraphInterface): Promise<void> {
				const nodes = graph.getAllNodes();

				for (const node of nodes) {
					if (
						node.type === "provider" &&
						Reflect.getMetadata(CONTROLLERS, node.metatype)
					) {
						this.controllers.push(node);
					}
				}
			}
		}

		const controllerScanner = new ControllerScanner();

		@Controller()
		class AppController {}

		const container =
			await TestingContainer.createTestingContainer<ModuleExtensionSpec>({
				controllers: [AppController],
			})
				.setModuleDecorator(ModuleWithControllers)
				.addScannerPlugin(controllerScanner)
				.compile();

		const appController = await container.get<AppController>(AppController);

		expect(appController).toBeInstanceOf(AppController);
		expect(controllerScanner.controllers).toHaveLength(1);
	});
});
