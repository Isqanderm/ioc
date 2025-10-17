import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import {
	Injectable,
	type ModuleMetadata,
	NsModule as NexusModule,
	type Node,
	type Provider,
	type ScannerGraphInterface,
	type ScannerPluginInterface,
	Scope,
} from "../../src";

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

		const container = await Test.createModule<ModuleExtensionSpec>({
			controllers: [AppController],
		})
			.setModuleDecorator(ModuleWithControllers)
			// @ts-expect-error
			.addScannerPlugin(controllerScanner)
			.compile();

		const appController = await container.get<AppController>(AppController);

		expect(appController).toBeInstanceOf(AppController);
		expect(controllerScanner.controllers).toHaveLength(1);
	});
});
