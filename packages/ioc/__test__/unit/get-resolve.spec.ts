import "reflect-metadata";
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
			{ provide: "async", useFactory: async () => "async-value" },
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

	it("returns async-factory singletons synchronously after bootstrap", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		expect(app.get("async")).toBe("async-value");
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
