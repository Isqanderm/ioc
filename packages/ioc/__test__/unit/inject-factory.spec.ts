import "reflect-metadata";
import {
	AsyncProviderInjectionError,
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
});
