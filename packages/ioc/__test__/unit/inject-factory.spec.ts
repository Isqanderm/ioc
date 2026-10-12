import "reflect-metadata";
import {
	AsyncProviderInjectionError,
	Inject,
	Injectable,
	InjectionContextError,
	InjectionToken,
	inject,
	Module,
	NexusApplication,
} from "../../src";

describe("inject() in factories", () => {
	it("works in the synchronous part of useFactory", async () => {
		const BASE = new InjectionToken<string>("BASE");
		const URL = new InjectionToken<string>("URL");
		@Module({
			providers: [
				{ provide: BASE, useValue: "https://x" },
				{ provide: URL, useFactory: () => `${inject(BASE)}/api` },
			],
		})
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(URL)).toBe("https://x/api");
	});

	it("works before the first await of an async factory", async () => {
		const BASE = new InjectionToken<string>("BASE");
		const OK = new InjectionToken<string>("OK");
		@Module({
			providers: [
				{ provide: BASE, useValue: "b" },
				{
					provide: OK,
					useFactory: async () => {
						const base = inject(BASE);
						await Promise.resolve();
						return base;
					},
				},
			],
		})
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(OK)).toBe("b");
	});

	it("throws after the first await of an async factory", async () => {
		const BASE = new InjectionToken<string>("BASE");
		const BAD = new InjectionToken<string>("BAD");
		@Module({
			providers: [
				{ provide: BASE, useValue: "b" },
				{
					provide: BAD,
					useFactory: async () => {
						await Promise.resolve();
						return inject(BASE);
					},
				},
			],
		})
		class M {}
		await expect(NexusApplication.create(M).bootstrap()).rejects.toThrow(
			InjectionContextError,
		);
	});

	it("class providers can inject() an async-factory provider: factories are warmed first", async () => {
		const DB = new InjectionToken<{ ok: boolean }>("DB");
		@Injectable()
		class Repo {
			readonly db = inject(DB);
		}
		@Module({
			providers: [
				Repo,
				{ provide: DB, useFactory: async () => ({ ok: true }) },
			],
		})
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(Repo).db.ok).toBe(true);
	});

	it("throws AsyncProviderInjectionError when an async factory is not created yet", async () => {
		const DB = new InjectionToken<{ ok: boolean }>("DB");
		@Injectable()
		class Repo {
			readonly db = inject(DB);
		}
		@Module({
			providers: [
				Repo,
				{ provide: DB, useFactory: async () => ({ ok: true }) },
			],
		})
		class M {}
		const app = await NexusApplication.create(M).lazy().bootstrap();
		await expect(app.resolve(Repo)).rejects.toThrow(
			AsyncProviderInjectionError,
		);
	});

	it("bootstrap() retries a factory whose inject() needs an async factory declared later", async () => {
		const DB = new InjectionToken<{ ok: boolean }>("DB");
		const F = new InjectionToken<Repo>("F");
		@Injectable()
		class Repo {
			constructor(@Inject(DB) readonly db: { ok: boolean }) {}
		}
		@Module({
			providers: [
				Repo,
				{ provide: F, useFactory: () => inject(Repo) },
				{ provide: DB, useFactory: async () => ({ ok: true }) },
			],
		})
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(F)).toBe(app.get(Repo));
		expect(app.get(F).db.ok).toBe(true);
	});

	it("bootstrap() still fails, naming the chain, when async factories need each other", async () => {
		const A = new InjectionToken<object>("A");
		const B = new InjectionToken<object>("B");
		@Injectable()
		class NeedsA {
			constructor(@Inject(A) readonly a: object) {}
		}
		@Injectable()
		class NeedsB {
			constructor(@Inject(B) readonly b: object) {}
		}
		@Module({
			providers: [
				NeedsA,
				NeedsB,
				{
					provide: A,
					useFactory: async () => ({ b: inject(NeedsB) }),
				},
				{
					provide: B,
					useFactory: async () => ({ a: inject(NeedsA) }),
				},
			],
		})
		class M {}
		const error = await NexusApplication.create(M)
			.bootstrap()
			.then(
				() => undefined,
				(e: unknown) => e,
			);
		expect(error).toBeInstanceOf(AsyncProviderInjectionError);
		expect((error as Error).message).toContain(
			"(via InjectionToken B -> NeedsA -> InjectionToken A)",
		);
	});
});
