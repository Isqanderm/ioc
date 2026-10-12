import "reflect-metadata";
import {
	Inject,
	Injectable,
	InjectionToken,
	inject,
	Module,
	NexusApplication,
	type OnModuleDestroy,
	type OnModuleInit,
	ProviderNotFoundError,
	ProviderNotInstantiatedError,
	Scope,
} from "../../src";

const destroyed: string[] = [];

@Injectable()
class Http implements OnModuleDestroy {
	onModuleDestroy(): void {
		destroyed.push("Http");
	}
}

let clockCount = 0;

@Injectable({ scope: Scope.Transient })
class Clock {
	readonly n = ++clockCount;
}

@Injectable()
class Secret {}

@Module({ providers: [Http, Clock], exports: [Http, Clock] })
class HttpModule {}

@Module({ providers: [Secret] })
class SecretModule {}

/** Root app: `ShellModule` imports `HttpModule` and declares `children`. */
async function bootRoot(children: unknown[]): Promise<NexusApplication> {
	@Module({ imports: [HttpModule], children: children as never })
	class ShellModule {}

	@Module({ imports: [ShellModule, SecretModule] })
	class AppModule {}

	return NexusApplication.create(AppModule).bootstrap();
}

interface ResolverInternals {
	providersContainer: { has(token: unknown): boolean };
	initializationOrder: unknown[];
	inFlightCreations: Map<unknown, unknown>;
	inFlightInits: Map<unknown, unknown>;
}

function resolverOf(app: NexusApplication): ResolverInternals {
	return (
		app as unknown as {
			container: { moduleGraphResolver: ResolverInternals };
		}
	).container.moduleGraphResolver;
}

function expectNotCachedIn(app: NexusApplication, token: unknown): void {
	const resolver = resolverOf(app);
	expect(resolver.providersContainer.has(token)).toBe(false);
	expect(resolver.initializationOrder).not.toContain(token);
	expect(resolver.inFlightCreations.has(token)).toBe(false);
	expect(resolver.inFlightInits.has(token)).toBe(false);
}

beforeEach(() => {
	destroyed.length = 0;
	clockCount = 0;
});

