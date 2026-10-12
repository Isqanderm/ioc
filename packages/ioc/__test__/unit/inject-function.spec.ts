import "reflect-metadata";
import {
	CircularInjectionError,
	Inject,
	Injectable,
	InjectionContextError,
	InjectionToken,
	inject,
	Module,
	NexusApplication,
	type OnModuleInit,
	ProviderNotFoundError,
	Scope,
} from "../../src";

describe("inject() in class providers", () => {
	it("injects in field initializers and constructor bodies", async () => {
		const URL = new InjectionToken<string>("URL");
		@Injectable()
		class Http {}
		@Injectable()
		class Api {
			readonly http = inject(Http);
			readonly url: string;
			constructor() {
				this.url = inject(URL);
			}
		}
		@Module({ providers: [Http, Api, { provide: URL, useValue: "u" }] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		const api = app.get(Api);
		expect(api.http).toBe(app.get(Http));
		expect(api.url).toBe("u");
	});

	it("creates a not-yet-created singleton synchronously and caches it", async () => {
		let created = 0;
		@Injectable()
		class Dep {
			constructor() {
				created++;
			}
		}
		@Injectable()
		class A {
			readonly dep = inject(Dep);
		}
		@Injectable()
		class B {
			readonly dep = inject(Dep);
		}
		// A listed before Dep so warm-up reaches A first
		@Module({ providers: [A, B, Dep] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(created).toBe(1);
		expect(app.get(A).dep).toBe(app.get(B).dep);
	});

	it("transient gives a new instance per inject(), scoped is shared within a tree", async () => {
		@Injectable({ scope: Scope.Transient })
		class T1 {}
		@Injectable({ scope: Scope.Scoped })
		class S1 {}
		@Injectable()
		class Holder {
			readonly t1 = inject(T1);
			readonly t2 = inject(T1);
			readonly s1 = inject(S1);
			readonly s2 = inject(S1);
		}
		@Module({ providers: [T1, S1, Holder] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		const h = app.get(Holder);
		expect(h.t1).not.toBe(h.t2);
		expect(h.s1).toBe(h.s2);
	});

	it("optional returns undefined for unknown tokens; otherwise ProviderNotFoundError names the requester", async () => {
		const NOPE = new InjectionToken<string>("NOPE");
		@Injectable()
		class Ok {
			readonly v = inject(NOPE, { optional: true });
		}
		@Module({ providers: [Ok] })
		class M1 {}
		const app = await NexusApplication.create(M1).bootstrap();
		expect(app.get(Ok).v).toBeUndefined();

		@Injectable()
		class Bad {
			readonly v = inject(NOPE);
		}
		@Module({ providers: [Bad] })
		class M2 {}
		const failing = NexusApplication.create(M2).bootstrap();
		await expect(failing).rejects.toThrow(/NOPE/);
		await expect(NexusApplication.create(M2).bootstrap()).rejects.toThrow(
			/Bad/,
		);
	});

	it("enforces module visibility", async () => {
		@Injectable()
		class Hidden {}
		@Module({ providers: [Hidden] }) // not exported
		class Inner {}
		@Injectable()
		class Outer {
			readonly h = inject(Hidden);
		}
		@Module({ imports: [Inner], providers: [Outer] })
		class M {}
		await expect(NexusApplication.create(M).bootstrap()).rejects.toThrow(
			ProviderNotFoundError,
		);
	});

	it("throws InjectionContextError outside of creation and in onModuleInit", async () => {
		expect(() => inject(class X {})).toThrow(InjectionContextError);

		@Injectable()
		class Dep {}
		@Injectable()
		class Late implements OnModuleInit {
			onModuleInit() {
				inject(Dep);
			}
		}
		@Module({ providers: [Dep, Late] })
		class M {}
		// onModuleInit failures are wrapped in "Failed to initialize provider ..."
		// (existing lifecycle behaviour), so match the InjectionContextError message.
		await expect(NexusApplication.create(M).bootstrap()).rejects.toThrow(
			/Failed to initialize provider "Late": inject\(Dep\) was called outside of an injection context/,
		);
	});

	it("restores the context and caches nothing when a constructor throws", async () => {
		@Injectable()
		class Dep {}
		@Injectable()
		class Boom {
			readonly d = inject(Dep);
			constructor() {
				throw new Error("ctor failed");
			}
		}
		@Module({ providers: [Dep, Boom] })
		class M {}
		const app = NexusApplication.create(M).lazy();
		await app.bootstrap();
		await expect(app.resolve(Boom)).rejects.toThrow("ctor failed");
		expect(() => inject(Dep)).toThrow(InjectionContextError);
		await expect(app.resolve(Boom)).rejects.toThrow("ctor failed"); // not cached
	});

	it("detects cycles through inject()", async () => {
		@Injectable()
		class A {
			readonly b = inject(B);
		}
		@Injectable()
		class B {
			readonly a = inject(A);
		}
		@Module({ providers: [A, B] })
		class M {}
		const error = await NexusApplication.create(M)
			.bootstrap()
			.catch((e) => e);
		expect(error).toBeInstanceOf(CircularInjectionError);
		expect(String(error.message)).toMatch(/A -> B -> A/);
	});

	it("awaits async onModuleInit of injected deps before the requester's onModuleInit", async () => {
		const order: string[] = [];
		@Injectable()
		class Db implements OnModuleInit {
			ready = false;
			async onModuleInit() {
				await new Promise((r) => setTimeout(r, 5));
				this.ready = true;
				order.push("db");
			}
		}
		@Injectable()
		class Repo implements OnModuleInit {
			readonly db = inject(Db);
			onModuleInit() {
				order.push(`repo sees ready=${this.db.ready}`);
			}
		}
		@Module({ providers: [Repo, Db] })
		class M {}
		await NexusApplication.create(M).bootstrap();
		expect(order).toEqual(["db", "repo sees ready=true"]);
	});

	it("defers onModuleInit of a provider created by inject() until its own injected deps are initialized", async () => {
		const order: string[] = [];
		@Injectable()
		class Db implements OnModuleInit {
			ready = false;
			async onModuleInit() {
				await new Promise((r) => setTimeout(r, 5));
				this.ready = true;
				order.push("db");
			}
		}
		@Injectable()
		class Repo implements OnModuleInit {
			readonly db = inject(Db);
			onModuleInit() {
				order.push(`repo sees ready=${this.db.ready}`);
			}
		}
		@Injectable()
		class Svc implements OnModuleInit {
			readonly repo = inject(Repo);
			onModuleInit() {
				order.push("svc");
			}
		}
		@Module({ providers: [Svc, Repo, Db] })
		class M {}
		await NexusApplication.create(M).bootstrap();
		expect(order).toEqual(["db", "repo sees ready=true", "svc"]);
	});

	it("mixes with @Inject constructor params", async () => {
		@Injectable()
		class Dep {}
		@Injectable()
		class Other {}
		@Injectable()
		class Mixed {
			readonly other = inject(Other);
			constructor(@Inject(Dep) readonly dep: Dep) {}
		}
		@Module({ providers: [Dep, Other, Mixed] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(Mixed).dep).toBe(app.get(Dep));
		expect(app.get(Mixed).other).toBe(app.get(Other));
	});

	it("runs onModuleInit of a provider created by inject() outside any injection context", async () => {
		@Injectable()
		class X {}
		@Injectable()
		class S implements OnModuleInit {
			onModuleInit() {
				inject(X);
			}
		}
		@Injectable()
		class Parent {
			readonly s = inject(S);
		}
		@Module({ providers: [Parent, S, X] })
		class M {}
		// onModuleInit failures are wrapped (existing lifecycle behaviour).
		await expect(NexusApplication.create(M).bootstrap()).rejects.toThrow(
			/Failed to initialize provider "S": inject\(X\) was called outside of an injection context/,
		);
	});

	it("waits for a cached dep's pending async init before a later requester's onModuleInit", async () => {
		const order: string[] = [];
		@Injectable()
		class Db implements OnModuleInit {
			ready = false;
			async onModuleInit() {
				await new Promise((r) => setTimeout(r, 5));
				this.ready = true;
			}
		}
		@Injectable()
		class A {
			readonly db = inject(Db);
		}
		@Injectable()
		class B implements OnModuleInit {
			readonly db = inject(Db); // cache hit: Db was created by A
			onModuleInit() {
				order.push(`B sees ready=${this.db.ready}`);
			}
		}
		@Injectable()
		class Root {
			readonly a = inject(A);
			readonly b = inject(B);
		}
		@Module({ providers: [Root, A, B, Db] })
		class M {}
		await NexusApplication.create(M).bootstrap();
		expect(order).toEqual(["B sees ready=true"]);
	});

	it("evicts a singleton created by inject() whose async onModuleInit failed", async () => {
		const created: object[] = [];
		const destroyed: object[] = [];
		let failNext = true;
		@Injectable()
		class S implements OnModuleInit {
			constructor() {
				created.push(this);
			}
			async onModuleInit() {
				if (failNext) {
					failNext = false;
					throw new Error("init failed");
				}
			}
			onModuleDestroy() {
				destroyed.push(this);
			}
		}
		@Injectable()
		class Parent {
			readonly s = inject(S);
		}
		@Module({ providers: [Parent, S] })
		class M {}
		const app = NexusApplication.create(M).lazy();
		await app.bootstrap();
		await expect(app.resolve(Parent)).rejects.toThrow(/init failed/);
		const broken = created[0];

		const fresh = await app.resolve(S);
		expect(fresh).not.toBe(broken);
		expect(created).toHaveLength(2);

		await app.close();
		expect(destroyed).not.toContain(broken);
		expect(destroyed).toContain(fresh);
	});

	it("evicts an init-less dependent that holds an instance whose async init failed", async () => {
		let failNext = true;
		const mids: object[] = [];
		const destroyed: object[] = [];
		@Injectable()
		class S implements OnModuleInit {
			async onModuleInit() {
				if (failNext) {
					failNext = false;
					throw new Error("init failed");
				}
			}
		}
		@Injectable()
		class Mid {
			readonly s = inject(S);
			constructor() {
				mids.push(this);
			}
			onModuleDestroy() {
				destroyed.push(this);
			}
		}
		@Injectable()
		class Root {
			readonly mid = inject(Mid);
		}
		@Module({ providers: [Root, Mid, S] })
		class M {}
		const app = NexusApplication.create(M).lazy();
		await app.bootstrap();
		await expect(app.resolve(Root)).rejects.toThrow(/init failed/);
		const stale = mids[0] as Mid;

		const mid = await app.resolve(Mid);
		expect(mid).not.toBe(stale);
		expect(mid.s).not.toBe(stale.s);
		expect(mid.s).toBe(await app.resolve(S));

		await app.close();
		expect(destroyed).not.toContain(stale);
		expect(destroyed).toContain(mid);
	});
});

describe("inject() and async onModuleInit across resolution trees", () => {
	const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

	it("a concurrent requester waits for a singleton whose init another tree started", async () => {
		const log: string[] = [];
		@Injectable()
		class S {
			ready = false;
			async onModuleInit() {
				await tick();
				this.ready = true;
			}
		}
		@Injectable()
		class A {
			readonly s = inject(S);
			onModuleInit() {
				log.push(`A sees ready=${this.s.ready}`);
			}
		}
		@Injectable()
		class B {
			readonly s = inject(S);
			onModuleInit() {
				log.push(`B sees ready=${this.s.ready}`);
			}
		}
		@Module({ providers: [S, A, B] })
		class M {}
		const app = NexusApplication.create(M).lazy();
		await app.bootstrap();
		await Promise.all([app.resolve(A), app.resolve(B)]);
		expect(log.sort()).toEqual(["A sees ready=true", "B sees ready=true"]);
	});

	it("resolve() of a singleton waits for its in-flight init started by inject()", async () => {
		@Injectable()
		class S {
			ready = false;
			async onModuleInit() {
				await tick();
				this.ready = true;
			}
		}
		@Injectable()
		class A {
			readonly s = inject(S);
		}
		@Module({ providers: [S, A] })
		class M {}
		const app = NexusApplication.create(M).lazy();
		await app.bootstrap();
		const pendingA = app.resolve(A);
		const s = await app.resolve(S);
		expect(s.ready).toBe(true);
		expect((await pendingA).s).toBe(s);
	});

	it("a requester in another tree is not cached holding a singleton whose init failed", async () => {
		let n = 0;
		@Injectable()
		class S {
			readonly id = ++n;
			async onModuleInit() {
				await tick();
				if (this.id === 1) {
					throw new Error("boom");
				}
			}
		}
		@Injectable()
		class A {
			readonly s = inject(S);
		}
		@Injectable()
		class B {
			readonly s = inject(S);
		}
		@Module({ providers: [S, A, B] })
		class M {}
		const app = NexusApplication.create(M).lazy();
		await app.bootstrap();
		const results = await Promise.allSettled([app.resolve(A), app.resolve(B)]);
		expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
		const b = await app.resolve(B);
		const s = await app.resolve(S);
		expect(s.id).toBe(2);
		expect(b.s).toBe(s);
	});

	it("does not orphan the init of a singleton inject() created before the constructor threw", async () => {
		let inits = 0;
		@Injectable()
		class S {
			done = false;
			async onModuleInit() {
				await tick();
				inits++;
				this.done = true;
			}
		}
		@Injectable()
		class A {
			readonly s = inject(S);
			constructor() {
				throw new Error("ctor");
			}
		}
		@Module({ providers: [S, A] })
		class M {}
		const app = NexusApplication.create(M).lazy();
		await app.bootstrap();
		await expect(app.resolve(A)).rejects.toThrow("ctor");
		const s = await app.resolve(S);
		expect(s.done).toBe(true);
		expect(inits).toBe(1);
	});

	it("evicts a singleton inject() created before the constructor threw when its init fails", async () => {
		let n = 0;
		@Injectable()
		class S {
			readonly id = ++n;
			async onModuleInit() {
				await tick();
				if (this.id === 1) {
					throw new Error("boom");
				}
			}
		}
		@Injectable()
		class A {
			readonly s = inject(S);
			constructor() {
				throw new Error("ctor");
			}
		}
		@Module({ providers: [S, A] })
		class M {}
		const app = NexusApplication.create(M).lazy();
		await app.bootstrap();
		await expect(app.resolve(A)).rejects.toThrow("ctor");
		await expect(app.resolve(S)).rejects.toThrow(/boom/);
		const s = await app.resolve(S);
		expect(s.id).toBe(2);
	});
});

describe("inject() details", () => {
	it("keeps the original error as cause when onModuleInit fails", async () => {
		@Injectable()
		class Dep {}
		@Injectable()
		class Late implements OnModuleInit {
			onModuleInit() {
				inject(Dep);
			}
		}
		@Module({ providers: [Dep, Late] })
		class M {}
		const error = await NexusApplication.create(M)
			.bootstrap()
			.then(
				() => undefined,
				(e: unknown) => e,
			);
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toMatch(
			/Failed to initialize provider "Late": inject\(Dep\)/,
		);
		expect((error as { cause?: unknown }).cause).toBeInstanceOf(
			InjectionContextError,
		);
	});

	it("works in constructor parameter defaults", async () => {
		@Injectable()
		class Dep {}
		@Injectable()
		class A {
			constructor(readonly dep: Dep = inject(Dep)) {}
		}
		@Module({ providers: [Dep, A] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(A).dep).toBe(app.get(Dep));
	});
});
