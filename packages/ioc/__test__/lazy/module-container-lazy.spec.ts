import "reflect-metadata";
import { lazy, Module } from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

describe("ModuleContainer with lazy imports", () => {
	@Module({})
	class EagerModule {}

	@Module({})
	class FeatureModule {}

	it("registers eager imports but not lazy ones", async () => {
		const loader = vi.fn(async () => FeatureModule);
		const FeatureLazy = lazy(loader, { name: "Feature" });

		@Module({ imports: [EagerModule, FeatureLazy] })
		class AppModule {}

		const container = new Container(new HashUtil());
		const app = await container.addModule(AppModule);

		const imports = await app.imports;
		expect(imports.map((m) => m.metatype)).toEqual([EagerModule]);
		expect(app.lazyImports).toEqual([FeatureLazy]);
		expect(loader).not.toHaveBeenCalled();
		expect(await container.getModule(FeatureModule)).toBeUndefined();
	});

	it("reads lazy imports from a DynamicModule too", async () => {
		const FeatureLazy = lazy(async () => FeatureModule);

		@Module({})
		class ConfigModule {
			static forRoot() {
				return { module: ConfigModule, imports: [FeatureLazy] };
			}
		}

		const container = new Container(new HashUtil());
		const mc = await container.addModule(ConfigModule.forRoot());
		expect(await mc.imports).toEqual([]);
		expect(mc.lazyImports).toEqual([FeatureLazy]);
	});
});
