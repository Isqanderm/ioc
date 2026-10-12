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
		await container.resolve(B);
		await container.resolve(Kept);

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
		expect(await container.resolve(Kept)).toBeInstanceOf(Kept);
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

		const resolver = (
			container as unknown as {
				moduleGraphResolver: {
					destroy(tokens: unknown[]): Promise<void>;
				};
			}
		).moduleGraphResolver;

		await expect(resolver.destroy([Untouched])).resolves.toBeUndefined();
	});

	it("runs every hook even if some throw, clears the cache, then throws one AggregateError", async () => {
		const calls: string[] = [];
		const boomA = new Error("A");
		const boomC = new Error("C");
		@Injectable()
		class A {
			onModuleDestroy() {
				calls.push("A");
				throw boomA;
			}
		}
		@Injectable()
		class B {
			onModuleDestroy() {
				calls.push("B");
			}
		}
		@Injectable()
		class C {
			onModuleDestroy() {
				calls.push("C");
				throw boomC;
			}
		}
		@Module({ providers: [A, B, C] })
		class AppModule {}

		const container = new Container(new HashUtil());
		await container.run(AppModule);
		await container.resolve(A);
		await container.resolve(B);
		await container.resolve(C);

		const resolver = (
			container as unknown as {
				moduleGraphResolver: {
					destroy(tokens: unknown[]): Promise<void>;
					initializationOrder: unknown[];
					providersContainer: { has(token: unknown): boolean };
				};
			}
		).moduleGraphResolver;

		const error = await resolver.destroy([A, B, C]).catch((e) => e);

		expect(calls).toEqual(["C", "B", "A"]);
		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toEqual([boomC, boomA]);
		expect(resolver.initializationOrder).toEqual([]);
		expect(resolver.providersContainer.has(A)).toBe(false);
		expect(resolver.providersContainer.has(C)).toBe(false);
	});
});