describe("child resolution through the parent link", () => {
	it("injects the parent's singleton into a child singleton", async () => {
		@Injectable()
		class ProfileStore {
			constructor(@Inject(Http) readonly http: Http) {}
		}
		@Module({ providers: [ProfileStore] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.get(ProfileStore).http).toBe(app.get(Http));
		expectNotCachedIn(child, Http);
	});

	it("injects the parent's singleton into a property", async () => {
		@Injectable()
		class ProfileStore {
			@Inject(Http) readonly http!: Http;
		}
		@Module({ providers: [ProfileStore] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.get(ProfileStore).http).toBe(app.get(Http));
		expectNotCachedIn(child, Http);
	});

	it("passes the parent's singleton to a child factory", async () => {
		const FACTORY = new InjectionToken<Http>("FACTORY");
		@Module({
			providers: [
				{ provide: FACTORY, useFactory: (http: Http) => http, inject: [Http] },
			],
		})
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.get(FACTORY)).toBe(app.get(Http));
		expectNotCachedIn(child, Http);
	});

	it("creates a new parent Transient for each child singleton", async () => {
		@Injectable()
		class A {
			constructor(@Inject(Clock) readonly clock: Clock) {}
		}
		@Injectable()
		class B {
			constructor(@Inject(Clock) readonly clock: Clock) {}
		}
		@Module({ providers: [A, B] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const before = clockCount;
		const child = await app.createChild(ProfileModule);

		expect(clockCount - before).toBe(2);
		expect(child.get(A).clock).toBeInstanceOf(Clock);
		expect(child.get(A).clock).not.toBe(child.get(B).clock);
		expectNotCachedIn(child, Clock);
	});

	it("child.close() does not destroy the parent's providers", async () => {
		@Injectable()
		class ProfileStore {
			constructor(@Inject(Http) readonly http: Http) {}
		}
		@Module({ providers: [ProfileStore] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);
		await child.close();

		expect(destroyed).toEqual([]);
		expect(app.get(Http)).toBeInstanceOf(Http);
	});

	it("a grandchild gets the root's instance", async () => {
		@Injectable()
		class TabConsumer {
			constructor(@Inject(Http) readonly http: Http) {}
		}
		@Module({ providers: [TabConsumer] })
		class TabModule {}
		@Module({ children: [TabModule] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);
		const grandchild = await child.createChild(TabModule);

		expect(grandchild.get(TabConsumer).http).toBe(app.get(Http));
		expectNotCachedIn(child, Http);
		expectNotCachedIn(grandchild, Http);
	});

	it("the child's own Http shadows the parent's", async () => {
		@Injectable()
		class ProfileStore {
			constructor(@Inject(Http) readonly http: Http) {}
		}
		@Module({ providers: [Http, ProfileStore] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.get(ProfileStore).http).toBe(child.get(Http));
		expect(child.get(Http)).not.toBe(app.get(Http));
	});

	it("child.get falls back to the link; an encapsulated token is not found", async () => {
		@Module({ providers: [] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.get(Http)).toBe(app.get(Http));
		expect(() => child.get(Secret)).toThrow(ProviderNotFoundError);
	});

	describe("a non-optional external dependency is never silently undefined", () => {
		it("requester created by resolve()", async () => {
			const seen: unknown[] = [];
			@Injectable({ scope: Scope.Transient })
			class Requester {
				@Inject(Http) readonly prop!: Http;
				constructor(@Inject(Http) readonly http: Http) {
					seen.push(http);
				}
			}
			@Module({ providers: [Requester] })
			class ProfileModule {}

			const app = await bootRoot([ProfileModule]);
			const child = await app.createChild(ProfileModule);
			const requester = await child.resolve(Requester);

			expect(seen).toEqual([app.get(Http)]);
			expect(requester.http).toBe(app.get(Http));
			expect(requester.prop).toBe(app.get(Http));
			expectNotCachedIn(child, Http);
		});

		it("requester created via inject() (sync path)", async () => {
			const seen: unknown[] = [];
			@Injectable({ scope: Scope.Transient })
			class Requester {
				@Inject(Http) readonly prop!: Http;
				constructor(@Inject(Http) readonly http: Http) {
					seen.push(http);
				}
			}
			@Injectable()
			class Host {
				readonly requester = inject(Requester);
			}
			@Module({ providers: [Requester, Host] })
			class ProfileModule {}

			const app = await bootRoot([ProfileModule]);
			const child = await app.createChild(ProfileModule);
			const { requester } = child.get(Host);

			expect(seen).toEqual([app.get(Http)]);
			expect(requester.http).toBe(app.get(Http));
			expect(requester.prop).toBe(app.get(Http));
			expectNotCachedIn(child, Http);
		});
	});

	describe("parity: a token in the child graph the requester cannot see", () => {
		// Same fixture as compile.spec.ts: `InnerModule` provides its own
		// `Http` without exporting it, so the child graph has a hidden `Http`
		// node, while the parent provides `Http` through the link.
		@Module({ providers: [Http] })
		class InnerModule {}

		it("an @Inject edge resolves to the parent's instance, not the hidden one", async () => {
			@Injectable()
			class Consumer {
				constructor(@Inject(Http) readonly http: Http) {}
			}
			@Module({ imports: [InnerModule], providers: [Consumer] })
			class ProfileModule {}

			const app = await bootRoot([ProfileModule]);
			const child = await app.createChild(ProfileModule);

			expect(child.get(Consumer).http).toBe(app.get(Http));
		});

		it("a property @Inject resolves to the parent's instance, not the hidden one", async () => {
			@Injectable()
			class Consumer {
				@Inject(Http) readonly http!: Http;
			}
			@Module({ imports: [InnerModule], providers: [Consumer] })
			class ProfileModule {}

			const app = await bootRoot([ProfileModule]);
			const child = await app.createChild(ProfileModule);

			expect(child.get(Consumer).http).toBe(app.get(Http));
		});

		it("the same holds for a requester created via inject()", async () => {
			@Injectable({ scope: Scope.Transient })
			class Consumer {
				constructor(@Inject(Http) readonly http: Http) {}
			}
			@Injectable()
			class Host {
				readonly consumer = inject(Consumer);
			}
			@Module({ imports: [InnerModule], providers: [Consumer, Host] })
			class ProfileModule {}

			const app = await bootRoot([ProfileModule]);
			const child = await app.createChild(ProfileModule);

			expect(child.get(Host).consumer.http).toBe(app.get(Http));
		});
	});
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

describe("child resolution while the parent is still initialising", () => {
	const unhandled: unknown[] = [];
	const onUnhandled = (error: unknown) => unhandled.push(error);
	beforeEach(() => {
		unhandled.length = 0;
		process.on("unhandledRejection", onUnhandled);
	});
	afterEach(async () => {
		await new Promise((r) => setTimeout(r, 20));
		process.off("unhandledRejection", onUnhandled);
		expect(unhandled).toEqual([]);
	});

	it("createChild waits for a lazy parent's singleton whose async init is in flight", async () => {
		const gate = deferred();
		let constructed = 0;
		@Injectable()
		class Slow implements OnModuleInit {
			ready = false;
			constructor() {
				constructed++;
			}
			async onModuleInit(): Promise<void> {
				await gate.promise;
				this.ready = true;
			}
		}
		@Module({ providers: [Slow], exports: [Slow] })
		class SlowModule {}
		@Injectable()
		class Store {
			readonly ready: boolean;
			constructor(@Inject(Slow) readonly slow: Slow) {
				this.ready = slow.ready;
			}
		}
		@Module({ providers: [Store] })
		class ChildModule {}
		@Module({ imports: [SlowModule], children: [ChildModule] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).lazy().bootstrap();
		const parentResolve = app.resolve(Slow);
		await Promise.resolve();
		expect(() => app.get(Slow)).toThrow(ProviderNotInstantiatedError);

		let done = false;
		const childPromise = app.createChild(ChildModule).then((c) => {
			done = true;
			return c;
		});
		await new Promise((r) => setTimeout(r, 20));
		expect(done).toBe(false);

		gate.resolve();
		const child = await childPromise;
		expect(child.get(Store).ready).toBe(true);
		expect(child.get(Store).slow).toBe(await parentResolve);
		expect(constructed).toBe(1);
	});

	it("an inject() requester rejects while the parent init is in flight, then succeeds", async () => {
		const gate = deferred();
		@Injectable()
		class Slow implements OnModuleInit {
			async onModuleInit(): Promise<void> {
				await gate.promise;
			}
		}
		@Module({ providers: [Slow], exports: [Slow] })
		class SlowModule {}
		@Injectable({ scope: Scope.Transient })
		class Requester {
			constructor(@Inject(Slow) readonly slow: Slow) {}
		}
		@Injectable({ scope: Scope.Transient })
		class Host {
			readonly requester = inject(Requester);
		}
		@Module({ providers: [Requester, Host] })
		class ChildModule {}
		@Module({ imports: [SlowModule], children: [ChildModule] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).lazy().bootstrap();
		const child = await app.createChild(ChildModule);
		const parentResolve = app.resolve(Slow);
		await Promise.resolve();

		await expect(child.resolve(Host)).rejects.toBeInstanceOf(
			ProviderNotInstantiatedError,
		);

		gate.resolve();
		await parentResolve;
		const host = await child.resolve(Host);
		expect(host.requester.slow).toBe(app.get(Slow));
	});

	it("a parent dependency failing during child bootstrap rejects createChild and cleans up the child", async () => {
		const destroyedInChild: string[] = [];
		@Injectable()
		class Bad implements OnModuleInit {
			async onModuleInit(): Promise<void> {
				throw new Error("boom");
			}
		}
		@Module({ providers: [Bad], exports: [Bad] })
		class BadModule {}
		@Injectable()
		class First implements OnModuleDestroy {
			onModuleDestroy(): void {
				destroyedInChild.push("First");
			}
		}
		@Injectable()
		class Store {
			constructor(
				@Inject(First) readonly first: First,
				@Inject(Bad) readonly bad: Bad,
			) {}
		}
		@Module({ providers: [First, Store] })
		class ChildModule {}
		@Module({ imports: [BadModule], children: [ChildModule] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).lazy().bootstrap();

		await expect(app.createChild(ChildModule)).rejects.toThrow(/boom/);
		expect(destroyedInChild).toEqual(["First"]);
		expect(
			(app as unknown as { liveChildren: Set<NexusApplication> }).liveChildren
				.size,
		).toBe(0);
	});
});
