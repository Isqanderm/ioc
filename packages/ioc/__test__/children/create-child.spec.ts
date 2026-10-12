import "reflect-metadata";
import {
	BootstrapError,
	ChildModuleNotDeclaredError,
	ContainerClosedError,
	ContainerNotCompiledError,
	type DynamicModule,
	Inject,
	Injectable,
	InjectionToken,
	LazyModuleLoadError,
	lazy,
	Module,
	NexusApplication,
	type OnModuleDestroy,
	ProviderNotFoundError,
	ProviderScopeError,
	Scope,
} from "../../src";

const PROFILE_ID = new InjectionToken<string>("PROFILE_ID");

@Injectable()
class ProfileStore {}

@Module({ providers: [ProfileStore] })
class ProfileModule {
	static forProfile(id: string): DynamicModule {
		return {
			module: ProfileModule,
			providers: [ProfileStore, { provide: PROFILE_ID, useValue: id }],
		};
	}
}

@Module({ providers: [] })
class SettingsModule {}
const settingsLazy = lazy(async () => SettingsModule);

@Module({ children: [ProfileModule, settingsLazy] })
class AppModule {}

function liveChildren(app: NexusApplication): Set<NexusApplication> {
	return (app as unknown as { liveChildren: Set<NexusApplication> })
		.liveChildren;
}

describe("createChild", () => {
	it("returns a bootstrapped child with its own singletons", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		const a = await app.createChild(ProfileModule);
		const b = await app.createChild(ProfileModule);
		expect(a.get(ProfileStore)).toBeInstanceOf(ProfileStore);
		expect(a.get(ProfileStore)).not.toBe(b.get(ProfileStore));
	});

	it("accepts a dynamic module of a declared child", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		const child = await app.createChild(ProfileModule.forProfile("p1"));
		expect(child.get(PROFILE_ID)).toBe("p1");
	});

	it("appends options.providers to the child root", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		const child = await app.createChild(ProfileModule, {
			providers: [{ provide: PROFILE_ID, useValue: "p2" }],
		});
		expect(child.get(PROFILE_ID)).toBe("p2");
	});

	it("loads a lazy child once and caches the code", async () => {
		let loads = 0;
		const ref = lazy(async () => {
			loads++;
			return SettingsModule;
		});
		@Module({ children: [ref] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		await app.createChild(ref);
		await app.createChild(ref);
		expect(loads).toBe(1);
	});

	it("rejects undeclared children, un-bootstrapped and closed parents", async () => {
		@Module({ providers: [] })
		class Stranger {}
		const app = await NexusApplication.create(AppModule).bootstrap();
		await expect(app.createChild(Stranger)).rejects.toThrow(
			ChildModuleNotDeclaredError,
		);
		await expect(
			NexusApplication.create(AppModule).createChild(ProfileModule),
		).rejects.toThrow(ContainerNotCompiledError);
		await app.close();
		await expect(app.createChild(ProfileModule)).rejects.toThrow(
			ContainerClosedError,
		);
	});

	it("setParent no longer exists", () => {
		expect("setParent" in NexusApplication.prototype).toBe(false);
	});
});

