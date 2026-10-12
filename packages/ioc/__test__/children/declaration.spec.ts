import "reflect-metadata";
import {
	BootstrapError,
	Inject,
	Injectable,
	lazy,
	Module,
	NexusApplication,
} from "../../src";
import { Container } from "../../src/internal";
import { HashUtil } from "../../src/utils/hash-utils";

@Module({ providers: [] })
class ProfileModule {}

@Module({ providers: [] })
class SettingsModule {}

const settingsLazy = lazy(() => Promise.resolve(SettingsModule), {
	name: "Settings",
});

@Module({ children: [ProfileModule, settingsLazy] })
class ShellModule {}

@Module({ imports: [ShellModule] })
class AppModule {}

async function compiled(root: new () => unknown) {
	const container = new Container(new HashUtil());
	await container.run(root as never);
	return container;
}

describe("@Module children", () => {
	it("accepts the children key and does not compile children into the parent", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		expect(app.errors).toEqual([]);

		const container = await compiled(AppModule);
		const tokens = container.graph
			.getAllNodes()
			.map((n) => (n as { id: unknown }).id);
		const profile = await container.getModule(ProfileModule);
		expect(profile).toBeUndefined();
		expect(tokens).not.toContain(settingsLazy.id);
	});

	it("indexes the declaring module", async () => {
		const container = await compiled(AppModule);
		const shell = await container.getModule(ShellModule);
		expect(container.graph.findChildDeclaration(ProfileModule)).toBe(shell);
		expect(container.graph.findChildDeclaration(settingsLazy)).toBe(shell);
		expect(
			container.graph.findChildDeclaration(SettingsModule),
		).toBeUndefined();
	});

	it("exposes children on the module container, [] for dynamic modules", async () => {
		const container = await compiled(AppModule);
		const shell = await container.getModule(ShellModule);
		expect(shell?.children).toEqual([ProfileModule, settingsLazy]);
		const dyn = await container.addModule({ module: ProfileModule });
		expect(dyn.children).toEqual([]);
	});

	it("rejects a child declared by two modules", async () => {
		@Module({ children: [ProfileModule] })
		class Other {}
		@Module({ imports: [ShellModule, Other] })
		class Root {}
		await expect(NexusApplication.create(Root).bootstrap()).rejects.toThrow(
			BootstrapError,
		);
		await expect(NexusApplication.create(Root).bootstrap()).rejects.toThrow(
			/CHILD_DECLARED_TWICE|declared as a child by both/,
		);
		const container = new Container(new HashUtil());
		await container.run(Root);
		expect(container.graph.errors).toEqual([
			expect.objectContaining({
				type: "CHILD_DECLARED_TWICE",
				child: "ProfileModule",
			}),
		]);
	});

	it("does not flag the same module listing a child twice", async () => {
		@Module({ children: [ProfileModule, ProfileModule] })
		class Dup {}
		const container = await compiled(Dup);
		expect(container.graph.errors).toEqual([]);
	});

	it("indexes children of a lazy segment and removes them on unload", async () => {
		@Module({ children: [ProfileModule] })
		class FeatureRoot {}
		@Module({})
		class Host {}
		const featureLazy = lazy(async () => FeatureRoot, { name: "Feature" });
		const container = await compiled(Host);
		const mc = await container.addModule(FeatureRoot);
		await container.graph.compileSegment(mc, featureLazy);
		expect(container.graph.findChildDeclaration(ProfileModule)).toBe(mc);

		container.graph.unloadSegment(
			featureLazy,
			new Set([
				container.graph.rootToken,
				...container.graph.internalRootTokens,
			]),
		);
		expect(container.graph.findChildDeclaration(ProfileModule)).toBeUndefined();
	});

	it("does not index children of a rolled-back segment", async () => {
		@Injectable()
		class Broken {
			constructor(@Inject("MISSING") readonly m: unknown) {}
		}
		@Module({ providers: [Broken], children: [ProfileModule] })
		class BadRoot {}
		@Module({})
		class Host {}
		const badLazy = lazy(async () => BadRoot, { name: "Bad" });
		const container = await compiled(Host);
		const mc = await container.addModule(BadRoot);
		const segment = await container.graph.compileSegment(mc, badLazy);
		expect(segment.errors.length).toBeGreaterThan(0);
		expect(container.graph.findChildDeclaration(ProfileModule)).toBeUndefined();
	});

	it("still rejects unknown keys", () => {
		expect(() => Module({ kids: [] } as never)).toThrow(
			/Invalid property 'kids'/,
		);
	});
});
