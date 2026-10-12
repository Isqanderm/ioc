import "reflect-metadata";
import {
	ContainerClosedError,
	Inject,
	Injectable,
	inject,
	lazy,
	Module,
	NexusApplication,
	ProviderUnloadedError,
	Scope,
} from "../../src";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe("stale singleton creations", () => {
	it("a creation in flight when close() runs is destroyed, not cached, and rejects (P3)", async () => {
		let created = 0;
		let destroyed = 0;
		@Injectable()
		class S {
			constructor() {
				created++;
			}
			async onModuleInit() {
				await tick(20);
			}
			onModuleDestroy() {
				destroyed++;
			}
		}
		@Module({ providers: [S] })
		class M {}

		const app = await NexusApplication.create(M).lazy().bootstrap();
		const resolving = app.resolve(S);
		await tick(1);
		await app.close();

		await expect(resolving).rejects.toThrow(ContainerClosedError);
		expect(created).toBe(1);
		expect(destroyed).toBe(1);
	});

	it("a creation in flight across unload + reload is not handed out after the reload (P8)", async () => {
		let created = 0;
		let destroyed = 0;
		@Injectable()
		class S {
			readonly id = ++created;
			async onModuleInit() {
				await tick(20);
			}
			onModuleDestroy() {
				destroyed++;
			}
		}
		@Module({ providers: [S] })
		class L {}
		const ref = lazy(async () => L);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).lazy().bootstrap();
		const first = await app.load(ref);
		const resolving = app.resolve(S);
		await tick(1);
		await app.unload(first);

		const error = await resolving.catch((e) => e);
		expect(error).toBeInstanceOf(ProviderUnloadedError);
		expect(destroyed).toBe(1);

		await app.load(ref);
		const fresh = await app.resolve(S);
		expect(fresh.id).toBe(2);
		await app.close();
		expect(destroyed).toBe(created);
	});

	it("inject() in a tree that outlived close() creates nothing (sync path)", async () => {
		let bCreated = 0;
		let bDestroyed = 0;
		@Injectable({ scope: Scope.Transient })
		class SlowTransient {
			async onModuleInit() {
				await tick(20);
			}
		}
		@Injectable()
		class B {
			constructor() {
				bCreated++;
			}
			onModuleDestroy() {
				bDestroyed++;
			}
		}
		@Injectable()
		class A {
			readonly b = inject(B);
			constructor(@Inject(SlowTransient) readonly slow: SlowTransient) {}
		}
		@Module({ providers: [SlowTransient, A, B] })
		class M {}

		const app = await NexusApplication.create(M).lazy().bootstrap();
		const resolving = app.resolve(A);
		await tick(1);
		await app.close();

		await expect(resolving).rejects.toThrow(ContainerClosedError);
		expect(bCreated).toBe(bDestroyed);
	});

	it("inject() in a tree that outlived an unload + reload only creates live-graph instances (sync path)", async () => {
		const created: string[] = [];
		const destroyed: string[] = [];
		let releaseGate!: () => void;
		const gate = new Promise<void>((r) => {
			releaseGate = r;
		});
		@Injectable({ scope: Scope.Transient })
		class Gated {
			async onModuleInit() {
				await gate;
			}
		}
		@Injectable()
		class B {
			constructor() {
				created.push("b");
			}
			onModuleDestroy() {
				destroyed.push("b");
			}
		}
		@Injectable()
		class A {
			readonly b = inject(B);
			constructor(@Inject(Gated) readonly gated: Gated) {
				created.push("a");
			}
			onModuleDestroy() {
				destroyed.push("a");
			}
		}
		@Module({ providers: [Gated, A, B] })
		class L {}
		const ref = lazy(async () => L);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).lazy().bootstrap();
		const first = await app.load(ref);
		const resolving = app.resolve(A);
		await tick(1);
		await app.unload(first);
		const second = await app.load(ref);
		releaseGate();

		await expect(resolving).rejects.toThrow(ProviderUnloadedError);
		// The stale A was destroyed; the B it inject()ed belongs to the
		// reloaded segment, so unloading that destroys it.
		expect(destroyed).toEqual(["a"]);
		await app.unload(second);
		expect(destroyed.sort()).toEqual(created.sort());
		await app.close();
	});
});
