import "reflect-metadata";
import {
	Injectable,
	lazy,
	Module,
	NexusApplication,
	ProviderScopeError,
	Scope,
} from "../../src";

describe("ModuleRef sync get / async resolve", () => {
	@Injectable()
	class SharedService {}
	@Module({ providers: [SharedService], exports: [SharedService] })
	class SharedModule {}

	@Injectable()
	class FeatureService {}
	@Injectable({ scope: Scope.Transient })
	class FeatureTransient {}
	@Module({
		imports: [SharedModule],
		providers: [FeatureService, FeatureTransient],
		exports: [FeatureService],
	})
	class FeatureModule {}

	@Injectable()
	class RootOnlyService {}

	const featureLazy = lazy(() => Promise.resolve(FeatureModule));

	@Module({ imports: [featureLazy], providers: [RootOnlyService] })
	class RootModule {}

	it("get returns a loaded singleton synchronously", async () => {
		const app = await NexusApplication.create(RootModule).bootstrap();
		const ref = await app.load(featureLazy);
		const svc = ref.get<FeatureService>(FeatureService);
		expect(svc).toBeInstanceOf(FeatureService);
		expect(svc).not.toBeInstanceOf(Promise);
	});

	it("get sees exports of imported modules", async () => {
		const app = await NexusApplication.create(RootModule).bootstrap();
		const ref = await app.load(featureLazy);
		expect(ref.get(SharedService)).toBeInstanceOf(SharedService);
	});

	it("strict get returns undefined for tokens the module cannot see", async () => {
		const app = await NexusApplication.create(RootModule).bootstrap();
		const ref = await app.load(featureLazy);
		expect(ref.get(RootOnlyService)).toBeUndefined();
		expect(ref.get(RootOnlyService, { strict: false })).toBeInstanceOf(
			RootOnlyService,
		);
	});

	it("get throws ProviderScopeError for transient, resolve works", async () => {
		const app = await NexusApplication.create(RootModule).bootstrap();
		const ref = await app.load(featureLazy);
		expect(() => ref.get(FeatureTransient)).toThrow(ProviderScopeError);
		await expect(ref.resolve(FeatureTransient)).resolves.toBeInstanceOf(
			FeatureTransient,
		);
	});

	it("get and resolve return undefined after unload", async () => {
		const app = await NexusApplication.create(RootModule).bootstrap();
		const ref = await app.load(featureLazy);
		await ref.unload();
		expect(ref.get(FeatureService)).toBeUndefined();
		await expect(ref.resolve(FeatureService)).resolves.toBeUndefined();
	});
});
