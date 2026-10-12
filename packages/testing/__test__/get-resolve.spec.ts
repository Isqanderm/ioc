import "reflect-metadata";
import {
	Injectable,
	lazy,
	Module,
	type OnModuleInit,
	ProviderNotFoundError,
	ProviderScopeError,
	Scope,
} from "@nexus-ioc/core";
import { ContainerNotCompiledError } from "@nexus-ioc/shared";
import { Test } from "../src";

describe("Test.get / Test.resolve", () => {
	it("compile() instantiates singletons and runs onModuleInit", async () => {
		const init = vi.fn();
		@Injectable()
		class Svc implements OnModuleInit {
			onModuleInit() {
				init();
			}
		}
		const container = Test.createModule({ providers: [Svc] });
		await container.compile();
		expect(init).toHaveBeenCalledTimes(1);
		expect(container.get(Svc)).toBeInstanceOf(Svc);
	});

	it("get throws for transient, resolve creates", async () => {
		@Injectable({ scope: Scope.Transient })
		class T1 {}
		const container = Test.createModule({ providers: [T1] });
		await container.compile();
		expect(() => container.get(T1)).toThrow(ProviderScopeError);
		await expect(container.resolve(T1)).resolves.toBeInstanceOf(T1);
	});

	it("unknown token: throws, or undefined when optional", async () => {
		const container = Test.createModule({ providers: [] });
		await container.compile();
		expect(() => container.get("nope")).toThrow(ProviderNotFoundError);
		expect(container.get("nope", { optional: true })).toBeUndefined();
		await expect(container.resolve("nope")).rejects.toThrow(
			ProviderNotFoundError,
		);
		await expect(
			container.resolve("nope", { optional: true }),
		).resolves.toBeUndefined();
	});

	it("throws ContainerNotCompiledError before compile", async () => {
		const container = Test.createModule({ providers: [] });
		expect(() => container.get("x")).toThrow(ContainerNotCompiledError);
		await expect(container.resolve("x")).rejects.toThrow(
			ContainerNotCompiledError,
		);
	});

	it("a failing onModuleInit rejects compile()", async () => {
		@Injectable()
		class Bad implements OnModuleInit {
			onModuleInit() {
				throw new Error("boom");
			}
		}
		const container = Test.createModule({ providers: [Bad] });
		await expect(container.compile()).rejects.toThrow("boom");
	});

	it("load() warms the singletons of the loaded segment", async () => {
		const init = vi.fn();
		@Injectable()
		class LazySvc implements OnModuleInit {
			onModuleInit() {
				init();
			}
		}
		@Module({ providers: [LazySvc] })
		class LazyMod {}
		const container = Test.createModule({ providers: [] });
		await container.compile();
		const ref = await container.load(lazy(async () => LazyMod));
		expect(init).toHaveBeenCalledTimes(1);
		expect(ref.get(LazySvc)).toBeInstanceOf(LazySvc);
	});
});
