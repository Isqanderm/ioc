import "reflect-metadata";
import { Global } from "../../src/decorators/global";
import { Inject } from "../../src/decorators/inject";
import { Injectable } from "../../src/decorators/injectable";
import { NsModule } from "../../src/decorators/nsModule";
import { Optional } from "../../src/decorators/optional";
import {
	INJECTABLE_OPTIONS,
	INJECTABLE_WATERMARK,
	INJECT_WATERMARK,
	MODULE_GLOBAL_WATERMARK,
	MODULE_METADATA,
	MODULE_WATERMARK,
	OPTIONAL_WATERMARK,
	PROPERTY_DEPS_METADATA,
	PROPERTY_OPTIONAL_DEPS_METADATA,
	SELF_DECLARED_DEPS_METADATA,
	SELF_DECLARED_OPTIONAL_DEPS_METADATA,
	Scope,
} from "../../src/interfaces";

describe("Decorators", () => {
	describe("@Injectable", () => {
		it("should mark class as injectable", () => {
			@Injectable()
			class TestService {}

			const isInjectable = Reflect.getMetadata(INJECTABLE_WATERMARK, TestService);
			expect(isInjectable).toBe(true);
		});

		it("should set default scope to Singleton", () => {
			@Injectable()
			class TestService {}

			const options = Reflect.getMetadata(INJECTABLE_OPTIONS, TestService);
			expect(options).toEqual({ scope: Scope.Singleton });
		});

		it("should accept custom scope option", () => {
			@Injectable({ scope: Scope.Transient })
			class TestService {}

			const options = Reflect.getMetadata(INJECTABLE_OPTIONS, TestService);
			expect(options).toEqual({ scope: Scope.Transient });
		});

		it("should support Request scope", () => {
			@Injectable({ scope: Scope.Request })
			class TestService {}

			const options = Reflect.getMetadata(INJECTABLE_OPTIONS, TestService);
			expect(options).toEqual({ scope: Scope.Request });
		});

		it("should work without options", () => {
			@Injectable()
			class TestService {}

			const isInjectable = Reflect.getMetadata(INJECTABLE_WATERMARK, TestService);
			const options = Reflect.getMetadata(INJECTABLE_OPTIONS, TestService);

			expect(isInjectable).toBe(true);
			expect(options.scope).toBe(Scope.Singleton);
		});

		it("should be applicable to multiple classes", () => {
			@Injectable()
			class ServiceA {}

			@Injectable({ scope: Scope.Transient })
			class ServiceB {}

			const isInjectableA = Reflect.getMetadata(INJECTABLE_WATERMARK, ServiceA);
			const isInjectableB = Reflect.getMetadata(INJECTABLE_WATERMARK, ServiceB);

			expect(isInjectableA).toBe(true);
			expect(isInjectableB).toBe(true);
		});
	});

	describe("@NsModule", () => {
		it("should mark class as module", () => {
			@NsModule({})
			class TestModule {}

			const isModule = Reflect.getMetadata(MODULE_WATERMARK, TestModule);
			expect(isModule).toBe(true);
		});

		it("should store imports metadata", () => {
			@NsModule({})
			class ImportedModule {}

			@NsModule({
				imports: [ImportedModule],
			})
			class TestModule {}

			const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, TestModule);
			expect(imports).toEqual([ImportedModule]);
		});

		it("should store providers metadata", () => {
			@Injectable()
			class TestService {}

			@NsModule({
				providers: [TestService],
			})
			class TestModule {}

			const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TestModule);
			expect(providers).toEqual([TestService]);
		});

		it("should store exports metadata", () => {
			@Injectable()
			class TestService {}

			@NsModule({
				providers: [TestService],
				exports: [TestService],
			})
			class TestModule {}

			const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, TestModule);
			expect(exports).toEqual([TestService]);
		});

		it("should handle empty metadata", () => {
			@NsModule({})
			class TestModule {}

			const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, TestModule);
			const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TestModule);
			const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, TestModule);

			expect(imports).toEqual([]);
			expect(providers).toEqual([]);
			expect(exports).toEqual([]);
		});

		it("should throw error for invalid metadata keys", () => {
			expect(() => {
				@NsModule({
					// @ts-expect-error - testing invalid key
					invalidKey: [],
				})
				class TestModule {}
			}).toThrow("Invalid property 'invalidKey' passed into the @Module() decorator");
		});

		it("should handle complex module configuration", () => {
			@Injectable()
			class ServiceA {}

			@Injectable()
			class ServiceB {}

			@NsModule({
				providers: [ServiceA],
				exports: [ServiceA],
			})
			class ModuleA {}

			@NsModule({
				imports: [ModuleA],
				providers: [ServiceB],
				exports: [ServiceB],
			})
			class ModuleB {}

			const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, ModuleB);
			const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ModuleB);
			const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, ModuleB);

			expect(imports).toEqual([ModuleA]);
			expect(providers).toEqual([ServiceB]);
			expect(exports).toEqual([ServiceB]);
		});
	});

	describe("@Inject", () => {
		it("should mark class with inject watermark", () => {
			@Injectable()
			class DependencyService {}

			@Injectable()
			class TestService {
				constructor(@Inject(DependencyService) private dep: DependencyService) {}
			}

			const hasInject = Reflect.getMetadata(INJECT_WATERMARK, TestService);
			expect(hasInject).toBe(true);
		});

		it("should store constructor dependency metadata", () => {
			@Injectable()
			class DependencyService {}

			@Injectable()
			class TestService {
				constructor(@Inject(DependencyService) private dep: DependencyService) {}
			}

			const deps = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, TestService);
			expect(deps).toEqual([{ index: 0, param: DependencyService }]);
		});

		it("should handle multiple constructor dependencies", () => {
			@Injectable()
			class ServiceA {}

			@Injectable()
			class ServiceB {}

			@Injectable()
			class TestService {
				constructor(
					@Inject(ServiceA) private serviceA: ServiceA,
					@Inject(ServiceB) private serviceB: ServiceB,
				) {}
			}

			const deps = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, TestService);
			// Dependencies are stored in reverse order
			expect(deps).toEqual([
				{ index: 1, param: ServiceB },
				{ index: 0, param: ServiceA },
			]);
		});

		it("should support property injection", () => {
			@Injectable()
			class DependencyService {}

			@Injectable()
			class TestService {
				@Inject(DependencyService)
				private dep!: DependencyService;
			}

			const deps = Reflect.getMetadata(PROPERTY_DEPS_METADATA, TestService);
			expect(deps).toEqual([{ key: "dep", type: DependencyService }]);
		});

		it("should support custom injection tokens (string)", () => {
			const TOKEN = "CUSTOM_TOKEN";

			@Injectable()
			class TestService {
				constructor(@Inject(TOKEN) private dep: unknown) {}
			}

			const deps = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, TestService);
			expect(deps).toEqual([{ index: 0, param: TOKEN }]);
		});

		it("should support custom injection tokens (symbol)", () => {
			const TOKEN = Symbol("CUSTOM_TOKEN");

			@Injectable()
			class TestService {
				constructor(@Inject(TOKEN) private dep: unknown) {}
			}

			const deps = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, TestService);
			expect(deps).toEqual([{ index: 0, param: TOKEN }]);
		});
	});

	describe("@Optional", () => {
		it("should mark class with optional watermark", () => {
			@Injectable()
			class TestService {
				constructor(@Optional() private dep?: unknown) {}
			}

			const hasOptional = Reflect.getMetadata(OPTIONAL_WATERMARK, TestService);
			expect(hasOptional).toBe(true);
		});

		it("should store optional constructor dependency metadata", () => {
			@Injectable()
			class TestService {
				constructor(@Optional() private dep?: unknown) {}
			}

			const optionalDeps = Reflect.getMetadata(SELF_DECLARED_OPTIONAL_DEPS_METADATA, TestService);
			expect(optionalDeps).toEqual([{ index: 0 }]);
		});

		it("should support optional property injection", () => {
			@Injectable()
			class DependencyService {}

			@Injectable()
			class TestService {
				@Optional()
				@Inject(DependencyService)
				private dep?: DependencyService;
			}

			const optionalDeps = Reflect.getMetadata(PROPERTY_OPTIONAL_DEPS_METADATA, TestService);
			expect(optionalDeps).toEqual([{ key: "dep" }]);
		});
	});

	describe("@Global", () => {
		it("should mark module as global", () => {
			@Global()
			@NsModule({})
			class GlobalModule {}

			const isGlobal = Reflect.getMetadata(MODULE_GLOBAL_WATERMARK, GlobalModule);
			expect(isGlobal).toBe(true);
		});

		it("should work with regular modules", () => {
			@Injectable()
			class GlobalService {}

			@Global()
			@NsModule({
				providers: [GlobalService],
				exports: [GlobalService],
			})
			class GlobalModule {}

			const isGlobal = Reflect.getMetadata(MODULE_GLOBAL_WATERMARK, GlobalModule);
			const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, GlobalModule);

			expect(isGlobal).toBe(true);
			expect(providers).toEqual([GlobalService]);
		});
	});
});
