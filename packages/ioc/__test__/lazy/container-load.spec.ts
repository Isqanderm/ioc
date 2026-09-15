import "reflect-metadata";
import { ContainerNotCompiledError } from "@nexus-ioc/shared";
import {
	Inject,
	Injectable,
	LazyModuleGraphError,
	LazyModuleLoadError,
	lazy,
	Module,
} from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

describe("Container.load", () => {
	@Injectable()
	class FeatureService {}
	@Module({ providers: [FeatureService], exports: [FeatureService] })
	class FeatureModule {}

	async function ready(...refs: ReturnType<typeof lazy>[]) {
		@Module({ imports: refs })
		class AppModule {}
		const container = new Container(new HashUtil());
		await container.run(AppModule);
		return container;
	}

	it("loads a declared lazy module and makes its providers resolvable", async () => {
		const FeatureLazy = lazy(async () => FeatureModule);
		const container = await ready(FeatureLazy);
		const segment = await container.load(FeatureLazy);
		expect(segment.moduleContainer.metatype).toBe(FeatureModule);
		expect(await container.get(FeatureService)).toBeInstanceOf(FeatureService);
	});

	it("runs the loader once for concurrent and repeated loads", async () => {
		const loader = vi.fn(async () => FeatureModule);
		const FeatureLazy = lazy(loader);
		const container = await ready(FeatureLazy);
		const [a, b] = await Promise.all([
			container.load(FeatureLazy),
			container.load(FeatureLazy),
		]);
		const c = await container.load(FeatureLazy);
		expect(loader).toHaveBeenCalledTimes(1);
		expect(a).toBe(b);
		expect(b).toBe(c);
	});

	it("accepts a DynamicModule from the loader", async () => {
		@Module({})
		class ConfigModule {
			static forRoot(value: string) {
				return {
					module: ConfigModule,
					providers: [{ provide: "CONFIG", useValue: value }],
					exports: ["CONFIG"],
				};
			}
		}
		const ConfigLazy = lazy(async () => ConfigModule.forRoot("prod"));
		const container = await ready(ConfigLazy);
		await container.load(ConfigLazy);
		expect(await container.get("CONFIG")).toBe("prod");
	});

	it("throws LazyModuleLoadError when the loader returns a non-module", async () => {
		class NotAModule {}
		const Bad = lazy(async () => NotAModule as never, { name: "Bad" });
		const container = await ready(Bad);
		await expect(container.load(Bad)).rejects.toThrow(LazyModuleLoadError);
		await expect(container.load(Bad)).rejects.toThrow(/"Bad"/);
	});

	it("throws LazyModuleLoadError when the loader rejects, and allows a retry", async () => {
		let calls = 0;
		const Flaky = lazy(async () => {
			calls += 1;
			if (calls === 1) throw new Error("network");
			return FeatureModule;
		});
		const container = await ready(Flaky);
		await expect(container.load(Flaky)).rejects.toThrow(LazyModuleLoadError);
		await expect(container.load(Flaky)).resolves.toBeDefined();
		expect(calls).toBe(2);
	});

	it("throws LazyModuleGraphError with the segment errors and keeps the graph clean", async () => {
		@Injectable()
		class Broken {
			constructor(@Inject("MISSING") readonly m: unknown) {}
		}
		@Module({ providers: [Broken] })
		class BrokenModule {}
		const BrokenLazy = lazy(async () => BrokenModule, { name: "Broken" });
		const container = await ready(BrokenLazy);

		const error = await container.load(BrokenLazy).catch((e) => e);
		expect(error).toBeInstanceOf(LazyModuleGraphError);
		expect(error.lazyModuleName).toBe("Broken");
		expect(error.errors[0].type).toBe("UNREACHED_DEP_CONSTRUCTOR");
		expect(error.message).toContain('Missing provider "MISSING"');
		expect(container.graph.getNode(Broken)).toBeUndefined();
		expect(container.errors).toEqual([]);
	});

	it("throws ContainerNotCompiledError before run()", async () => {
		const FeatureLazy = lazy(async () => FeatureModule);
		const container = new Container(new HashUtil());
		await expect(container.load(FeatureLazy)).rejects.toThrow(
			ContainerNotCompiledError,
		);
	});
});
