import "reflect-metadata";
import {
	AsyncFactoryError,
	Injectable,
	InjectionToken,
	inject,
	Module,
	NexusApplication,
	type OnModuleInit,
} from "../../src";

const DB = new InjectionToken<{ ok: boolean }>("DB");

describe("async factories are rejected", () => {
	it("bootstrap fails with AsyncFactoryError naming the token", async () => {
		@Module({
			providers: [{ provide: DB, useFactory: async () => ({ ok: true }) }],
		})
		class M {}
		const error = await NexusApplication.create(M)
			.bootstrap()
			.catch((e) => e);
		expect(error).toBeInstanceOf(AsyncFactoryError);
		expect(String(error.message)).toMatch(/InjectionToken DB/);
		expect(String(error.message)).toMatch(/onModuleInit/);
		expect(String(error.message)).toMatch(/object the factory returns/);
	});

	it("a non-promise thenable fails without its then() being called", async () => {
		const then = vi.fn((resolve: (value: number) => void) => resolve(1));
		@Module({
			providers: [{ provide: DB, useFactory: () => ({ then }) }],
		})
		class M {}
		await expect(NexusApplication.create(M).bootstrap()).rejects.toThrow(
			AsyncFactoryError,
		);
		expect(then).not.toHaveBeenCalled();
	});

	it("inject() of a non-promise thenable fails without calling then()", async () => {
		const then = vi.fn((resolve: (value: number) => void) => resolve(1));
		@Injectable()
		class Repo {
			readonly db = inject(DB);
		}
		@Module({
			providers: [Repo, { provide: DB, useFactory: () => ({ then }) }],
		})
		class M {}
		await expect(NexusApplication.create(M).bootstrap()).rejects.toThrow(
			AsyncFactoryError,
		);
		expect(then).not.toHaveBeenCalled();
	});

	it("lazy resolve fails the same way", async () => {
		@Module({
			providers: [
				{ provide: DB, useFactory: () => Promise.resolve({ ok: true }) },
			],
		})
		class M {}
		const app = await NexusApplication.create(M).lazy().bootstrap();
		await expect(app.resolve(DB)).rejects.toThrow(AsyncFactoryError);
	});

	it("inject() of an async factory fails the same way", async () => {
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
		await expect(NexusApplication.create(M).bootstrap()).rejects.toThrow(
			AsyncFactoryError,
		);
	});

	it("a rejecting async factory never produces an unhandled rejection", async () => {
		@Module({
			providers: [
				{
					provide: DB,
					useFactory: async () => {
						throw new Error("boom");
					},
				},
			],
		})
		class M {}
		await expect(NexusApplication.create(M).bootstrap()).rejects.toThrow(
			AsyncFactoryError,
		);
		// vitest fails the run on unhandled rejections; a clean exit is the assertion
	});

	it("async setup moves to onModuleInit", async () => {
		@Injectable()
		class Db implements OnModuleInit {
			ok = false;
			async onModuleInit() {
				await Promise.resolve();
				this.ok = true;
			}
		}
		@Module({ providers: [Db] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(Db).ok).toBe(true);
	});
});
