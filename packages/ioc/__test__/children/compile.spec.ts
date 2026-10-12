import "reflect-metadata";
import {
	BootstrapError,
	type Edge,
	EdgeTypeEnum,
	Inject,
	Injectable,
	InjectionToken,
	inject,
	lazy,
	Module,
	NexusApplication,
	Optional,
	type ProviderToken,
} from "../../src";
import type { ModuleGraphInterface } from "../../src/interfaces";

@Injectable()
class Http {}

@Injectable()
class Secret {}

@Injectable()
class RootOnly {}

const MISSING = new InjectionToken<string>("MISSING");

@Module({ providers: [Http], exports: [Http] })
class HttpModule {}

@Module({ providers: [Secret] })
class SecretModule {}

function graphOf(app: NexusApplication): ModuleGraphInterface {
	return (app as unknown as { container: { graph: ModuleGraphInterface } })
		.container.graph;
}

function edgeTo(
	app: NexusApplication,
	source: ProviderToken,
	target: ProviderToken,
): Edge | undefined {
	return graphOf(app)
		.getEdge(source)
		.find((e) => e.type === EdgeTypeEnum.DEPENDENCY && e.target === target);
}

/** Root app: `ShellModule` imports `HttpModule` and declares `child`. */
async function bootRoot(children: unknown[]): Promise<NexusApplication> {
	@Module({ imports: [HttpModule], children: children as never })
	class ShellModule {}

	@Module({
		imports: [ShellModule, SecretModule],
		providers: [RootOnly],
	})
	class AppModule {}

	return NexusApplication.create(AppModule).bootstrap();
}

