import "reflect-metadata";
import {
	Inject,
	Injectable,
	lazy,
	Module,
	ModuleRef,
	NexusApplication,
} from "../../src";

describe("NexusApplication.load", () => {
	@Injectable()
	class SharedService {
		readonly id = Math.random();
	}
	@Module({ providers: [SharedService], exports: [SharedService] })
	class SharedModule {}

	@Injectable()
	class PostsService {
		constructor(@Inject(SharedService) readonly shared: SharedService) {}
	}
	@Injectable()
	class PostsInternal {}
	@Module({
		imports: [SharedModule],
		providers: [PostsService, PostsInternal],
		exports: [PostsService],
	})
	class PostsModule {}

	@Injectable()
	class AnalyticsService {
		constructor(@Inject(SharedService) readonly shared: SharedService) {}
	}
	@Module({
		imports: [SharedModule],
		providers: [AnalyticsService],
		exports: [AnalyticsService],
	})
	class AnalyticsModule {}

	it("returns a ModuleRef that resolves the module's own and exported providers", async () => {
		const PostsLazy = lazy(async () => PostsModule, { name: "Posts" });
		@Module({ imports: [PostsLazy] })
		class AppModule {}
		const app = await NexusApplication.create(AppModule).bootstrap();

		const ref = await app.load(PostsLazy);
		expect(ref).toBeInstanceOf(ModuleRef);
		expect(ref.module).toBe(PostsModule);
		expect(ref.name).toBe("Posts");
		expect(await ref.get(PostsService)).toBeInstanceOf(PostsService);
		expect(await ref.get(PostsInternal)).toBeInstanceOf(PostsInternal);
		expect(await ref.get(SharedService)).toBeInstanceOf(SharedService);
		await app.close();
	});

	it("strict get() hides tokens the module cannot see; strict:false sees the container", async () => {
		@Injectable()
		class RootOnly {}
		const PostsLazy = lazy(async () => PostsModule);
		@Module({ imports: [PostsLazy], providers: [RootOnly] })
		class AppModule {}
		const app = await NexusApplication.create(AppModule).bootstrap();

		const ref = await app.load(PostsLazy);
		expect(await ref.get(RootOnly)).toBeUndefined();
		expect(await ref.get(RootOnly, { strict: false })).toBeInstanceOf(RootOnly);
		await app.close();
	});

	it("shares one SharedService instance between root and two lazy modules", async () => {
		const PostsLazy = lazy(async () => PostsModule);
		const AnalyticsLazy = lazy(async () => AnalyticsModule);
		@Module({ imports: [SharedModule, PostsLazy, AnalyticsLazy] })
		class AppModule {}
		const app = await NexusApplication.create(AppModule).bootstrap();

		const root = await app.get<SharedService>(SharedService);
		const posts = await (await app.load(PostsLazy)).get<PostsService>(
			PostsService,
		);
		const analytics = await (
			await app.load(AnalyticsLazy)
		).get<AnalyticsService>(AnalyticsService);
		expect(posts?.shared).toBe(root);
		expect(analytics?.shared).toBe(root);
		await app.close();
	});

	it("makes lazy providers reachable through app.get() after load", async () => {
		const PostsLazy = lazy(async () => PostsModule);
		@Module({ imports: [PostsLazy] })
		class AppModule {}
		const app = await NexusApplication.create(AppModule).bootstrap();
		expect(await app.get(PostsService)).toBeUndefined();
		await app.load(PostsLazy);
		expect(await app.get(PostsService)).toBeInstanceOf(PostsService);
		await app.close();
	});

	it("warms up new singletons unless the app is lazy()", async () => {
		const initialized: string[] = [];
		@Injectable()
		class Eager {
			onModuleInit() {
				initialized.push("Eager");
			}
		}
		@Module({ providers: [Eager] })
		class EagerModule {}

		const EagerLazy = lazy(async () => EagerModule);
		@Module({ imports: [EagerLazy] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();
		await app.load(EagerLazy);
		expect(initialized).toEqual(["Eager"]);
		await app.close();

		initialized.length = 0;
		const lazyApp = await NexusApplication.create(AppModule).lazy().bootstrap();
		await lazyApp.load(EagerLazy);
		expect(initialized).toEqual([]);
		await lazyApp.close();
	});

	it("supports a lazy module nested inside a lazy module", async () => {
		const AnalyticsLazy = lazy(async () => AnalyticsModule);
		@Module({ imports: [AnalyticsLazy] })
		class ReportsModule {}
		const ReportsLazy = lazy(async () => ReportsModule);
		@Module({ imports: [SharedModule, ReportsLazy] })
		class AppModule {}
		const app = await NexusApplication.create(AppModule).bootstrap();

		await app.load(ReportsLazy);
		expect(await app.get(AnalyticsService)).toBeUndefined();
		const analytics = await app.load(AnalyticsLazy);
		expect(await analytics.get(AnalyticsService)).toBeInstanceOf(
			AnalyticsService,
		);
		await app.close();
	});

	it("get() returns undefined for non-provider tokens instead of throwing", async () => {
		const PostsLazy = lazy(async () => PostsModule, { name: "Posts" });
		@Module({ imports: [PostsLazy] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();

		expect(await app.get(PostsLazy.id)).toBeUndefined();
		expect(await app.get(AppModule)).toBeUndefined();

		await app.load(PostsLazy);

		expect(await app.get(PostsLazy.id)).toBeUndefined();
		expect(await app.get(PostsModule)).toBeUndefined();

		await app.close();
	});

	it("close() destroys providers loaded lazily", async () => {
		const destroyed: string[] = [];
		@Injectable()
		class Disposable {
			onModuleDestroy() {
				destroyed.push("Disposable");
			}
		}
		@Module({ providers: [Disposable] })
		class DisposableModule {}
		const DisposableLazy = lazy(async () => DisposableModule);
		@Module({ imports: [DisposableLazy] })
		class AppModule {}

		const app = await NexusApplication.create(AppModule).bootstrap();
		await app.load(DisposableLazy);
		await app.close();
		expect(destroyed).toEqual(["Disposable"]);
	});
});
