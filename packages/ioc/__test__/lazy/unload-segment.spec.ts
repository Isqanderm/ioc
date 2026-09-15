import "reflect-metadata";
import { Global, Inject, Injectable, lazy, Module } from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

describe("ModuleGraph.unloadSegment", () => {
	@Injectable()
	class FeatureService {}
	@Module({ providers: [FeatureService], exports: [FeatureService] })
	class FeatureModule {}

	async function ready() {
		const container = new Container(new HashUtil());
		@Module({})
		class AppModule {}
		await container.run(AppModule);
		return container;
	}

	it("destroys an exclusively owned segment and resets the placeholder", async () => {
		const container = await ready();
		@Module({ imports: [FeatureModule] })
		class Root {}
		const FeatureLazy = lazy(async () => Root, { name: "Feature" });
		const mc = await container.addModule(Root);
		await container.graph.compileSegment(mc, FeatureLazy);

		const result = container.graph.unloadSegment(
			FeatureLazy,
			new Set([
				container.graph.rootToken,
				...container.graph.internalRootTokens,
			]),
		);

		expect(result.destroyedModules.sort()).toEqual(
			[mc.token, (await container.getModule(FeatureModule))?.token].sort(),
		);
		expect(result.destroyedProviders).toEqual([FeatureService]);
		expect(container.graph.getNode(mc.token)).toBeUndefined();
		expect(container.graph.getNode(FeatureService)).toBeUndefined();

		const placeholder = container.graph.getNode(FeatureLazy.id) as {
			loaded: boolean;
			moduleToken: string | null;
		};
		expect(placeholder.loaded).toBe(false);
		expect(placeholder.moduleToken).toBeNull();
	});

	it("keeps a module shared by another loaded segment, but destroys what only the unloaded segment used", async () => {
		@Injectable()
		class DeepService {}
		@Module({ providers: [DeepService], exports: [DeepService] })
		class DeepModule {}
		@Module({ imports: [DeepModule], exports: [DeepModule] })
		class SharedRoot {}

		const container = await ready();

		@Module({ imports: [SharedRoot] })
		class RootA {}
		const LazyA = lazy(async () => RootA, { name: "A" });
		const mcA = await container.addModule(RootA);
		await container.graph.compileSegment(mcA, LazyA);

		@Module({ imports: [SharedRoot] })
		class RootB {}
		const LazyB = lazy(async () => RootB, { name: "B" });
		const mcB = await container.addModule(RootB);
		await container.graph.compileSegment(mcB, LazyB);

		const sharedToken = (await container.getModule(SharedRoot))
			?.token as string;

		const result = container.graph.unloadSegment(
			LazyA,
			new Set([
				container.graph.rootToken,
				...container.graph.internalRootTokens,
				mcB.token,
			]),
		);

		expect(result.destroyedModules).toEqual([mcA.token]);
		expect(container.graph.getNode(sharedToken)).toBeDefined();
		expect(container.graph.getNode(DeepService)).toBeDefined();
	});

	it("rescues a module only reachable through a surviving sibling candidate", async () => {
		// SegA -> X -> Y. SegB (protected) also imports X directly, but never
		// mentions Y. Unloading A must keep X (a direct external referrer) AND
		// Y (only reachable via X, which survives) alive, while A's own root
		// dies. A naive "does this node individually have an outside
		// referrer" check would keep X but wrongly kill Y.
		@Injectable()
		class YService {}
		@Module({ providers: [YService], exports: [YService] })
		class Y {}
		@Module({ imports: [Y], exports: [Y] })
		class X {}

		const container = await ready();

		@Module({ imports: [X] })
		class RootA {}
		const LazyA = lazy(async () => RootA, { name: "A" });
		const mcA = await container.addModule(RootA);
		await container.graph.compileSegment(mcA, LazyA);

		@Module({ imports: [X] })
		class RootB {}
		const LazyB = lazy(async () => RootB, { name: "B" });
		const mcB = await container.addModule(RootB);
		await container.graph.compileSegment(mcB, LazyB);

		const xToken = (await container.getModule(X))?.token as string;
		const yToken = (await container.getModule(Y))?.token as string;

		const result = container.graph.unloadSegment(
			LazyA,
			new Set([
				container.graph.rootToken,
				...container.graph.internalRootTokens,
				mcB.token,
			]),
		);

		expect(result.destroyedModules).toEqual([mcA.token]);
		expect(container.graph.getNode(xToken)).toBeDefined();
		expect(container.graph.getNode(yToken)).toBeDefined();
		expect(container.graph.getNode(YService)).toBeDefined();
	});

	it("keeps a @Global() module alive for a segment that resolved a provider through it", async () => {
		@Injectable()
		class AuthService {}
		@Global()
		@Module({ providers: [AuthService], exports: [AuthService] })
		class AuthModule {}

		@Injectable()
		class FeatureBService {
			constructor(@Inject(AuthService) readonly auth: AuthService) {}
		}
		@Module({ providers: [FeatureBService], exports: [FeatureBService] })
		class RootB {}

		const container = await ready();

		@Module({ imports: [AuthModule] })
		class RootA {}
		const LazyA = lazy(async () => RootA, { name: "A" });
		const mcA = await container.addModule(RootA);
		await container.graph.compileSegment(mcA, LazyA);

		const LazyB = lazy(async () => RootB, { name: "B" });
		const mcB = await container.addModule(RootB);
		await container.graph.compileSegment(mcB, LazyB);

		const authToken = (await container.getModule(AuthModule))?.token as string;

		const result = container.graph.unloadSegment(
			LazyA,
			new Set([
				container.graph.rootToken,
				...container.graph.internalRootTokens,
				mcB.token,
			]),
		);

		expect(result.destroyedModules).toEqual([mcA.token]);
		expect(container.graph.getNode(authToken)).toBeDefined();
		expect(container.graph.getNode(AuthService)).toBeDefined();
	});

	it("is a no-op for a placeholder that is not loaded", async () => {
		const container = await ready();
		@Module({ imports: [FeatureModule] })
		class Root {}
		const FeatureLazy = lazy(async () => Root, { name: "Feature" });

		const result = container.graph.unloadSegment(FeatureLazy, new Set());

		expect(result).toEqual({ destroyedModules: [], destroyedProviders: [] });
	});
});
