import "reflect-metadata";
import { isLazyModule, lazy, Module } from "../../src";

describe("lazy()", () => {
	@Module({})
	class FeatureModule {}

	it("creates a marker with a unique symbol id and a name", () => {
		const ref = lazy(async () => FeatureModule, { name: "Feature" });
		expect(typeof ref.id).toBe("symbol");
		expect(ref.name).toBe("Feature");
		expect(isLazyModule(ref)).toBe(true);
	});

	it("defaults the name to 'LazyModule' and gives each call its own id", () => {
		const a = lazy(async () => FeatureModule);
		const b = lazy(async () => FeatureModule);
		expect(a.name).toBe("LazyModule");
		expect(a.id).not.toBe(b.id);
	});

	it("does not run the loader on creation", async () => {
		const loader = vi.fn(async () => FeatureModule);
		const ref = lazy(loader);
		expect(loader).not.toHaveBeenCalled();
		expect(await ref.load()).toBe(FeatureModule);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("rejects non-markers", () => {
		expect(isLazyModule(FeatureModule)).toBe(false);
		expect(isLazyModule({ id: "x", load: () => 1 })).toBe(false);
		expect(isLazyModule(null)).toBe(false);
	});

	it("is accepted by @Module imports without registering anything", () => {
		const ref = lazy(async () => FeatureModule);
		@Module({ imports: [ref] })
		class AppModule {}
		expect(Reflect.getMetadata("imports", AppModule)).toEqual([ref]);
	});
});
