import "reflect-metadata";
import { ContainerNotCompiledError } from "@nexus-ioc/shared";
import { expectTypeOf } from "vitest";
import {
	Injectable,
	Module,
	NexusApplication,
	ProviderNotFoundError,
	ProviderNotInstantiatedError,
	ProviderScopeError,
	Scope,
} from "../../src";

describe("NexusApplication.get (sync) / resolve (async)", () => {
	@Injectable()
	class SingletonService {}

	@Injectable({ scope: Scope.Transient })
	class TransientService {}

	@Injectable({ scope: Scope.Scoped })
	class ScopedService {}

	@Module({
		providers: [
			SingletonService,
			TransientService,
			ScopedService,
			{ provide: "undef", useValue: undefined },
			{ provide: "null", useValue: null },
			{ provide: "zero", useValue: 0 },
			{ provide: "false", useValue: false },
			{ provide: "factory", useFactory: () => "factory-value" },
		],
	})
	class AppModule {}

	it("returns a bootstrapped singleton synchronously", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		const result = app.get<SingletonService>(SingletonService);
		expect(result).toBeInstanceOf(SingletonService);
		expect(result).not.toBeInstanceOf(Promise);
		expect(app.get(SingletonService)).toBe(result);
	});

	it("returns factory singletons synchronously after bootstrap", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		expect(app.get("factory")).toBe("factory-value");
	});

	it.each([
		["undef", undefined],
		["null", null],
		["zero", 0],
		["false", false],
	])("returns falsy useValue %s as-is", async (token, value) => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		expect(app.get(token)).toBe(value);
	});

	it("throws ProviderNotFoundError for an unknown token", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		expect(() => app.get("missing")).toThrow(ProviderNotFoundError);
		expect(() => app.get("missing")).toThrow(/missing/);
	});

	it("returns undefined for an unknown token with optional: true", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		expect(app.get("missing", { optional: true })).toBeUndefined();
	});

	it("throws ProviderScopeError for Transient and Scoped", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		expect(() => app.get(TransientService)).toThrow(ProviderScopeError);
		expect(() => app.get(ScopedService)).toThrow(ProviderScopeError);
		expect(() => app.get(TransientService)).toThrow(/resolve\(\)/);
	});

	it("throws ProviderNotInstantiatedError in .lazy() mode before resolve", async () => {
		const app = await NexusApplication.create(AppModule).lazy().bootstrap();
		expect(() => app.get(SingletonService)).toThrow(
			ProviderNotInstantiatedError,
		);
		const resolved = await app.resolve(SingletonService);
		expect(app.get(SingletonService)).toBe(resolved);
	});

	it("resolve creates new Transient instances", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		const a = await app.resolve(TransientService);
		const b = await app.resolve(TransientService);
		expect(a).toBeInstanceOf(TransientService);
		expect(a).not.toBe(b);
	});

	it("resolve throws ProviderNotFoundError unless optional", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		await expect(app.resolve("missing")).rejects.toThrow(ProviderNotFoundError);
		await expect(
			app.resolve("missing", { optional: true }),
		).resolves.toBeUndefined();
	});

	it("get/resolve before bootstrap throw ContainerNotCompiledError", async () => {
		const app = NexusApplication.create(AppModule);
		expect(() => app.get(SingletonService)).toThrow(ContainerNotCompiledError);
		expect(() => app.get("missing", { optional: true })).toThrow(
			ContainerNotCompiledError,
		);
		await expect(app.resolve(SingletonService)).rejects.toThrow(
			ContainerNotCompiledError,
		);
	});

	it("get/resolve before bootstrap do not fall back to the parent", async () => {
		@Module({ providers: [{ provide: "p", useValue: 1 }] })
		class ParentModule {}
		const parent = await NexusApplication.create(ParentModule).bootstrap();
		const child = NexusApplication.create(AppModule).setParent(parent);
		expect(() => child.get("p")).toThrow(ContainerNotCompiledError);
		await expect(child.resolve("p")).rejects.toThrow(ContainerNotCompiledError);
	});

	it("narrows the return type only for optional: true", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		expectTypeOf(
			app.get<SingletonService>(SingletonService),
		).toEqualTypeOf<SingletonService>();
		expectTypeOf(
			app.get<SingletonService>(SingletonService, {}),
		).toEqualTypeOf<SingletonService>();
		expectTypeOf(
			app.get<SingletonService>(SingletonService, { optional: false }),
		).toEqualTypeOf<SingletonService>();
		expectTypeOf(
			app.get<SingletonService>(SingletonService, { optional: true }),
		).toEqualTypeOf<SingletonService | undefined>();
		expectTypeOf(
			app.resolve<SingletonService>(SingletonService, {}),
		).toEqualTypeOf<Promise<SingletonService>>();
		expectTypeOf(
			app.resolve<SingletonService>(SingletonService, { optional: true }),
		).toEqualTypeOf<Promise<SingletonService | undefined>>();
	});

	describe("parent fallback", () => {
		@Module({ providers: [{ provide: "shared", useValue: "from-parent" }] })
		class ParentModule {}

		@Module({ providers: [] })
		class EmptyChildModule {}

		@Module({
			providers: [
				{
					provide: "shared",
					useFactory: () => "child",
					scope: Scope.Transient,
				},
			],
		})
		class ShadowingChildModule {}

		it("get falls back to the parent for unknown tokens", async () => {
			const parent = await NexusApplication.create(ParentModule).bootstrap();
			const child = await NexusApplication.create(EmptyChildModule)
				.setParent(parent)
				.bootstrap();
			expect(child.get("shared")).toBe("from-parent");
			await expect(child.resolve("shared")).resolves.toBe("from-parent");
		});

		it("get does not fall back when the token exists locally", async () => {
			const parent = await NexusApplication.create(ParentModule).bootstrap();
			const child = await NexusApplication.create(ShadowingChildModule)
				.setParent(parent)
				.bootstrap();
			expect(() => child.get("shared")).toThrow(ProviderScopeError);
		});

		it("optional propagates through the parent chain", async () => {
			const parent = await NexusApplication.create(ParentModule).bootstrap();
			const child = await NexusApplication.create(EmptyChildModule)
				.setParent(parent)
				.bootstrap();
			expect(child.get("nope", { optional: true })).toBeUndefined();
			expect(() => child.get("nope")).toThrow(ProviderNotFoundError);
		});
	});
});
