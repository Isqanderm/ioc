import "reflect-metadata";
import {
	BootstrapError,
	EdgeTypeEnum,
	Inject,
	Injectable,
	lazy,
	Module,
	NexusApplication,
	NodeTypeEnum,
} from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

describe("bootstrap with lazy imports", () => {
	@Injectable()
	class FeatureService {}

	@Module({ providers: [FeatureService], exports: [FeatureService] })
	class FeatureModule {}

	it("adds a LAZY placeholder node and edge, and does not load the module", async () => {
		const loader = vi.fn(async () => FeatureModule);
		const FeatureLazy = lazy(loader, { name: "Feature" });

		@Module({ imports: [FeatureLazy] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);

		const node = container.graph.getNode(FeatureLazy.id);
		expect(node?.type).toBe(NodeTypeEnum.LAZY);
		expect(node?.label).toBe("Feature");
		expect((node as { loaded: boolean }).loaded).toBe(false);

		const root = await container.getModule(AppModule);
		const lazyEdges = container.graph
			.getEdge(root?.token)
			.filter((e) => e.type === EdgeTypeEnum.LAZY);
		expect(lazyEdges).toHaveLength(1);
		expect(lazyEdges[0].target).toBe(FeatureLazy.id);
		expect(loader).not.toHaveBeenCalled();
		expect(container.graph.getNode(FeatureService)).toBeUndefined();
	});

	it("reports an eager provider that depends on a lazy module's provider", async () => {
		const FeatureLazy = lazy(async () => FeatureModule);

		@Injectable()
		class RootService {
			constructor(@Inject(FeatureService) readonly feature: FeatureService) {}
		}

		@Module({ imports: [FeatureLazy], providers: [RootService] })
		class AppModule {}

		const app = NexusApplication.create(AppModule);
		await expect(app.bootstrap()).rejects.toThrow(BootstrapError);
		expect(app.errors).toEqual([
			expect.objectContaining({
				type: "UNREACHED_DEP_CONSTRUCTOR",
				token: "RootService",
				dependency: "FeatureService",
			}),
		]);
	});

	it("shares one placeholder when two modules import the same lazy ref", async () => {
		const FeatureLazy = lazy(async () => FeatureModule);

		@Module({ imports: [FeatureLazy] })
		class AModule {}
		@Module({ imports: [FeatureLazy] })
		class BModule {}
		@Module({ imports: [AModule, BModule] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		const lazyNodes = container.graph
			.getAllNodes()
			.filter((n) => n.type === NodeTypeEnum.LAZY);
		expect(lazyNodes).toHaveLength(1);
	});
});
