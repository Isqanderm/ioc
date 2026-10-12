import { describe, expect, it } from "vitest";
import { Global } from "../../src/decorators/global";
import { Injectable } from "../../src/decorators/injectable";
import { Module } from "../../src/decorators/module";
import { Scope } from "../../src/interfaces";
import {
	getDependencyToken,
	getModuleLabel,
	getProviderScope,
	getProviderToken,
	isClassProvider,
	isDynamicModule,
	isFactoryProvider,
	isFunctionProvider,
	isFunctionToken,
	isGlobalModule,
	isModule,
	isProvider,
	isValueProvider,
	withExtraProviders,
} from "../../src/utils/helpers";

describe("Helpers", () => {
	describe("isFunctionProvider", () => {
		it("should return true for class providers", () => {
			@Injectable()
			class TestService {}
			expect(isFunctionProvider(TestService)).toBe(true);
		});

		it("should return false for object providers", () => {
			const provider = { provide: "TOKEN", useValue: 123 };
			expect(isFunctionProvider(provider)).toBe(false);
		});
	});

	describe("isModule", () => {
		it("should return true for module classes", () => {
			@Module({})
			class TestModule {}
			expect(isModule(TestModule)).toBe(true);
		});

		it("should return false for string tokens", () => {
			expect(isModule("TOKEN")).toBe(false);
		});

		it("should return false for symbol tokens", () => {
			expect(isModule(Symbol("TOKEN"))).toBe(false);
		});
	});

	describe("isFunctionToken", () => {
		it("should return true for class tokens", () => {
			class TestClass {}
			expect(isFunctionToken(TestClass)).toBe(true);
		});

		it("should return false for string tokens", () => {
			expect(isFunctionToken("TOKEN")).toBe(false);
		});
	});

	describe("isClassProvider", () => {
		it("should return true for class providers", () => {
			@Injectable()
			class TestService {}
			const provider = { provide: "TOKEN", useClass: TestService };
			expect(isClassProvider(provider)).toBe(true);
		});

		it("should return false for value providers", () => {
			const provider = { provide: "TOKEN", useValue: 123 };
			expect(isClassProvider(provider)).toBe(false);
		});

		it("should return false for function providers", () => {
			@Injectable()
			class TestService {}
			expect(isClassProvider(TestService)).toBe(false);
		});
	});

	describe("isValueProvider", () => {
		it("should return true for value providers", () => {
			const provider = { provide: "TOKEN", useValue: 123 };
			expect(isValueProvider(provider)).toBe(true);
		});

		it("should return true even when useValue is null", () => {
			const provider = { provide: "TOKEN", useValue: null };
			expect(isValueProvider(provider)).toBe(true);
		});

		it("should return true even when useValue is undefined", () => {
			const provider = { provide: "TOKEN", useValue: undefined };
			expect(isValueProvider(provider)).toBe(true);
		});

		it("should return false for class providers", () => {
			@Injectable()
			class TestService {}
			const provider = { provide: "TOKEN", useClass: TestService };
			expect(isValueProvider(provider)).toBe(false);
		});
	});

	describe("isFactoryProvider", () => {
		it("should return true for factory providers", () => {
			const provider = { provide: "TOKEN", useFactory: () => ({}) };
			expect(isFactoryProvider(provider)).toBe(true);
		});

		it("should return false for value providers", () => {
			const provider = { provide: "TOKEN", useValue: 123 };
			expect(isFactoryProvider(provider)).toBe(false);
		});
	});

	describe("getProviderToken", () => {
		it("should return class for function providers", () => {
			@Injectable()
			class TestService {}
			expect(getProviderToken(TestService)).toBe(TestService);
		});

		it("should return provide token for object providers", () => {
			const provider = { provide: "TOKEN", useValue: 123 };
			expect(getProviderToken(provider)).toBe("TOKEN");
		});
	});

	describe("isProvider", () => {
		it("should return true for injectable classes", () => {
			@Injectable()
			class TestService {}
			expect(isProvider(TestService)).toBe(true);
		});

		it("should return false for non-injectable classes", () => {
			class TestService {}
			expect(isProvider(TestService)).toBe(false);
		});
	});

	describe("getDependencyToken", () => {
		it("should return class for function providers", () => {
			@Injectable()
			class TestService {}
			expect(getDependencyToken(TestService)).toBe(TestService);
		});

		it("should return token for object providers", () => {
			const provider = { provide: "TOKEN", useValue: 123 };
			expect(getDependencyToken(provider)).toBe(provider);
		});
	});

	describe("isDynamicModule", () => {
		it("should return true for dynamic modules", () => {
			@Module({})
			class TestModule {}
			const dynamicModule = { module: TestModule, providers: [] };
			expect(isDynamicModule(dynamicModule)).toBe(true);
		});

		it("should return false for regular modules", () => {
			@Module({})
			class TestModule {}
			expect(isDynamicModule(TestModule)).toBe(false);
		});
	});

	describe("isGlobalModule", () => {
		it("should return true for global modules", () => {
			@Global()
			@Module({})
			class GlobalModule {}
			expect(isGlobalModule(GlobalModule)).toBe(true);
		});

		it("should return false for non-global modules", () => {
			@Module({})
			class RegularModule {}
			expect(isGlobalModule(RegularModule)).toBe(false);
		});
	});

	describe("getModuleLabel", () => {
		it("should return module name for regular modules", () => {
			@Module({})
			class TestModule {}
			expect(getModuleLabel(TestModule)).toBe("TestModule");
		});

		it("should return module name for dynamic modules", () => {
			@Module({})
			class TestModule {}
			const dynamicModule = { module: TestModule, providers: [] };
			expect(getModuleLabel(dynamicModule)).toBe("TestModule");
		});
	});

	describe("getProviderScope", () => {
		it("should return Singleton for factory providers without scope", () => {
			const provider = { provide: "TOKEN", useFactory: () => ({}) };
			expect(getProviderScope(provider)).toBe(Scope.Singleton);
		});

		it("should return specified scope for factory providers", () => {
			const provider = {
				provide: "TOKEN",
				useFactory: () => ({}),
				scope: Scope.Transient,
			};
			expect(getProviderScope(provider)).toBe(Scope.Transient);
		});

		it("should return Singleton for class providers without scope", () => {
			@Injectable()
			class TestService {}
			const provider = { provide: "TOKEN", useClass: TestService };
			expect(getProviderScope(provider)).toBe(Scope.Singleton);
		});

		it("should return specified scope for class providers", () => {
			@Injectable()
			class TestService {}
			const provider = {
				provide: "TOKEN",
				useClass: TestService,
				scope: Scope.Transient,
			};
			expect(getProviderScope(provider)).toBe(Scope.Transient);
		});

		it("should return Singleton for value providers", () => {
			const provider = { provide: "TOKEN", useValue: 123 };
			expect(getProviderScope(provider)).toBe(Scope.Singleton);
		});

		it("should return Singleton for function providers without scope", () => {
			@Injectable()
			class TestService {}
			expect(getProviderScope(TestService)).toBe(Scope.Singleton);
		});

		it("should return specified scope for function providers with @Injectable scope", () => {
			@Injectable({ scope: Scope.Transient })
			class TestService {}
			expect(getProviderScope(TestService)).toBe(Scope.Transient);
		});
	});

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
});
