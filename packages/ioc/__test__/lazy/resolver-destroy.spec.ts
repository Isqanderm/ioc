import "reflect-metadata";
import { Inject, Injectable, Module } from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

describe("Resolver.destroy", () => {
	it("calls onModuleDestroy in reverse initialization order and only for the given tokens", async () => {
		const calls: string[] = [];

		@Injectable()
		class A {
			onModuleDestroy() {
				calls.push("A");
			}
		}
		@Injectable()
		class B {
			constructor(@Inject(A) readonly a: A) {}
			onModuleDestroy() {
				calls.push("B");
			}
		}
		@Injectable()
		class Kept {
			onModuleDestroy() {
				calls.push("Kept");
			}
		}
		@Module({ providers: [A, B, Kept] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		await container.get(B);
		await container.get(Kept);

		// biome-ignore lint/complexity/useLiteralKeys: private field, test-only
		const resolver = (
			container as unknown as {
				moduleGraphResolver: {
					destroy(tokens: unknown[]): Promise<void>;
					resolveProvider<T>(token: unknown): Promise<T>;
				};
			}
		).moduleGraphResolver;

		await resolver.destroy([A, B]);

		expect(calls).toEqual(["B", "A"]);
		expect(await container.get(Kept)).toBeInstanceOf(Kept);
	});

	it("skips a token that was never instantiated", async () => {
		@Injectable()
		class Untouched {
			onModuleDestroy = vi.fn();
		}
		@Module({ providers: [Untouched] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);

		// biome-ignore lint/complexity/useLiteralKeys: private field, test-only
		const resolver = (
			container as unknown as {
				moduleGraphResolver: {
					destroy(tokens: unknown[]): Promise<void>;
				};
			}
		).moduleGraphResolver;

		await expect(resolver.destroy([Untouched])).resolves.toBeUndefined();
	});
});
