import "reflect-metadata";
import {
	ChildModuleNotDeclaredError,
	ContainerClosedError,
	Inject,
	Injectable,
	inject,
	lazy,
	Module,
	NexusApplication,
	type OnModuleDestroy,
	Scope,
} from "../../src";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function liveChildren(app: NexusApplication): Set<NexusApplication> {
	return (app as unknown as { liveChildren: Set<NexusApplication> })
		.liveChildren;
}

function loadedChildren(app: NexusApplication): Map<symbol, unknown> {
	return (app as unknown as { loadedChildren: Map<symbol, unknown> })
		.loadedChildren;
}

/** A module whose single provider records its onModuleDestroy under `name`. */
function recordingModule(order: string[], name: string, fail?: Error) {
	@Injectable()
	class Recorder implements OnModuleDestroy {
		onModuleDestroy() {
			order.push(name);
			if (fail) throw fail;
		}
	}
	@Module({ providers: [Recorder] })
	class Recording {}
	return Recording;
}

describe("child lifecycle: close cascade", () => {
	it("closes live children in reverse creation order, then the parent", async () => {
		const order: string[] = [];
		@Injectable()
		class ChildStore implements OnModuleDestroy {
			constructor(@Inject("name") readonly name: string) {}
			onModuleDestroy() {
				order.push(this.name);
			}
		}
		@Module({ providers: [ChildStore] })
		class ChildModule {}
		@Injectable()
		class ParentService implements OnModuleDestroy {
			onModuleDestroy() {
				order.push("parent");
			}
		}
		@Module({ providers: [ParentService], children: [ChildModule] })
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		await app.createChild(ChildModule, {
			providers: [{ provide: "name", useValue: "child1" }],
		});
		await app.createChild(ChildModule, {
			providers: [{ provide: "name", useValue: "child2" }],
		});
		await app.close();

		expect(order).toEqual(["child2", "child1", "parent"]);
		expect(liveChildren(app).size).toBe(0);
	});

	it("collects a child's hook failure into the parent's AggregateError; the parent still tears down", async () => {
		const order: string[] = [];
		const childBoom = new Error("child boom");
		const parentBoom = new Error("parent boom");
		const Child = recordingModule(order, "child", childBoom);
		@Injectable()
		class ParentService implements OnModuleDestroy {
			onModuleDestroy() {
				order.push("parent");
				throw parentBoom;
			}
		}
		@Module({ providers: [ParentService], children: [Child] })
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		await app.createChild(Child);
		const error = await app.close().catch((e) => e);

		expect(error).toBeInstanceOf(AggregateError);
		// Flattened: the child's AggregateError does not nest inside the parent's.
		expect((error as AggregateError).errors).toEqual([childBoom, parentBoom]);
		expect(order).toEqual(["child", "parent"]);
	});

	it("a child closed on its own is not closed again by the parent", async () => {
		const order: string[] = [];
		const Child = recordingModule(order, "child");
		@Module({ children: [Child] })
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const child = await app.createChild(Child);
		await child.close();
		expect(liveChildren(app).has(child)).toBe(false);
		await app.close();

		expect(order).toEqual(["child"]);
	});

	it("a child still bootstrapping when the parent closes is closed and createChild rejects", async () => {
		let created = 0;
		let destroyed = 0;
		@Injectable()
		class SlowInit implements OnModuleDestroy {
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
		@Module({ providers: [SlowInit] })
		class Child {}
		@Module({ children: [Child] })
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const creating = app.createChild(Child);
		await tick(5); // the child's warm-up is inside SlowInit.onModuleInit
		expect(created).toBe(1);
		await app.close();

		await expect(creating).rejects.toThrow(ContainerClosedError);
		expect(destroyed).toBe(1);
		expect(liveChildren(app).size).toBe(0);
	});

	it("after the parent's close the child itself is closed", async () => {
		@Injectable()
		class X {}
		@Module({ providers: [X] })
		class Child {}
		@Module({ children: [Child] })
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const child = await app.createChild(Child);
		await app.close();

		expect(child.isClosed).toBe(true);
		await expect(child.resolve(X)).rejects.toThrow(ContainerClosedError);
		expect(() => child.get(X)).toThrow(ContainerClosedError);
	});

	it("grandchildren close before their parent child, which closes before the root", async () => {
		const order: string[] = [];
		const Leaf = recordingModule(order, "leaf");
		@Injectable()
		class Mid implements OnModuleDestroy {
			onModuleDestroy() {
				order.push("mid");
			}
		}
		@Module({ providers: [Mid], children: [Leaf] })
		class MidModule {}
		@Module({ children: [MidModule] })
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const mid = await app.createChild(MidModule);
		await mid.createChild(Leaf);
		await app.close();

		expect(order).toEqual(["leaf", "mid"]);
	});

	it("the parent link fails with the parent's ContainerClosedError while a sibling child is still open", async () => {
		// During the cascade the parent is already marked closed, but the
		// children are closed one at a time (newest first). child2's destroy
		// hook therefore runs while child1 is still open: child1's own guard
		// passes, and the inject() inside goes through the link to the closed
		// parent.
		@Injectable()
		class Http {}
		@Injectable({ scope: Scope.Transient })
		class Host {
			readonly http = inject(Http);
		}
		@Injectable({ scope: Scope.Transient })
		class EdgeHost {
			constructor(@Inject(Http) readonly http: Http) {}
		}
		type Observed = {
			childOpen: boolean;
			viaInject: unknown;
			viaEdge: unknown;
		};
		let probe: () => Promise<Observed | undefined> = async () => undefined;
		let observed: Observed | undefined;
		@Injectable()
		class Prober implements OnModuleDestroy {
			async onModuleDestroy() {
				observed = await probe();
			}
		}
		@Module({ providers: [Host, EdgeHost, Prober] })
		class Child {}
		@Module({ providers: [Http], children: [Child] })
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const child1 = await app.createChild(Child);
		await app.createChild(Child);
		probe = async () => {
			probe = async () => observed; // only child2's hook probes
			const childOpen = !child1.isClosed;
			const viaInject = await child1.resolve(Host).catch((e) => e);
			const viaEdge = await child1.resolve(EdgeHost).catch((e) => e);
			return { childOpen, viaInject, viaEdge };
		};
		await app.close();

		expect(observed?.childOpen).toBe(true);
		// Both thrown past the child's own guard: inject() reaches the parent
		// through link.get, the @Inject edge through link.resolve.
		expect(observed?.viaInject).toBeInstanceOf(ContainerClosedError);
		expect((observed?.viaInject as Error).stack).toMatch(/resolveSync/);
		expect(observed?.viaEdge).toBeInstanceOf(ContainerClosedError);
		expect((observed?.viaEdge as Error).stack).toMatch(
			/createInstanceInContext/,
		);
	});
});

describe("child lifecycle: unload closes children declared in the segment", () => {
	it("unloading the declaring segment closes its live children first", async () => {
		const order: string[] = [];
		const Widget = recordingModule(order, "widget");
		@Injectable()
		class FeatureService implements OnModuleDestroy {
			onModuleDestroy() {
				order.push("feature");
			}
		}
		@Module({ providers: [FeatureService], children: [Widget] })
		class FeatureModule {}
		const featureLazy = lazy(async () => FeatureModule);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		const widget = await app.createChild(Widget);
		const result = await app.unload(ref);

		expect(order).toEqual(["widget", "feature"]);
		expect(result.closedChildren).toBe(1);
		expect(widget.isClosed).toBe(true);
		expect(liveChildren(app).size).toBe(0);
	});

	it("a direct ModuleRef.unload() closes them too; children of surviving modules stay open", async () => {
		const order: string[] = [];
		const Widget = recordingModule(order, "widget");
		const Other = recordingModule(order, "other");
		@Module({ children: [Widget] })
		class FeatureModule {}
		const featureLazy = lazy(async () => FeatureModule);
		@Module({ children: [Other] })
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		await app.createChild(Widget);
		const other = await app.createChild(Other);
		const result = await ref.unload();

		expect(result.closedChildren).toBe(1);
		expect(order).toEqual(["widget"]);
		expect(other.isClosed).toBe(false);
		expect([...liveChildren(app)]).toEqual([other]);
	});

	it("an unload that destroys no declaring module reports closedChildren 0", async () => {
		@Module({})
		class Plain {}
		const plainLazy = lazy(async () => Plain);
		@Module({})
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(plainLazy);
		expect((await app.unload(ref)).closedChildren).toBe(0);
	});

	it("prunes the cached lazy child code declared by an unloaded segment", async () => {
		@Module({})
		class Widget {}
		const loader = vi.fn(async () => Widget);
		const widgetLazy = lazy(loader);
		@Module({ children: [widgetLazy] })
		class FeatureModule {}
		const featureLazy = lazy(async () => FeatureModule);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		await app.createChild(widgetLazy);
		expect(loadedChildren(app).size).toBe(1);

		await app.unload(ref);
		expect(loadedChildren(app).size).toBe(0);

		await app.load(featureLazy);
		await app.createChild(widgetLazy);
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it("unloading a child's segment with an external edge destroys only the segment's providers", async () => {
		const destroyed: string[] = [];
		@Injectable()
		class Http implements OnModuleDestroy {
			onModuleDestroy() {
				destroyed.push("http");
			}
		}
		@Injectable()
		class SegmentService implements OnModuleDestroy {
			constructor(@Inject(Http) readonly http: Http) {}
			onModuleDestroy() {
				destroyed.push("segment");
			}
		}
		@Module({ providers: [SegmentService] })
		class Segment {}
		const segmentLazy = lazy(async () => Segment);
		@Module({})
		class Child {}
		@Module({ providers: [Http], children: [Child] })
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const child = await app.createChild(Child);
		const ref = await child.load(segmentLazy);
		expect(ref.get(SegmentService)?.http).toBe(app.get(Http));

		const result = await child.unload(ref);

		expect(result.destroyedProviders).toEqual([SegmentService]);
		expect(destroyed).toEqual(["segment"]);
		expect(app.get(Http)).toBeInstanceOf(Http);
	});
});

describe("child lifecycle: createChild racing an unload of the declaring segment", () => {
	it("a lazy child whose declaring segment unloads while its code loads is rejected (R2)", async () => {
		@Injectable()
		class W {}
		@Module({ providers: [W] })
		class Widget {}
		let release!: () => void;
		const gate = new Promise<void>((r) => {
			release = r;
		});
		const widgetLazy = lazy(async () => {
			await gate;
			return Widget;
		});
		@Module({ children: [widgetLazy] })
		class Feature {}
		const featureLazy = lazy(async () => Feature);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		const creating = app.createChild(widgetLazy);
		await tick(1);
		const result = await app.unload(ref);
		release();

		const error = await creating.catch((e) => e);
		expect(error).toBeInstanceOf(ChildModuleNotDeclaredError);
		expect((error as Error).message).toMatch(/unloaded/);
		expect(result.closedChildren).toBe(0);
		expect(liveChildren(app).size).toBe(0);
		expect(app.isClosed).toBe(false);
	});

	it("a lazy child is rejected even when the declaring segment was reloaded meanwhile", async () => {
		@Module({})
		class Widget {}
		let release!: () => void;
		const gate = new Promise<void>((r) => {
			release = r;
		});
		const widgetLazy = lazy(async () => {
			await gate;
			return Widget;
		});
		@Module({ children: [widgetLazy] })
		class Feature {}
		const featureLazy = lazy(async () => Feature);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		const creating = app.createChild(widgetLazy);
		await tick(1);
		await app.unload(ref);
		await app.load(featureLazy);
		release();

		await expect(creating).rejects.toThrow(ChildModuleNotDeclaredError);
		expect(liveChildren(app).size).toBe(0);
		// The new declaration works.
		const child = await app.createChild(widgetLazy);
		expect(child.isClosed).toBe(false);
	});

	it("a child with no singletons, closed by an unload mid-bootstrap, is rejected with the unload error (R3)", async () => {
		@Module({})
		class Widget {}
		@Module({ children: [Widget] })
		class Feature {}
		const featureLazy = lazy(async () => Feature);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		const creating = app.createChild(Widget);
		const result = await app.unload(ref);

		const error = await creating.catch((e) => e);
		expect(error).toBeInstanceOf(ChildModuleNotDeclaredError);
		expect((error as Error).message).toMatch(/unloaded/);
		expect(result.closedChildren).toBe(1);
		expect(liveChildren(app).size).toBe(0);
	});

	it("a child mid warm-up, closed by an unload, is rejected with the unload error and destroyed (R3b)", async () => {
		let created = 0;
		let destroyed = 0;
		@Injectable()
		class S {
			constructor() {
				created++;
			}
			async onModuleInit() {
				await tick(10);
			}
			onModuleDestroy() {
				destroyed++;
			}
		}
		@Module({ providers: [S] })
		class Widget {}
		@Module({ children: [Widget] })
		class Feature {}
		const featureLazy = lazy(async () => Feature);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		const creating = app.createChild(Widget);
		await tick(2);
		expect(created).toBe(1);
		const result = await app.unload(ref);

		const error = await creating.catch((e) => e);
		expect(error).toBeInstanceOf(ChildModuleNotDeclaredError);
		expect((error as Error).message).toMatch(/unloaded/);
		expect(result.closedChildren).toBe(1);
		expect(destroyed).toBe(created);
		expect(liveChildren(app).size).toBe(0);
	});
});

describe("child lifecycle: unload error reporting and counting", () => {
	it("keeps both a child's close failure and a segment provider's destroy failure (R5)", async () => {
		const childBoom = new Error("child boom");
		const featureBoom = new Error("feature boom");
		@Injectable()
		class W implements OnModuleDestroy {
			onModuleDestroy() {
				throw childBoom;
			}
		}
		@Module({ providers: [W] })
		class Widget {}
		@Injectable()
		class F implements OnModuleDestroy {
			onModuleDestroy() {
				throw featureBoom;
			}
		}
		@Module({ providers: [F], children: [Widget] })
		class Feature {}
		const featureLazy = lazy(async () => Feature);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		await app.createChild(Widget);
		const error = await app.unload(ref).catch((e) => e);

		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toEqual([childBoom, featureBoom]);
		await app.close().catch(() => undefined);
	});

	it("a child's close failure alone is rethrown after the unload completes", async () => {
		const childBoom = new Error("child boom");
		const Widget = recordingModule([], "widget", childBoom);
		@Injectable()
		class F {}
		@Module({ providers: [F], children: [Widget] })
		class Feature {}
		const featureLazy = lazy(async () => Feature);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		await app.createChild(Widget);
		const error = await app.unload(ref).catch((e) => e);

		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toEqual([childBoom]);
		expect(() => app.get(F)).toThrow();
		await app.close();
	});

	it("closedChildren does not count a child the user was already closing", async () => {
		let releaseUserClose!: () => void;
		const userCloseGate = new Promise<void>((r) => {
			releaseUserClose = r;
		});
		const order: string[] = [];
		@Injectable()
		class SlowDestroy implements OnModuleDestroy {
			async onModuleDestroy() {
				await userCloseGate;
				order.push("user-closed");
			}
		}
		@Module({ providers: [SlowDestroy] })
		class SlowWidget {}
		const Fine = recordingModule(order, "fine");
		@Injectable()
		class F implements OnModuleDestroy {
			onModuleDestroy() {
				order.push("feature");
			}
		}
		@Module({ providers: [F], children: [SlowWidget, Fine] })
		class Feature {}
		const featureLazy = lazy(async () => Feature);
		@Module({})
		class Root {}

		const app = await NexusApplication.create(Root).bootstrap();
		const ref = await app.load(featureLazy);
		const userClosed = await app.createChild(SlowWidget);
		await app.createChild(Fine);
		const userClosing = userClosed.close();
		const unloading = app.unload(ref);
		await tick(1);
		releaseUserClose();
		await userClosing;
		const result = await unloading;

		expect(result.closedChildren).toBe(1);
		// The unload still waits for the user's close before destroying providers.
		expect(order).toEqual(["fine", "user-closed", "feature"]);
		expect(liveChildren(app).size).toBe(0);
	});
});