describe("createChild: lazy children", () => {
	it("shares one in-flight load between concurrent createChild calls", async () => {
		@Module({ providers: [] })
		class Lazy1 {}
		let loads = 0;
		const ref = lazy(async () => {
			loads++;
			return Lazy1;
		});
		@Module({ children: [ref] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		const [a, b] = await Promise.all([
			app.createChild(ref),
			app.createChild(ref),
		]);
		expect(loads).toBe(1);
		expect(a).not.toBe(b);
	});

	it("does not cache a failed load", async () => {
		@Module({ providers: [{ provide: "v", useValue: 1 }] })
		class Lazy2 {}
		let calls = 0;
		const ref = lazy(async () => {
			calls++;
			if (calls === 1) throw new Error("network");
			return Lazy2;
		});
		@Module({ children: [ref] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		await expect(app.createChild(ref)).rejects.toThrow(LazyModuleLoadError);
		const child = await app.createChild(ref);
		expect(child.get("v")).toBe(1);
		expect(calls).toBe(2);
	});

	it("rejects a loader that does not return a @Module class", async () => {
		class NotAModule {}
		const ref = lazy(async () => NotAModule);
		@Module({ children: [ref] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		await expect(app.createChild(ref)).rejects.toThrow(LazyModuleLoadError);
	});

	it("matches lazy refs by identity", async () => {
		const other = lazy(async () => SettingsModule);
		const app = await NexusApplication.create(AppModule).bootstrap();
		await expect(app.createChild(other)).rejects.toThrow(
			ChildModuleNotDeclaredError,
		);
	});
});

describe("createChild: get/resolve fallback through the link", () => {
	@Injectable()
	class ParentSvc {}
	@Injectable({ scope: Scope.Transient })
	class ParentTransient {}
	@Injectable()
	class Hidden {}

	@Module({ providers: [Hidden] })
	class EncapsulatedModule {}

	@Module({ providers: [] })
	class EmptyChild {}

	@Module({
		providers: [
			{ provide: "shared", useFactory: () => "child", scope: Scope.Transient },
		],
	})
	class ShadowingChild {}

	@Module({
		imports: [EncapsulatedModule],
		providers: [
			ParentSvc,
			ParentTransient,
			{ provide: "shared", useValue: "from-parent" },
		],
		children: [EmptyChild, ShadowingChild],
	})
	class ParentModule {}

	it("get/resolve fall back to what the declaring module sees", async () => {
		const parent = await NexusApplication.create(ParentModule).bootstrap();
		const child = await parent.createChild(EmptyChild);
		expect(child.get("shared")).toBe("from-parent");
		await expect(child.resolve("shared")).resolves.toBe("from-parent");
		expect(child.get(ParentSvc)).toBe(parent.get(ParentSvc));
	});

	it("a parent Transient: get throws ProviderScopeError, resolve creates", async () => {
		const parent = await NexusApplication.create(ParentModule).bootstrap();
		const child = await parent.createChild(EmptyChild);
		expect(() => child.get(ParentTransient)).toThrow(ProviderScopeError);
		const a = await child.resolve(ParentTransient);
		const b = await child.resolve(ParentTransient);
		expect(a).toBeInstanceOf(ParentTransient);
		expect(a).not.toBe(b);
	});

	it("does not fall back to providers the declaring module cannot see", async () => {
		const parent = await NexusApplication.create(ParentModule).bootstrap();
		const child = await parent.createChild(EmptyChild);
		expect(() => child.get(Hidden)).toThrow(ProviderNotFoundError);
		await expect(child.resolve(Hidden)).rejects.toThrow(ProviderNotFoundError);
		expect(child.get(Hidden, { optional: true })).toBeUndefined();
	});

	it("a local provider wins over the parent's", async () => {
		const parent = await NexusApplication.create(ParentModule).bootstrap();
		const child = await parent.createChild(ShadowingChild);
		expect(() => child.get("shared")).toThrow(ProviderScopeError);
		await expect(child.resolve("shared")).resolves.toBe("child");
	});

	it("optional propagates through the link", async () => {
		const parent = await NexusApplication.create(ParentModule).bootstrap();
		const child = await parent.createChild(EmptyChild);
		expect(child.get("nope", { optional: true })).toBeUndefined();
		await expect(
			child.resolve("nope", { optional: true }),
		).resolves.toBeUndefined();
		expect(() => child.get("nope")).toThrow(ProviderNotFoundError);
	});

	it("falls back recursively through grandparents", async () => {
		@Module({ providers: [{ provide: "own", useValue: "grandchild" }] })
		class GrandChild {}
		@Module({
			providers: [{ provide: "mid", useValue: "mid" }],
			children: [GrandChild],
		})
		class Mid {}
		@Module({
			providers: [{ provide: "top", useValue: "top" }],
			children: [Mid],
		})
		class Top {}
		const top = await NexusApplication.create(Top).bootstrap();
		const mid = await top.createChild(Mid);
		const leaf = await mid.createChild(GrandChild);
		expect(leaf.get("own")).toBe("grandchild");
		expect(leaf.get("mid")).toBe("mid");
		expect(leaf.get("top")).toBe("top");
		await expect(leaf.resolve("top")).resolves.toBe("top");
	});

	it("a parent never sees its child's providers (migrated from hierarchy.spec)", async () => {
		@Module({ providers: [{ provide: "child-only", useValue: 1 }] })
		class C {}
		@Module({ providers: [], children: [C] })
		class Root {}
		const root = await NexusApplication.create(Root).bootstrap();
		const child = await root.createChild(C);
		expect(child.get("child-only")).toBe(1);
		expect(() => root.get("child-only")).toThrow(ProviderNotFoundError);
	});

	it("a sibling child's providers are not visible", async () => {
		@Module({ providers: [{ provide: "a-only", useValue: 1 }] })
		class A {}
		@Module({ providers: [] })
		class B {}
		@Module({ children: [A, B] })
		class Root {}
		const root = await NexusApplication.create(Root).bootstrap();
		await root.createChild(A);
		const b = await root.createChild(B);
		expect(() => b.get("a-only")).toThrow(ProviderNotFoundError);
	});

	it("after the parent closes, the child is closed too and every lookup throws ContainerClosedError", async () => {
		// The parent's close() closes its live children first, so these
		// throw from the child's own guard. The link path to a closed parent
		// is covered in lifecycle.spec.ts (a sibling still open mid-cascade).
		const parent = await NexusApplication.create(ParentModule).bootstrap();
		const child = await parent.createChild(EmptyChild);
		await parent.close();
		expect(child.isClosed).toBe(true);
		expect(() => child.get("shared")).toThrow(ContainerClosedError);
		expect(() => child.get("shared", { optional: true })).toThrow(
			ContainerClosedError,
		);
		await expect(child.resolve("shared")).rejects.toThrow(ContainerClosedError);
		await expect(child.resolve("shared", { optional: true })).rejects.toThrow(
			ContainerClosedError,
		);
		expect(() => child.get("nope", { optional: true })).toThrow(
			ContainerClosedError,
		);
	});

	it("a grandchild survives a child root given extra providers or as a dynamic module", async () => {
		@Module({ providers: [{ provide: "leaf", useValue: "leaf" }] })
		class Leaf {}
		@Module({ providers: [], children: [Leaf] })
		class Profile {
			static forId(id: string): DynamicModule {
				return {
					module: Profile,
					providers: [{ provide: "id", useValue: id }],
				};
			}
		}
		@Module({ providers: [], children: [Profile] })
		class Root {}
		const root = await NexusApplication.create(Root).bootstrap();

		const viaOptions = await root.createChild(Profile, {
			providers: [{ provide: "id", useValue: "x" }],
		});
		const leafA = await viaOptions.createChild(Leaf);
		expect(leafA.get("leaf")).toBe("leaf");
		expect(leafA.get("id")).toBe("x");

		const viaDynamic = await root.createChild(Profile.forId("y"));
		const leafB = await viaDynamic.createChild(Leaf);
		expect(leafB.get("leaf")).toBe("leaf");
		expect(leafB.get("id")).toBe("y");
	});
});

describe("createChild: live children and lifecycle", () => {
	it("tracks live children and removes a child when it closes", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		const a = await app.createChild(ProfileModule);
		const b = await app.createChild(ProfileModule);
		expect([...liveChildren(app)]).toEqual([a, b]);
		await a.close();
		expect([...liveChildren(app)]).toEqual([b]);
		await b.close();
		expect(liveChildren(app).size).toBe(0);
		expect(app.get(PROFILE_ID, { optional: true })).toBeUndefined();
	});

	it("does not register a child whose graph is broken", async () => {
		@Injectable()
		class Needs {
			constructor(@Inject("missing") readonly missing: unknown) {}
		}
		@Module({ providers: [Needs] })
		class Broken {}
		@Module({ children: [Broken] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		await expect(app.createChild(Broken)).rejects.toThrow(BootstrapError);
		expect(liveChildren(app).size).toBe(0);
	});

	it("destroys what a child created before its warm-up failed", async () => {
		const destroyed: string[] = [];
		@Injectable()
		class First implements OnModuleDestroy {
			onModuleDestroy() {
				destroyed.push("first");
			}
		}
		@Module({
			providers: [
				First,
				{
					provide: "boom",
					useFactory: (_first: First) => {
						throw new Error("boom");
					},
					inject: [First],
				},
			],
		})
		class Failing {}
		@Module({ children: [Failing] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		await expect(app.createChild(Failing)).rejects.toThrow("boom");
		expect(liveChildren(app).size).toBe(0);
		expect(destroyed).toEqual(["first"]);
	});

	it("closes and rejects a child whose parent started closing during bootstrap", async () => {
		const created: string[] = [];
		const destroyed: string[] = [];
		@Injectable()
		class Res implements OnModuleDestroy {
			constructor() {
				created.push("res");
			}
			onModuleDestroy() {
				destroyed.push("res");
			}
		}
		@Module({ providers: [Res] })
		class Child {}
		@Module({ children: [Child] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		const creating = app.createChild(Child);
		// While the child is registered but still bootstrapping, the parent closes.
		expect(liveChildren(app).size).toBe(1);
		const closing = app.close();
		await expect(creating).rejects.toThrow(ContainerClosedError);
		await closing;
		// The cascade closes the child before its warm-up, so Res is never
		// created; whatever is created must be destroyed.
		expect(created).toEqual([]);
		expect(destroyed).toEqual(created);
		expect(liveChildren(app).size).toBe(0);
	});

	it("rejects with ContainerClosedError when the parent closes during a lazy child load", async () => {
		@Module({ providers: [] })
		class LazyChild {}
		let release!: () => void;
		const gate = new Promise<void>((r) => {
			release = r;
		});
		const ref = lazy(async () => {
			await gate;
			return LazyChild;
		});
		@Module({ children: [ref] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		const creating = app.createChild(ref);
		await app.close();
		release();
		await expect(creating).rejects.toThrow(ContainerClosedError);
		expect(liveChildren(app).size).toBe(0);
	});

	it("a lazy load failing while the parent closes rejects with ContainerClosedError", async () => {
		let fail!: () => void;
		const gate = new Promise<void>((_, reject) => {
			fail = () => reject(new Error("network"));
		});
		const ref = lazy(async () => {
			await gate;
			return SettingsModule;
		});
		@Module({ children: [ref] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		const creating = app.createChild(ref);
		const closing = app.close();
		fail();
		await expect(creating).rejects.toThrow(ContainerClosedError);
		await closing;
		expect(liveChildren(app).size).toBe(0);
	});

	it("a bootstrap failing while the parent closes rejects with ContainerClosedError and closes the child", async () => {
		const destroyed: string[] = [];
		let fail!: () => void;
		const gate = new Promise<void>((_, reject) => {
			fail = () => reject(new Error("boom"));
		});
		@Injectable()
		class First implements OnModuleDestroy {
			onModuleDestroy() {
				destroyed.push("first");
			}
		}
		@Injectable()
		class Slow {
			constructor(@Inject(First) readonly first: First) {}
			async onModuleInit() {
				await gate;
			}
		}
		@Module({ providers: [First, Slow] })
		class Child {}
		@Module({ children: [Child] })
		class Root {}
		const app = await NexusApplication.create(Root).bootstrap();
		const creating = app.createChild(Child);
		// Let the child's warm-up reach Slow.onModuleInit: the cascade closes
		// the child, and a close any earlier would stop the warm-up before
		// First exists.
		await new Promise((resolve) => setTimeout(resolve, 0));
		const closing = app.close();
		fail();
		await expect(creating).rejects.toThrow(ContainerClosedError);
		await closing;
		expect(destroyed).toEqual(["first"]);
		expect(liveChildren(app).size).toBe(0);
	});

	it("createAsChild is not part of the public typed API", () => {
		// @ts-expect-error createAsChild is private
		expect(typeof NexusApplication.createAsChild).toBe("function");
	});
});
