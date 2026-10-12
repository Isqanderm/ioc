import "reflect-metadata";
import {
	ContainerClosedError,
	Injectable,
	inject,
	Module,
	NexusApplication,
	type OnModuleInit,
	ProviderNotFoundError,
	ProviderNotInstantiatedError,
	ProviderScopeError,
	Scope,
} from "../../src";
import type { ModuleGraphInterface } from "../../src/interfaces";

@Injectable()
class Http {}

@Injectable({ scope: Scope.Transient })
class Clock {}

@Injectable()
class Secret {}

@Module({ providers: [Http, Clock], exports: [Http, Clock] })
class HttpModule {}

@Module({ providers: [Secret] })
class SecretModule {}

async function bootRoot(
	children: unknown[],
	lazyMode = false,
): Promise<NexusApplication> {
	@Module({ imports: [HttpModule], children: children as never })
	class ShellModule {}

	@Module({ imports: [ShellModule, SecretModule] })
	class AppModule {}

	const app = NexusApplication.create(AppModule);
	return (lazyMode ? app.lazy() : app).bootstrap();
}

function graphOf(app: NexusApplication): ModuleGraphInterface {
	return (app as unknown as { container: { graph: ModuleGraphInterface } })
		.container.graph;
}

describe("inject() through the parent link", () => {
	it("returns the parent's instance and records no runtime edge", async () => {
		@Injectable()
		class Store {
			readonly http = inject(Http);
		}
		@Module({ providers: [Store] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.get(Store).http).toBe(app.get(Http));
		const edges = graphOf(child).getEdge(Store);
		expect(edges.some((e) => e.target === Http)).toBe(false);
		expect(graphOf(child).getNode(Http)).toBeUndefined();
	});

	it("inject() of a parent Transient throws ProviderScopeError", async () => {
		@Injectable({ scope: Scope.Transient })
		class Host {
			readonly clock = inject(Clock);
		}
		@Module({ providers: [Host] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		await expect(child.resolve(Host)).rejects.toThrow(ProviderScopeError);
	});

	it("an optional inject() of an encapsulated parent token is undefined", async () => {
		@Injectable()
		class Store {
			readonly secret = inject(Secret, { optional: true });
		}
		@Module({ providers: [Store] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.get(Store).secret).toBeUndefined();
	});

	it("a non-optional inject() of an encapsulated parent token is not found", async () => {
		@Injectable({ scope: Scope.Transient })
		class Host {
			readonly secret = inject(Secret);
		}
		@Module({ providers: [Host] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		await expect(child.resolve(Host)).rejects.toThrow(ProviderNotFoundError);
	});

	it("a local provider shadows the parent's for inject()", async () => {
		@Injectable()
		class Store {
			readonly http = inject(Http);
		}
		@Module({ providers: [Http, Store] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.get(Store).http).toBe(child.get(Http));
		expect(child.get(Store).http).not.toBe(app.get(Http));
	});

	it("a hidden child-graph token falls through to the parent (parity)", async () => {
		@Module({ providers: [Http] })
		class InnerModule {}
		@Injectable()
		class Store {
			readonly http = inject(Http);
		}
		@Module({ imports: [InnerModule], providers: [Store] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.get(Store).http).toBe(app.get(Http));
	});

	it("a grandchild's inject() reaches the root through the chain", async () => {
		@Injectable()
		class Store {
			readonly http = inject(Http);
		}
		@Module({ providers: [Store] })
		class TabModule {}
		@Module({ children: [TabModule] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);
		const grandchild = await child.createChild(TabModule);

		expect(grandchild.get(Store).http).toBe(app.get(Http));
	});

	it("throws ProviderNotInstantiatedError for a lazy parent's singleton not yet created", async () => {
		@Injectable({ scope: Scope.Transient })
		class Host {
			readonly http = inject(Http);
		}
		@Module({ providers: [Host] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule], true);
		const child = await app.createChild(ProfileModule);

		await expect(child.resolve(Host)).rejects.toThrow(
			ProviderNotInstantiatedError,
		);
		await app.resolve(Http);
		expect((await child.resolve(Host)).http).toBe(app.get(Http));
	});

	it("throws ProviderNotInstantiatedError while the parent's init is in flight", async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => {
			release = r;
		});
		@Injectable()
		class Slow implements OnModuleInit {
			async onModuleInit(): Promise<void> {
				await gate;
			}
		}
		@Module({ providers: [Slow], exports: [Slow] })
		class SlowModule {}
		@Injectable({ scope: Scope.Transient })
		class Host {
			readonly slow = inject(Slow);
		}
		@Module({ providers: [Host] })
		class ChildModule {}
		@Module({ imports: [SlowModule], children: [ChildModule] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).lazy().bootstrap();
		const child = await app.createChild(ChildModule);
		const parentResolve = app.resolve(Slow);
		await Promise.resolve();

		await expect(child.resolve(Host)).rejects.toThrow(
			ProviderNotInstantiatedError,
		);
		release();
		await parentResolve;
		expect((await child.resolve(Host)).slow).toBe(app.get(Slow));
	});

	it("throws ContainerClosedError after the parent closes, even when optional", async () => {
		// The parent's close() also closes the child, so this is the child's
		// own guard; lifecycle.spec.ts covers inject() reaching a closed
		// parent through the link while the child is still open.
		@Injectable({ scope: Scope.Transient })
		class Host {
			readonly http = inject(Http);
		}
		@Injectable({ scope: Scope.Transient })
		class OptionalHost {
			readonly http = inject(Http, { optional: true });
		}
		@Module({ providers: [Host, OptionalHost] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);
		await app.close();

		expect(child.isClosed).toBe(true);
		await expect(child.resolve(Host)).rejects.toThrow(ContainerClosedError);
		await expect(child.resolve(OptionalHost)).rejects.toThrow(
			ContainerClosedError,
		);
	});
});
