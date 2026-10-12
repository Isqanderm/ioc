import "reflect-metadata";
import { withExtraProviders } from "../../src/core/child-module";
import { Injectable } from "../../src/decorators/injectable";
import { Module } from "../../src/decorators/module";

describe("withExtraProviders", () => {
	@Injectable()
	class Imported {}
	@Module({ providers: [Imported], exports: [Imported] })
	class Dep {}
	@Injectable()
	class Own {}
	@Module({ imports: [Dep], providers: [Own], exports: [Own] })
	class Target {}
	const extra = { provide: "extra", useValue: 1 };

	it("returns the module unchanged when there are no extra providers", () => {
		expect(withExtraProviders(Target, undefined)).toBe(Target);
		expect(withExtraProviders(Target, [])).toBe(Target);
	});

	it("turns a Type into a DynamicModule keeping imports and exports", () => {
		expect(withExtraProviders(Target, [extra])).toEqual({
			module: Target,
			imports: [Dep],
			providers: [Own, extra],
			exports: [Own],
		});
	});

	it("appends providers to a DynamicModule, keeping the rest", () => {
		const dm = {
			module: Target,
			imports: [Dep],
			providers: [Own],
			exports: [Own],
		};
		const result = withExtraProviders(dm, [extra]);
		expect(result).toEqual({ ...dm, providers: [Own, extra] });
		expect(dm.providers).toEqual([Own]);
	});

	it("handles a DynamicModule without providers", () => {
		expect(withExtraProviders({ module: Target }, [extra])).toEqual({
			module: Target,
			providers: [extra],
		});
	});
});
