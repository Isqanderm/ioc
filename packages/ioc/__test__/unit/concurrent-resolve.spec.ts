import "reflect-metadata";
import {
	forwardRef,
	Inject,
	Injectable,
	inject,
	Module,
	NexusApplication,
	ProviderNotInstantiatedError,
} from "../../src";

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

const TIMED_OUT = Symbol("timed out");
/** Resolves to TIMED_OUT if `promise` has not settled within `ms`. */
function withTimeout<T>(
	promise: Promise<T>,
	ms = 200,
): Promise<T | typeof TIMED_OUT> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
		timer = setTimeout(() => resolve(TIMED_OUT), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function lazyApp(module: new () => unknown) {
	return NexusApplication.create(module).lazy().bootstrap();
}

describe("concurrent resolution creates each singleton once", () => {
	it("two concurrent resolve(S) construct and init S once", async () => {
		let constructed = 0;
		let inits = 0;
		let destroys = 0;
		@Injectable()
		class S {
			constructor() {
				constructed++;
			}
			async onModuleInit() {
				await tick();
				inits++;
			}
			onModuleDestroy() {
				destroys++;
			}
		}
		@Module({ providers: [S] })
		class M {}

		const app = await lazyApp(M);
		const [a, b] = await Promise.all([app.resolve(S), app.resolve(S)]);

		expect(a).toBe(b);
		expect(app.get(S)).toBe(a);
		expect(constructed).toBe(1);
		expect(inits).toBe(1);

		await app.close();
		expect(destroys).toBe(1);
	});

	it("two requesters that both @Inject(S) share one S", async () => {
		let constructed = 0;
		@Injectable()
		class S {
			constructor() {
				constructed++;
			}
			async onModuleInit() {
				await tick();
			}
		}
		@Injectable()
		class A {
			constructor(@Inject(S) public s: S) {}
		}
		@Injectable()
		class B {
			constructor(@Inject(S) public s: S) {}
		}
		@Module({ providers: [S, A, B] })
		class M {}

		const app = await lazyApp(M);
		const [a, b] = await Promise.all([app.resolve(A), app.resolve(B)]);

		expect(a.s).toBe(b.s);
		expect(app.get(S)).toBe(a.s);
		expect(constructed).toBe(1);
		await app.close();
	});

	it("a failed creation rejects every waiter and can be retried", async () => {
		let constructed = 0;
		let fail = true;
		@Injectable()
		class D {
			async onModuleInit() {
				await tick();
			}
		}
		@Injectable()
		class S {
			constructor(@Inject(D) public d: D) {
				constructed++;
				if (fail) {
					throw new Error("boom");
				}
			}
		}
		@Module({ providers: [D, S] })
		class M {}

		const app = await lazyApp(M);
		const results = await Promise.allSettled([app.resolve(S), app.resolve(S)]);

		expect(results.map((result) => result.status)).toEqual([
			"rejected",
			"rejected",
		]);
		const [first, second] = results as PromiseRejectedResult[];
		expect(first.reason).toBe(second.reason);
		expect((first.reason as Error).message).toBe("boom");
		expect(constructed).toBe(1);
		expect(() => app.get(S)).toThrow(ProviderNotInstantiatedError);

		fail = false;
		const s = await app.resolve(S);
		expect(s).toBeInstanceOf(S);
		expect(constructed).toBe(2);
		expect(app.get(S)).toBe(s);
		await app.close();
	});

	it("a failed onModuleInit rejects every waiter and can be retried", async () => {
		let constructed = 0;
		let fail = true;
		@Injectable()
		class S {
			constructor() {
				constructed++;
			}
			async onModuleInit() {
				await tick();
				if (fail) {
					throw new Error("init boom");
				}
			}
		}
		@Module({ providers: [S] })
		class M {}

		const app = await lazyApp(M);
		const results = await Promise.allSettled([app.resolve(S), app.resolve(S)]);
		expect(results.map((result) => result.status)).toEqual([
			"rejected",
			"rejected",
		]);
		expect(constructed).toBe(1);

		fail = false;
		const s = await app.resolve(S);
		expect(constructed).toBe(2);
		expect(app.get(S)).toBe(s);
		await app.close();
	});

	it("inject() of a singleton whose creation is in flight throws ProviderNotInstantiatedError", async () => {
		let constructed = 0;
		@Injectable()
		class S {
			constructor() {
				constructed++;
			}
			async onModuleInit() {
				await tick();
			}
		}
		@Injectable()
		class R {
			s = inject(S);
		}
		@Module({ providers: [S, R] })
		class M {}

		const app = await lazyApp(M);
		const [s, r] = await Promise.allSettled([app.resolve(S), app.resolve(R)]);

		expect(s.status).toBe("fulfilled");
		expect(r.status).toBe("rejected");
		const error = (r as PromiseRejectedResult).reason;
		expect(error).toBeInstanceOf(ProviderNotInstantiatedError);
		expect((error as Error).message).toMatch(/still being created/);
		expect(constructed).toBe(1);

		// Once the creation settled, inject() gets the cached instance.
		const resolved = await app.resolve(R);
		expect(resolved.s).toBe((s as PromiseFulfilledResult<S>).value);
		expect(constructed).toBe(1);
		await app.close();
	});

	it("an in-flight creation and an in-flight inject() init never deadlock", async () => {
		const counts = { X: 0, R: 0, T: 0 };
		@Injectable()
		class X {
			constructor() {
				counts.X++;
			}
			async onModuleInit() {
				await tick(20);
			}
		}
		// R is created by resolve(); X is created by inject() on the sync
		// path and tracked in inFlightInits while R's creation is in flight.
		@Injectable()
		class R {
			x = inject(X);
			async onModuleInit() {
				await tick();
			}
			constructor() {
				counts.R++;
			}
		}
		// T meets X (cached, init in flight) and R (creation in flight).
		@Injectable()
		class T {
			constructor(
				@Inject(X) public x: X,
				@Inject(R) public r: R,
			) {
				counts.T++;
			}
		}
		// U creates its own X lookup through inject() while both are in flight.
		@Injectable()
		class U {
			x = inject(X);
		}
		@Module({ providers: [X, R, T, U] })
		class M {}

		const app = await lazyApp(M);
		const all = Promise.all([
			app.resolve(R),
			app.resolve(T),
			app.resolve(R),
			app.resolve(U),
		]);
		const result = await withTimeout(all, 1000);
		expect(result).not.toBe(TIMED_OUT);
		const [r1, t, r2, u] = result as [R, T, R, U];

		expect(r1).toBe(r2);
		expect(t.r).toBe(r1);
		expect(t.x).toBe(r1.x);
		expect(u.x).toBe(r1.x);
		expect(counts).toEqual({ X: 1, R: 1, T: 1 });
		await app.close();
	});

	it("concurrent resolution of both sides of a forwardRef cycle neither deadlocks nor duplicates", async () => {
		const counts = { A: 0, B: 0 };
		@Injectable()
		class D {
			async onModuleInit() {
				await tick();
			}
		}
		@Injectable()
		class A {
			constructor(
				@Inject(D) public d: D,
				@Inject(forwardRef(() => B)) public b: B,
			) {
				counts.A++;
			}
			name() {
				return "A";
			}
		}
		@Injectable()
		class B {
			constructor(@Inject(forwardRef(() => A)) public a: A) {
				counts.B++;
			}
			name() {
				return "B";
			}
		}
		@Module({ providers: [D, A, B] })
		class M {}

		const app = await lazyApp(M);
		// A's creation waits on D first, so resolve(B) starts B while A is in
		// flight in the other tree.
		const result = await withTimeout(
			Promise.all([app.resolve(A), app.resolve(B)]),
			1000,
		);
		expect(result).not.toBe(TIMED_OUT);
		const [a, b] = result as [A, B];

		expect(counts).toEqual({ A: 1, B: 1 });
		expect(a.b).toBe(b);
		expect(app.get(A)).toBe(a);
		expect(app.get(B)).toBe(b);
		expect(b.a.name()).toBe("A");
		await app.close();
	});

	/*
	 * Self-resolution (documented, not detected): S's onModuleInit awaits
	 * app.resolve(A) where A depends on S. That resolve waits for S's
	 * creation, which waits for the init, which waits for the resolve. The
	 * app.resolve() inside the init starts a new resolution tree, and the
	 * library has no async context to link it to the tree creating S, so it
	 * cannot be told apart from an unrelated concurrent resolve(S) that must
	 * wait. The README documents that such a resolution never settles.
	 */
	it("self-resolution from onModuleInit never settles and constructs S once (documented)", async () => {
		let constructed = 0;
		let app: NexusApplication | undefined;
		@Injectable()
		class S {
			constructor() {
				constructed++;
			}
			async onModuleInit() {
				// Capped so a regression to "construct again" cannot recurse forever.
				if (constructed < 5) {
					await app?.resolve(A);
				}
			}
		}
		@Injectable()
		class A {
			constructor(@Inject(S) public s: S) {}
		}
		@Module({ providers: [S, A] })
		class M {}

		app = await lazyApp(M);
		const result = await withTimeout(app.resolve(S), 100);

		expect(result).toBe(TIMED_OUT);
		expect(constructed).toBe(1);
		expect(() => app?.get(S)).toThrow(ProviderNotInstantiatedError);
		await app.close();
	});
});
