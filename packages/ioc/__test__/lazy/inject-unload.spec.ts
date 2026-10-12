import "reflect-metadata";
import {
	EdgeTypeEnum,
	Global,
	Inject,
	Injectable,
	inject,
	lazy,
	Module,
	Optional,
	Scope,
} from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

async function ready() {
	const container = new Container(new HashUtil());
	@Module({})
	class AppModule {}
	await container.run(AppModule);
	return container;
}

describe("inject() runtime graph edges", () => {
	it("records a runtime DEPENDENCY edge, idempotently", async () => {
		@Injectable()
		class Http {}
		@Injectable()
		class Api {
			readonly http = inject(Http);
		}
		@Module({ providers: [Http, Api], exports: [Api] })
		class FeatureModule {}

		const container = await ready();
		const FeatureLazy = lazy(async () => FeatureModule);
		await container.load(FeatureLazy);
		await container.resolve(Api);

		const edges = container.graph
			.getEdge(Api)
			.filter((e) => e.type === EdgeTypeEnum.DEPENDENCY && e.target === Http);
		expect(edges).toHaveLength(1);
		expect(edges[0].metadata).toEqual({
			inject: "runtime",
			unreached: false,
			isCircular: false,
		});
	});

	it("records no edge for an optional lookup that resolved to undefined", async () => {
		@Injectable()
		class Missing {}
		@Injectable()
		class Api {
			readonly m = inject(Missing, { optional: true });
		}
		@Module({ providers: [Api], exports: [Api] })
		class FeatureModule {}

		const container = await ready();
		await container.load(lazy(async () => FeatureModule));
		const api = await container.resolve(Api);
		expect(api.m).toBeUndefined();
		expect(
			container.graph
				.getEdge(Api)
				.filter((e) => e.type === EdgeTypeEnum.DEPENDENCY),
		).toHaveLength(0);
	});

	async function scenario(mode: "inject" | "static") {
		const destroyed = vi.fn();
		@Injectable()
		class SharedSvc {
			onModuleDestroy() {
				destroyed();
			}
		}
		@Module({ providers: [SharedSvc], exports: [SharedSvc] })
		class SharedModule {}

		@Injectable()
		class ProviderA {
			readonly shared = mode === "inject" ? inject(SharedSvc) : undefined;
		}
		@Injectable()
		class StaticA {
			constructor(@Inject(SharedSvc) readonly shared: SharedSvc) {}
		}
		const A = mode === "inject" ? ProviderA : StaticA;

		@Injectable()
		class ProviderB {
			constructor(@Inject(SharedSvc) readonly shared: SharedSvc) {}
		}

		@Module({ imports: [SharedModule], providers: [A], exports: [A] })
		class FeatureA {}
		@Module({
			imports: [SharedModule],
			providers: [ProviderB],
			exports: [ProviderB],
		})
		class FeatureB {}

		const container = await ready();
		const LazyA = lazy(async () => FeatureA, { name: "A" });
		const LazyB = lazy(async () => FeatureB, { name: "B" });
		await container.load(LazyA);
		await container.load(LazyB);
		await container.resolve(A);
		const b = await container.resolve(ProviderB);

		const first = await container.unload(LazyA);
		const afterFirst = destroyed.mock.calls.length;
		const shared = await container.resolve(SharedSvc);
		const sameInstance = b.shared === shared;
		const second = await container.unload(LazyB);
		return {
			first,
			second,
			afterFirst,
			sameInstance,
			afterSecond: destroyed.mock.calls.length,
			sharedToken: SharedSvc,
			A,
			ProviderB,
		};
	}

	it("keeps a shared module alive for an inject() consumer until the last referrer unloads", async () => {
		const r = await scenario("inject");
		expect(r.afterFirst).toBe(0);
		expect(r.first.destroyedProviders).toEqual([r.A]);
		expect(r.sameInstance).toBe(true);
		expect(r.second.destroyedProviders).toContain(r.sharedToken);
		expect(r.afterSecond).toBe(1);
	});

	it("unloads identically to @Inject", async () => {
		const viaInject = await scenario("inject");
		const viaStatic = await scenario("static");
		const names = (xs: unknown[]) =>
			xs.map((x) => (typeof x === "function" ? "Provider" : String(x)));
		expect(names(viaInject.first.destroyedProviders)).toEqual(
			names(viaStatic.first.destroyedProviders),
		);
		expect(names(viaInject.second.destroyedProviders).sort()).toEqual(
			names(viaStatic.second.destroyedProviders).sort(),
		);
		expect(viaInject.first.destroyedModules).toHaveLength(
			viaStatic.first.destroyedModules.length,
		);
		expect(viaInject.second.destroyedModules).toHaveLength(
			viaStatic.second.destroyedModules.length,
		);
		expect(viaInject.afterFirst).toBe(viaStatic.afterFirst);
		expect(viaInject.afterSecond).toBe(viaStatic.afterSecond);
	});

	it("keeps a global module alive for an inject() consumer that does not import it", async () => {
		const destroyed = vi.fn();
		@Injectable()
		class SharedSvc {
			onModuleDestroy() {
				destroyed();
			}
		}
		@Global()
		@Module({ providers: [SharedSvc], exports: [SharedSvc] })
		class SharedModule {}
		@Injectable()
		class ConsumerA {
			readonly shared = inject(SharedSvc);
		}
		@Injectable()
		class ConsumerB {
			constructor(@Inject(SharedSvc) readonly shared: SharedSvc) {}
		}
		@Module({ providers: [ConsumerA] })
		class FeatureA {}
		@Module({ imports: [SharedModule], providers: [ConsumerB] })
		class FeatureB {}

		const container = await ready();
		const LazyA = lazy(async () => FeatureA, { name: "A" });
		const LazyB = lazy(async () => FeatureB, { name: "B" });
		await container.load(LazyA);
		await container.load(LazyB);
		const a = await container.resolve(ConsumerA);

		await container.unload(LazyB);
		expect(destroyed).not.toHaveBeenCalled();
		expect(await container.resolve(SharedSvc)).toBe(a.shared);

		await container.unload(LazyA);
		expect(destroyed).toHaveBeenCalledTimes(1);
		expect(container.graph.getNode(SharedSvc)).toBeUndefined();
	});

	it("records the referrer even when a static edge to the same target already exists", async () => {
		const destroyed = vi.fn();
		@Injectable()
		class GSvc {
			onModuleDestroy() {
				destroyed();
			}
		}
		@Global()
		@Module({ providers: [GSvc], exports: [GSvc] })
		class GModule {}
		@Injectable({ scope: Scope.Transient })
		class T {
			readonly g = inject(GSvc, { optional: true });
			constructor(@Optional() @Inject(GSvc) readonly s?: GSvc) {}
		}
		@Module({ providers: [T] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		const ref = lazy(async () => GModule, { name: "G" });
		await container.load(ref);
		const t = await container.resolve(T);
		expect(t.g).toBeInstanceOf(GSvc);

		const result = await container.unload(ref);
		expect(result.destroyedProviders).toEqual([]);
		expect(destroyed).not.toHaveBeenCalled();
		expect(await container.resolve(GSvc)).toBe(t.g);
	});
});
