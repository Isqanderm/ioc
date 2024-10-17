import { Test } from "@nexus-ioc/testing";
import { type DynamicModule, Inject, Injectable, NsModule } from "../../src";

describe("Export Hierarchy", () => {
	it("should correct resolve hierarchy dependency", async () => {
		@NsModule({
			providers: [
				{
					provide: "hash",
					useFactory: () => {
						return "hash-string";
					},
				},
			],
			exports: ["hash"],
		})
		class ThirdPartyNestModule {}

		@NsModule({
			imports: [ThirdPartyNestModule],
			providers: [
				{
					provide: "secret",
					useValue: "secret-key",
				},
			],
			exports: ["secret", ThirdPartyNestModule],
		})
		class ThirdPartyModule {}

		@Injectable()
		class DependencyService {
			constructor(
				@Inject("secret") public readonly secret: string,
				@Inject("hash") public readonly hash: string,
			) {}
		}

		@NsModule({
			imports: [ThirdPartyModule],
			providers: [DependencyService],
			exports: [DependencyService],
		})
		class DependencyModule {}

		@Injectable()
		class AppService {
			constructor(
				@Inject(DependencyService)
				public readonly dependencyService: DependencyService,
				@Inject("secret") public readonly secret: string,
			) {}
		}

		const appContainer = await Test.createModule({
			imports: [DependencyModule],
			providers: [AppService],
		}).compile();

		const appService = await appContainer.get<AppService>(AppService);

		expect(appService?.dependencyService?.secret).toEqual("secret-key");
		expect(appService?.secret).toBeFalsy();
	});

	it("should correct resolve hierarchy dependency for forFeature", async () => {
		const featureConfig = {
			provide: "secret",
			useValue: "secret-key",
		};

		@NsModule({})
		class FeatureModule {
			static forFeature(): DynamicModule {
				return {
					module: FeatureModule,
					imports: [],
					providers: [featureConfig],
					exports: ["secret"],
				};
			}
		}

		@Injectable()
		class AppService {
			constructor(
				@Inject("secret")
				public readonly secret: string,
			) {}
		}

		const appContainer = await Test.createModule({
			imports: [FeatureModule.forFeature()],
			providers: [AppService],
		}).compile();

		const appService = await appContainer.get<AppService>(AppService);

		expect(appService?.secret).toEqual("secret-key");
	});
});
