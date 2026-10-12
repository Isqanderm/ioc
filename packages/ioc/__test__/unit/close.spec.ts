import "reflect-metadata";
import {
	ContainerClosedError,
	Injectable,
	lazy,
	Module,
	NexusApplication,
	type OnModuleDestroy,
} from "../../src";

describe("NexusApplication.close", () => {
	const order: string[] = [];
	beforeEach(() => {
		order.length = 0;
	});

	@Injectable()
	class A implements OnModuleDestroy {
		onModuleDestroy() {
			order.push("A");
		}
	}

	@Injectable()
	class B implements OnModuleDestroy {
		constructor(readonly a: A) {}
		onModuleDestroy() {
			order.push("B");
		}
	}

	@Module({ providers: [A, B] })
	class AppModule {}

	it("destroys in reverse creation order", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		await app.close();
		expect(order).toEqual(["B", "A"]);
	});

	it("is idempotent", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		const first = app.close();
		const second = app.close();
		expect(second).toBe(first);
		await first;
		await app.close();
		expect(order).toEqual(["B", "A"]);
	});

	it("get/resolve/load throw ContainerClosedError once close starts", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		const closing = app.close();
		expect(app.isClosed).toBe(true);
		expect(() => app.get(A)).toThrow(ContainerClosedError);
		await expect(app.resolve(A)).rejects.toThrow(ContainerClosedError);
		await expect(
			app.load(lazy(() => Promise.resolve(AppModule))),
		).rejects.toThrow(ContainerClosedError);
		await closing;
	});

	it("keeps destroying after a failing hook and throws AggregateError", async () => {
		@Injectable()
		class Ok implements OnModuleDestroy {
			onModuleDestroy() {
				order.push("ok");
			}
		}
		@Injectable()
		class Boom implements OnModuleDestroy {
			constructor(readonly ok: Ok) {}
			onModuleDestroy() {
				throw new Error("boom");
			}
		}
		@Module({ providers: [Ok, Boom] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		const error = await app.close().catch((e) => e);
		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors[0].message).toBe("boom");
		expect(order).toEqual(["ok"]);
	});

	it("detaches from the parent", async () => {
		@Module({ providers: [{ provide: "p", useValue: 1 }] })
		class ParentModule {}
		@Module({ providers: [] })
		class ChildModule {}
		const parent = await NexusApplication.create(ParentModule).bootstrap();
		const child = await NexusApplication.create(ChildModule)
			.setParent(parent)
			.bootstrap();
		await child.close();
		expect(parent.get("p")).toBe(1);
		expect(
			(child as unknown as { _parentContainer: unknown })._parentContainer,
		).toBeNull();
	});

	it("waits for an in-flight lazy load before destroying", async () => {
		@Injectable()
		class LazySvc implements OnModuleDestroy {
			onModuleDestroy() {
				order.push("lazy");
			}
		}
		@Module({ providers: [LazySvc] })
		class LazyModule {}
		let release!: () => void;
		const gate = new Promise<void>((r) => {
			release = r;
		});
		const ref = lazy(async () => {
			await gate;
			return LazyModule;
		});
		const app = await NexusApplication.create(AppModule).bootstrap();
		const loading = app.load(ref);
		const closing = app.close();
		release();
		await loading.catch(() => undefined);
		await closing;
		expect(order).toContain("lazy");
	});
});

describe("ModuleRef after close", () => {
	@Injectable()
	class Svc {}
	@Module({ providers: [Svc] })
	class FeatureModule {}
	@Module({ providers: [] })
	class RootModule {}

	async function setup() {
		const app = await NexusApplication.create(RootModule).bootstrap();
		const ref = await app.load(lazy(async () => FeatureModule));
		return { app, ref };
	}

	it("ref.get throws and ref.resolve rejects with ContainerClosedError", async () => {
		const { app, ref } = await setup();
		await app.close();
		expect(() => ref.get(Svc)).toThrow(ContainerClosedError);
		await expect(ref.resolve(Svc)).rejects.toThrow(ContainerClosedError);
	});

	it("unload after close rejects with ContainerClosedError", async () => {
		const { app, ref } = await setup();
		await app.close();
		await expect(ref.unload()).rejects.toThrow(ContainerClosedError);
		await expect(app.unload(ref)).rejects.toThrow(ContainerClosedError);
	});
});
