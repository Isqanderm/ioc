import "reflect-metadata";
import { Inject, Injectable, InjectionToken, Module } from "@nexus-ioc/core";
import { Test } from "../src/core/testing-container";

const DEP = new InjectionToken<{ name: string }>("DEP");

@Injectable()
class RealOnly {}

@Module({
	providers: [{ provide: DEP, useValue: { name: "real" } }, RealOnly],
	exports: [DEP],
})
class RealModule {
	static forRoot() {
		return {
			module: RealModule,
			providers: [{ provide: DEP, useValue: { name: "real-dynamic" } }],
			exports: [DEP],
		};
	}
}

@Module({
	providers: [{ provide: DEP, useValue: { name: "fake" } }],
	exports: [DEP],
})
class FakeModule {}

@Injectable()
class Consumer {
	constructor(@Inject(DEP) public readonly dep: { name: string }) {}
}

describe("Test.replaceModule before compile()", () => {
	it("replaces a directly imported module", async () => {
		const t = Test.createModule({
			imports: [RealModule],
			providers: [Consumer],
		});
		await t.replaceModule(RealModule, FakeModule);
		const ref = await t.compile();

		expect(ref.get(Consumer).dep.name).toBe("fake");
		expect(ref.get(RealOnly, { optional: true })).toBeUndefined();
	});

	it("replaces a module imported only transitively", async () => {
		@Module({ imports: [RealModule], exports: [DEP] })
		class FeatureModule {}

		const t = Test.createModule({
			imports: [FeatureModule],
			providers: [Consumer],
		});
		await t.replaceModule(RealModule, FakeModule);
		const ref = await t.compile();

		expect(ref.get(Consumer).dep.name).toBe("fake");
		expect(ref.get(RealOnly, { optional: true })).toBeUndefined();
	});

	it("replaces a module imported as a DynamicModule", async () => {
		const t = Test.createModule({
			imports: [RealModule.forRoot()],
			providers: [Consumer],
		});
		await t.replaceModule(RealModule, FakeModule);
		const ref = await t.compile();

		expect(ref.get(Consumer).dep.name).toBe("fake");
		expect(ref.get(RealOnly, { optional: true })).toBeUndefined();
	});

	it("leaves unrelated modules alone", async () => {
		@Module({ providers: [RealOnly], exports: [RealOnly] })
		class OtherModule {}

		const t = Test.createModule({
			imports: [RealModule, OtherModule],
			providers: [Consumer],
		});
		await t.replaceModule(RealModule, FakeModule);
		const ref = await t.compile();

		expect(ref.get(RealOnly)).toBeInstanceOf(RealOnly);
	});

	it("does not loop on a replacement cycle or a self replacement", async () => {
		const t = Test.createModule({
			imports: [RealModule],
			providers: [Consumer],
		});
		await t.replaceModule(RealModule, RealModule);
		const ref = await t.compile();
		expect(ref.get(Consumer).dep.name).toBe("real");

		const t2 = Test.createModule({
			imports: [RealModule],
			providers: [Consumer],
		});
		await t2.replaceModule(RealModule, FakeModule);
		await t2.replaceModule(FakeModule, RealModule);
		await expect(t2.compile()).resolves.toBeDefined();
	});

	it("throws when called after compile()", async () => {
		const t = Test.createModule({ imports: [RealModule] });
		await t.compile();

		await expect(t.replaceModule(RealModule, FakeModule)).rejects.toThrow(
			"replaceModule must be called before compile()",
		);
	});
});
