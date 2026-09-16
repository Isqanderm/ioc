import "reflect-metadata";
import {
	Global,
	Inject,
	Injectable,
	lazy,
	Module,
	type ModuleContainerInterface,
	NodeTypeEnum,
} from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

describe("ModuleGraph.compileSegment", () => {
	@Injectable()
	class SharedService {}
	@Module({ providers: [SharedService], exports: [SharedService] })
	class SharedModule {}

	@Injectable()
	class FeatureService {
		constructor(@Inject(SharedService) readonly shared: SharedService) {}
	}
	@Module({
		imports: [SharedModule],
		providers: [FeatureService],
		exports: [FeatureService],
	})
	class FeatureModule {}

	async function bootstrapWith(FeatureLazy: ReturnType<typeof lazy>) {
		@Module({ imports: [SharedModule, FeatureLazy] })
		class AppModule {}
		const container = new Container(new HashUtil());
		await container.run(AppModule);
		return container;
	}

	it("adds only the new module and providers, reusing already registered modules", async () => {
		const FeatureLazy = lazy(async () => FeatureModule);
		const container = await bootstrapWith(FeatureLazy);
		const nodesBefore = container.graph.getAllNodes().length;

		const mc = await container.addModule(FeatureModule);
		const segment = await container.graph.compileSegment(mc, FeatureLazy);

		expect(segment.errors).toEqual([]);
		expect(segment.moduleTokens).toEqual([mc.token]);
		expect(segment.providerTokens).toEqual([FeatureService]);
		expect(container.graph.getAllNodes().length).toBe(nodesBefore + 2); // FeatureModule node + FeatureService node
		expect(container.graph.getNode(FeatureService)?.type).toBe(
			NodeTypeEnum.PROVIDER,
		);

		const placeholder = container.graph.getNode(FeatureLazy.id) as {
			loaded: boolean;
			moduleToken: string | null;
		};
		expect(placeholder.loaded).toBe(true);
		expect(placeholder.moduleToken).toBe(mc.token);
	});

	it("resolves the loaded provider through the container", async () => {
		const FeatureLazy = lazy(async () => FeatureModule);
		const container = await bootstrapWith(FeatureLazy);
		const mc = await container.addModule(FeatureModule);
		await container.graph.compileSegment(mc, FeatureLazy);

		const feature = await container.get<FeatureService>(FeatureService);
		const shared = await container.get<SharedService>(SharedService);
		expect(feature).toBeInstanceOf(FeatureService);
		expect(feature?.shared).toBe(shared);
	});

	it("rolls back the whole segment on a missing dependency", async () => {
		@Injectable()
		class BrokenService {
			constructor(@Inject("MISSING") readonly missing: unknown) {}
		}
		@Module({ providers: [BrokenService] })
		class BrokenModule {}
		const BrokenLazy = lazy(async () => BrokenModule);
		const container = await bootstrapWith(BrokenLazy);
		const errorsBefore = container.errors.length;
		const nodesBefore = container.graph.getAllNodes().length;

		const mc = await container.addModule(BrokenModule);
		const segment = await container.graph.compileSegment(mc, BrokenLazy);

		expect(segment.errors).toEqual([
			expect.objectContaining({
				type: "UNREACHED_DEP_CONSTRUCTOR",
				dependency: "MISSING",
			}),
		]);
		expect(container.graph.getAllNodes().length).toBe(nodesBefore);
		expect(container.graph.getNode(BrokenService)).toBeUndefined();
		expect(container.graph.getEdge(mc.token)).toEqual([]);
		expect(container.errors.length).toBe(errorsBefore);
		const placeholder = container.graph.getNode(BrokenLazy.id) as {
			loaded: boolean;
		};
		expect(placeholder.loaded).toBe(false);
	});

	it("reports PROVIDER_TOKEN_CONFLICT when a segment re-registers an existing token", async () => {
		@Injectable()
		class OtherShared {}
		@Module({ providers: [{ provide: SharedService, useClass: OtherShared }] })
		class ConflictModule {}
		const ConflictLazy = lazy(async () => ConflictModule, {
			name: "Conflict",
		});
		const container = await bootstrapWith(ConflictLazy);
		const sharedNode = container.graph.getNode(SharedService);

		const mc = await container.addModule(ConflictModule);
		const segment = await container.graph.compileSegment(mc, ConflictLazy);

		expect(segment.errors).toEqual([
			{
				type: "PROVIDER_TOKEN_CONFLICT",
				token: "SharedService",
				module: "ConflictModule",
				existingModule: "SharedModule",
			},
		]);
		expect(container.graph.getNode(SharedService)).toBe(sharedNode);
	});

	it("detects a cycle that goes through segment providers", async () => {
		@Injectable()
		class CycleA {
			constructor(@Inject("CycleB") readonly b: unknown) {}
		}
		@Injectable()
		class CycleB {
			constructor(@Inject(CycleA) readonly a: CycleA) {}
		}
		@Module({ providers: [CycleA, { provide: "CycleB", useClass: CycleB }] })
		class CycleModule {}
		const CycleLazy = lazy(async () => CycleModule);
		const container = await bootstrapWith(CycleLazy);

		const mc = await container.addModule(CycleModule);
		const segment = await container.graph.compileSegment(mc, CycleLazy);
		expect(segment.errors.map((e) => e.type)).toContain("CD_PROVIDERS");
	});

	it("removes the nested lazy placeholders a failed segment created", async () => {
		const NestedLazy = lazy(async () => FeatureModule, { name: "Nested" });
		@Injectable()
		class NestedBrokenService {
			constructor(@Inject("MISSING_NESTED") readonly missing: unknown) {}
		}
		@Module({ imports: [NestedLazy], providers: [NestedBrokenService] })
		class NestedBrokenModule {}
		const NestedBrokenLazy = lazy(async () => NestedBrokenModule);
		const container = await bootstrapWith(NestedBrokenLazy);
		const nodesBefore = container.graph.getAllNodes().length;

		const mc = await container.addModule(NestedBrokenModule);
		const segment = await container.graph.compileSegment(mc, NestedBrokenLazy);

		expect(segment.errors.length).toBeGreaterThan(0);
		expect(container.graph.getNode(NestedLazy.id)).toBeUndefined();
		expect(container.graph.getAllNodes().length).toBe(nodesBefore);
		// the placeholder that existed before the segment must survive
		expect(container.graph.getNode(NestedBrokenLazy.id)?.type).toBe(
			NodeTypeEnum.LAZY,
		);
	});

	it("removes the placeholder it created for an undeclared ref when the segment fails", async () => {
		@Injectable()
		class LooseBrokenService {
			constructor(@Inject("MISSING_LOOSE") readonly missing: unknown) {}
		}
		@Module({ providers: [LooseBrokenService] })
		class LooseBrokenModule {}
		@Module({ imports: [SharedModule] })
		class AppModule {}
		const container = new Container(new HashUtil());
		await container.run(AppModule);
		const nodesBefore = container.graph.getAllNodes().length;
		const UndeclaredBroken = lazy(async () => LooseBrokenModule, {
			name: "UndeclaredBroken",
		});

		const mc = await container.addModule(LooseBrokenModule);
		const segment = await container.graph.compileSegment(mc, UndeclaredBroken);

		expect(segment.errors.length).toBeGreaterThan(0);
		expect(container.graph.getNode(UndeclaredBroken.id)).toBeUndefined();
		expect(container.graph.getAllNodes().length).toBe(nodesBefore);
	});

	it("unregisters a global module declared by a failed segment", async () => {
		@Injectable()
		class GlobalOnlyService {}
		@Injectable()
		class GlobalBrokenService {
			constructor(@Inject("MISSING_GLOBAL") readonly missing: unknown) {}
		}
		@Global()
		@Module({
			providers: [GlobalOnlyService, GlobalBrokenService],
			exports: [GlobalOnlyService],
		})
		class GlobalBrokenModule {}
		const GlobalLazy = lazy(async () => GlobalBrokenModule, {
			name: "GlobalBroken",
		});
		const container = await bootstrapWith(GlobalLazy);
		const sharedContainer = (await container.getModule(
			SharedModule,
		)) as ModuleContainerInterface;

		const mc = await container.addModule(GlobalBrokenModule);
		const segment = await container.graph.compileSegment(mc, GlobalLazy);

		expect(segment.errors.length).toBeGreaterThan(0);
		expect(container.graph.getNode(mc.token)).toBeUndefined();
		expect(
			await container.graph.isProviderExported(
				sharedContainer,
				GlobalOnlyService,
			),
		).toBe(false);
	});

	it("creates a placeholder for a ref that no module declared", async () => {
		const Undeclared = lazy(async () => FeatureModule, {
			name: "Undeclared",
		});
		@Module({ imports: [SharedModule] })
		class AppModule {}
		const container = new Container(new HashUtil());
		await container.run(AppModule);

		const mc = await container.addModule(FeatureModule);
		const segment = await container.graph.compileSegment(mc, Undeclared);
		expect(segment.errors).toEqual([]);
		expect(container.graph.getNode(Undeclared.id)?.type).toBe(
			NodeTypeEnum.LAZY,
		);
	});
});