describe("child graph: compile-time external lookup", () => {
	it("accepts a constructor @Inject the declaring module can see, as an external edge", async () => {
		@Injectable()
		class Consumer {
			constructor(@Inject(Http) readonly http: Http) {}
		}
		@Module({ providers: [Consumer] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.errors).toEqual([]);
		const edge = edgeTo(child, Consumer, Http);
		expect(edge?.metadata.external).toBe(true);
		expect(edge?.metadata.unreached).toBe(false);
	});

	it("accepts a property @Inject as an external edge", async () => {
		@Injectable()
		class Consumer {
			@Inject(Http) readonly http!: Http;
		}
		@Module({ providers: [Consumer] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.errors).toEqual([]);
		expect(edgeTo(child, Consumer, Http)?.metadata.external).toBe(true);
	});

	it("accepts class-provider constructor and property deps as external edges", async () => {
		const CTOR = new InjectionToken<unknown>("CTOR");
		const PROP = new InjectionToken<unknown>("PROP");
		class ByCtor {
			constructor(@Inject(Http) readonly http: Http) {}
		}
		class ByProp {
			@Inject(Http) readonly http!: Http;
		}
		@Module({
			providers: [
				{ provide: CTOR, useClass: ByCtor },
				{ provide: PROP, useClass: ByProp },
			],
		})
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.errors).toEqual([]);
		expect(edgeTo(child, CTOR, Http)?.metadata.external).toBe(true);
		expect(edgeTo(child, PROP, Http)?.metadata.external).toBe(true);
	});

	it("accepts a factory inject as an external edge", async () => {
		const FACTORY = new InjectionToken<string>("FACTORY");
		@Module({
			providers: [
				{ provide: FACTORY, useFactory: () => "made", inject: [Http] },
			],
		})
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.errors).toEqual([]);
		expect(edgeTo(child, FACTORY, Http)?.metadata.external).toBe(true);
	});

	it("keeps encapsulated parent providers unreached", async () => {
		@Injectable()
		class Consumer {
			constructor(@Inject(Secret) readonly secret: Secret) {}
		}
		@Module({ providers: [Consumer] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const error = await app.createChild(ProfileModule).catch((e) => e);

		expect(error).toBeInstanceOf(BootstrapError);
		expect((error as BootstrapError).errors).toEqual([
			{
				type: "UNREACHED_DEP_CONSTRUCTOR",
				token: "Consumer",
				dependency: "Secret",
				position: 0,
			},
		]);
	});

	it("uses the declaring module's visibility, not the root's", async () => {
		@Injectable()
		class Consumer {
			constructor(@Inject(RootOnly) readonly root: RootOnly) {}
		}
		@Module({ providers: [Consumer] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const error = await app.createChild(ProfileModule).catch((e) => e);

		expect(error).toBeInstanceOf(BootstrapError);
		expect((error as BootstrapError).errors).toEqual([
			{
				type: "UNREACHED_DEP_CONSTRUCTOR",
				token: "Consumer",
				dependency: "RootOnly",
				position: 0,
			},
		]);
	});

	it("prefers the child's own provider: the edge is not external", async () => {
		@Injectable()
		class Consumer {
			constructor(@Inject(Http) readonly http: Http) {}
		}
		@Module({ providers: [Http, Consumer] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.errors).toEqual([]);
		const edge = edgeTo(child, Consumer, Http);
		expect(edge?.metadata.external).toBeFalsy();
		expect(edge?.metadata.unreached).toBe(false);
	});

	it("leaves an optional dependency nobody provides satisfied and not external", async () => {
		@Injectable()
		class Consumer {
			constructor(@Optional() @Inject(MISSING) readonly missing?: string) {}
		}
		@Module({ providers: [Consumer] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);

		expect(child.errors).toEqual([]);
		const edge = edgeTo(child, Consumer, MISSING);
		expect(edge?.metadata.external).toBeFalsy();
		expect(edge?.metadata.unreached).toBe(false);
	});

	it("reaches the parent chain from a grandchild", async () => {
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

		expect(grandchild.errors).toEqual([]);
		expect(edgeTo(grandchild, TabConsumer, Http)?.metadata.external).toBe(true);
	});

	it("applies the lookup to lazy modules loaded into the child", async () => {
		@Injectable()
		class FeatureConsumer {
			constructor(@Inject(Http) readonly http: Http) {}
		}
		@Module({ providers: [FeatureConsumer] })
		class FeatureModule {}
		@Module({ providers: [] })
		class ProfileModule {}

		const app = await bootRoot([ProfileModule]);
		const child = await app.createChild(ProfileModule);
		await child.load(lazy(async () => FeatureModule));

		expect(child.errors).toEqual([]);
		expect(edgeTo(child, FeatureConsumer, Http)?.metadata.external).toBe(true);
	});

	describe("parity: a token in the child graph the requester cannot see", () => {
		// `InnerModule` provides its own `Http` but does not export it, so the
		// child graph has an `Http` node that `ProfileModule` cannot see, while
		// the parent can provide `Http` through the link.
		@Module({ providers: [Http] })
		class InnerModule {}

		it("static compile (externalLookup) falls through to the link", async () => {
			@Injectable()
			class Consumer {
				constructor(@Inject(Http) readonly http: Http) {}
			}
			@Module({ imports: [InnerModule], providers: [Consumer] })
			class ProfileModule {}

			const app = await bootRoot([ProfileModule]);
			const child = await app.createChild(ProfileModule);

			expect(child.errors).toEqual([]);
			expect(graphOf(child).getNode(Http)).toBeDefined();
			const edge = edgeTo(child, Consumer, Http);
			expect(edge?.metadata.external).toBe(true);
			expect(edge?.metadata.unreached).toBe(false);
		});

		it("inject() (resolveSync) falls through to the link for the same token", async () => {
			@Injectable()
			class Consumer {
				readonly http = inject(Http);
			}
			@Module({ imports: [InnerModule], providers: [Consumer] })
			class ProfileModule {}

			const app = await bootRoot([ProfileModule]);
			const child = await app.createChild(ProfileModule);

			expect(graphOf(child).getNode(Http)).toBeDefined();
			expect(child.get(Consumer).http).toBe(app.get(Http));
		});
	});
});
